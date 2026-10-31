-- =====================================================================
-- StreamVault v2 · 010 · Operaciones de saldo a prueba de fallos
--   1. provider_recharge  → recarga manual del proveedor a un distribuidor
--   2. renew_order        → renovación (cobrada desde Ventas o de cortesía desde Soporte)
--   3. cancel_order       → anulación con reembolso al saldo, externo o sin reembolso
--   4. checkout           → ahora los productos "a pedido" descuentan sus cupos
--   5. Vencimientos       → arregla/borra delete_expired_orders y vence pedidos solo
-- Todo pasa en UNA transacción: o se hace completo o no se hace nada.
-- Requiere: seguridad A y B. Seguro de re-ejecutar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Recarga manual
-- ---------------------------------------------------------------------
create or replace function public.provider_recharge(p_user uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_amount numeric := round(coalesce(p_amount, 0), 2);
begin
  if not (public.sv_is_my_distributor(p_user) or public.sv_is_admin()) then
    raise exception 'No autorizado: este distribuidor no es de tu red';
  end if;
  if v_amount <= 0 or v_amount > 5000 then raise exception 'Monto inválido (entre $0.01 y $5000)'; end if;

  insert into public.balances (user_id, amount_usd) values (p_user, 0) on conflict (user_id) do nothing;
  select amount_usd into v_bal from public.balances where user_id = p_user for update;
  v_bal := round(coalesce(v_bal, 0) + v_amount, 2);
  update public.balances set amount_usd = v_bal, updated_at = now() where user_id = p_user;

  insert into public.transactions (user_id, type, amount_usd, description)
  values (p_user, 'recarga', v_amount, 'Recarga manual por proveedor');
  insert into public.notifications (user_id, title, message, type)
  values (p_user, 'Saldo recargado', 'Se recargaron $' || to_char(v_amount, 'FM999990.00') || ' a tu cuenta. Saldo actual: $' || to_char(v_bal, 'FM999990.00') || '.', 'recarga');
  return v_bal;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Renovación. p_charge = true cobra al distribuidor (precio de renovación
--    o lo que pagó); false = renovación de cortesía (por ejemplo, desde un ticket).
-- ---------------------------------------------------------------------
create or replace function public.renew_order(p_order uuid, p_days int, p_charge boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_prod public.products%rowtype; v_cost numeric := 0; v_bal numeric; v_new timestamptz;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.sv_owns_product(v_order.product_id) or public.sv_is_admin()) then raise exception 'No autorizado'; end if;
  if v_order.status = 'cancelado' then raise exception 'No se puede renovar un pedido cancelado'; end if;
  if coalesce(p_days, 0) < 1 or p_days > 400 then raise exception 'Días inválidos (entre 1 y 400)'; end if;

  select * into v_prod from public.products where id = v_order.product_id;

  if p_charge then
    v_cost := round(case when coalesce(v_prod.is_renewable, false) and coalesce(v_prod.renewal_price_usd, 0) > 0
                         then v_prod.renewal_price_usd else v_order.price_paid end, 2);
    select amount_usd into v_bal from public.balances where user_id = v_order.distributor_id for update;
    if coalesce(v_bal, 0) < v_cost then
      raise exception 'Saldo insuficiente: el distribuidor tiene $% y la renovación cuesta $%',
        to_char(coalesce(v_bal, 0), 'FM999990.00'), to_char(v_cost, 'FM999990.00');
    end if;
    update public.balances set amount_usd = round(v_bal - v_cost, 2), updated_at = now() where user_id = v_order.distributor_id;
    insert into public.transactions (user_id, type, amount_usd, ref_order_id, description)
    values (v_order.distributor_id, 'compra', -v_cost, v_order.id, 'Renovación: ' || v_prod.name || ' (+' || p_days || ' días)');
  end if;

  v_new := greatest(coalesce(v_order.expires_at, now()), now()) + make_interval(days => p_days);
  update public.orders set expires_at = v_new,
         status = case when status = 'pendiente_credenciales' then status else 'activo' end,
         updated_at = now()
   where id = v_order.id;

  insert into public.notifications (user_id, title, message, type, ref_id)
  values (v_order.distributor_id, 'Pedido renovado',
          'Tu pedido ' || v_order.order_code || ' de ' || v_prod.name || ' fue renovado por ' || p_days || ' días. Vence el '
          || to_char(v_new at time zone 'America/Lima', 'DD/MM/YYYY') || '.', 'success', v_order.id);

  return jsonb_build_object('expires_at', v_new, 'cost', v_cost,
    'balance', (select amount_usd from public.balances where user_id = v_order.distributor_id));
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Anulación. p_mode: 'platform' (reembolso al saldo), 'external' (se paga por fuera), 'none'
--    El reembolso proporcional a los días que faltan lo calcula la base de datos.
--    La cuenta vuelve al stock y el distribuidor deja de ver sus credenciales.
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_order uuid, p_mode text, p_note text default null, p_ticket uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_prod public.products%rowtype; v_total int; v_used int; v_left int;
        v_refund numeric := 0; v_msg text; v_bal numeric;
begin
  if p_mode not in ('platform', 'external', 'none') then raise exception 'Tipo de anulación inválido'; end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.sv_owns_product(v_order.product_id) or public.sv_is_admin()) then raise exception 'No autorizado'; end if;
  if v_order.status = 'cancelado' then raise exception 'Este pedido ya estaba cancelado'; end if;
  select * into v_prod from public.products where id = v_order.product_id;

  v_total := greatest(1, ceil(extract(epoch from (coalesce(v_order.expires_at, now()) - v_order.created_at)) / 86400)::int);
  v_used  := greatest(0, ceil(extract(epoch from (now() - v_order.created_at)) / 86400)::int);
  v_left  := greatest(0, v_total - v_used);
  v_refund := round(v_order.price_paid / v_total * v_left, 2);

  -- Cancelar y devolver la cuenta al stock
  update public.orders set status = 'cancelado', stock_item_id = null, updated_at = now() where id = v_order.id;
  if v_order.stock_item_id is not null then
    update public.stock_items set is_sold = false, sold_at = null, order_id = null where id = v_order.stock_item_id;
  end if;
  -- "A pedido" con cupos: devolver el cupo
  if v_prod.delivery_mode <> 'stock' and v_prod.stock_qty is not null then
    update public.products set stock_qty = stock_qty + 1, updated_at = now() where id = v_prod.id;
  end if;

  if p_mode = 'platform' and v_refund > 0 then
    insert into public.balances (user_id, amount_usd) values (v_order.distributor_id, 0) on conflict (user_id) do nothing;
    select amount_usd into v_bal from public.balances where user_id = v_order.distributor_id for update;
    update public.balances set amount_usd = round(coalesce(v_bal, 0) + v_refund, 2), updated_at = now() where user_id = v_order.distributor_id;
    insert into public.transactions (user_id, type, amount_usd, ref_order_id, description)
    values (v_order.distributor_id, 'devolucion', v_refund, v_order.id,
            'Reembolso por anulación — Pedido #' || v_order.order_code || ' (' || v_left || 'd restantes)');
  end if;

  v_msg := case
    when p_mode = 'platform' then 'Tu pedido #' || v_order.order_code || ' fue cancelado. Se te reembolsaron $' || to_char(v_refund, 'FM999990.00') || ' en tu saldo.'
    when p_mode = 'external' then 'Tu pedido #' || v_order.order_code || ' fue cancelado. El reembolso de $' || to_char(v_refund, 'FM999990.00') || ' se hará por fuera de la plataforma.'
    else coalesce(nullif(trim(p_note), ''), 'Tu pedido #' || v_order.order_code || ' fue cancelado sin reembolso.') end;

  if p_ticket is not null then
    update public.support_tickets set status = 'resuelto', provider_response = v_msg, updated_at = now()
     where id = p_ticket and order_id = v_order.id;
  end if;

  insert into public.notifications (user_id, title, message, type, ref_id)
  values (v_order.distributor_id, 'Venta anulada', v_msg, case when p_mode = 'platform' then 'success' else 'warning' end, v_order.id);

  return jsonb_build_object('refund', case when p_mode = 'platform' then v_refund else 0 end,
    'computed_refund', v_refund, 'remaining_days', v_left, 'message', v_msg);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Compra: igual que antes + descuento de cupos en productos "a pedido"
-- ---------------------------------------------------------------------
create or replace function public.checkout(p_items jsonb, p_client_name text, p_client_whatsapp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_user    public.users%rowtype;
  v_prov    public.providers%rowtype;
  v_prod    public.products%rowtype;
  v_line    record;
  v_balance numeric;
  v_total   numeric := 0;
  v_units   int := 0;
  v_stock   uuid;
  v_order   public.orders%rowtype;
  v_orders  jsonb := '[]'::jsonb;
  i         int;
begin
  if v_uid is null then raise exception 'Sesión no válida, vuelve a iniciar sesión'; end if;

  select * into v_user from public.users where id = v_uid;
  if not found or v_user.role <> 'distribuidor' then raise exception 'Solo los distribuidores pueden comprar'; end if;
  if not coalesce(v_user.is_active, false) then raise exception 'Tu cuenta no está activa'; end if;

  select * into v_prov from public.providers where id = v_user.provider_id;
  if not found or not coalesce(v_prov.is_active, false) then raise exception 'El servicio de tu proveedor está suspendido'; end if;

  if coalesce(trim(p_client_name), '') = '' then raise exception 'El nombre del cliente es requerido'; end if;
  if coalesce(trim(p_client_whatsapp), '') = '' then raise exception 'El numero de WhatsApp es requerido'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;

  -- Pasada 1: validar productos y calcular total con precios reales
  for v_line in
    select (e->>'product_id')::uuid as product_id,
           sum(greatest(coalesce((e->>'quantity')::int, 1), 0))::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if v_line.qty < 1 then raise exception 'Cantidad inválida'; end if;
    select * into v_prod from public.products
      where id = v_line.product_id and provider_id = v_prov.id and is_active;
    if not found then raise exception 'Un producto del carrito ya no está disponible'; end if;
    if v_prod.delivery_mode <> 'stock' and v_prod.stock_qty is not null and v_prod.stock_qty < v_line.qty then
      raise exception 'No hay cupos suficientes para: %', v_prod.name;
    end if;
    v_total := v_total + v_prod.price_usd * v_line.qty;
    v_units := v_units + v_line.qty;
  end loop;

  if v_units > 50 then raise exception 'Máximo 50 unidades por compra'; end if;
  v_total := round(v_total, 2);

  -- Bloquea el saldo: dos compras simultáneas del mismo distribuidor se ponen en fila
  select amount_usd into v_balance from public.balances where user_id = v_uid for update;
  if v_balance is null or v_balance < v_total then raise exception 'Saldo insuficiente'; end if;

  -- Pasada 2: crear pedidos
  for v_line in
    select (e->>'product_id')::uuid as product_id,
           sum(greatest(coalesce((e->>'quantity')::int, 1), 0))::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    select * into v_prod from public.products where id = v_line.product_id;
    for i in 1..v_line.qty loop
      v_stock := null;
      if v_prod.delivery_mode = 'stock' then
        select id into v_stock from public.stock_items
          where product_id = v_prod.id and not coalesce(is_sold, false)
          order by created_at
          limit 1
          for update skip locked;
        if v_stock is null then raise exception 'Sin stock disponible para: %', v_prod.name; end if;
      end if;

      insert into public.orders (distributor_id, product_id, stock_item_id, client_name, client_whatsapp,
                                 price_paid, status, expires_at)
      values (v_uid, v_prod.id, v_stock, trim(p_client_name), trim(p_client_whatsapp),
              v_prod.price_usd,
              case when v_prod.delivery_mode = 'stock' then 'activo' else 'pendiente_credenciales' end,
              now() + make_interval(days => coalesce(v_prod.duration_days, 30)))
      returning * into v_order;

      if v_stock is not null then
        update public.stock_items set is_sold = true, sold_at = now(), order_id = v_order.id where id = v_stock;
      end if;

      -- Productos "a pedido" con cupos: descuenta 1 cupo por unidad (bloqueando la fila)
      if v_prod.delivery_mode <> 'stock' and v_prod.stock_qty is not null then
        update public.products set stock_qty = stock_qty - 1, updated_at = now()
          where id = v_prod.id and stock_qty > 0;
        if not found then raise exception 'No hay cupos suficientes para: %', v_prod.name; end if;
      end if;

      insert into public.transactions (user_id, type, amount_usd, ref_order_id, description)
      values (v_uid, 'compra', -v_prod.price_usd, v_order.id, 'Compra: ' || v_prod.name);

      v_orders := v_orders || jsonb_build_object('id', v_order.id, 'order_code', v_order.order_code,
                                                 'product_id', v_order.product_id, 'status', v_order.status);
    end loop;
  end loop;

  update public.balances set amount_usd = round(amount_usd - v_total, 2), updated_at = now()
    where user_id = v_uid;

  return jsonb_build_object('orders', v_orders, 'total', v_total, 'balance', round(v_balance - v_total, 2));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Vencimientos
--    delete_expired_orders estaba rota y la app no la usa: se elimina.
--    mark_expired_orders queda segura y, si pg_cron está disponible,
--    se ejecuta sola cada 15 minutos (sin depender de que alguien abra Ventas).
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'delete_expired_orders'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- El guardia de pedidos bloqueaba el vencimiento: cuando un proveedor abría Ventas,
-- mark_expired_orders intentaba vencer pedidos de OTROS proveedores y el guardia lo
-- rechazaba (el error se ignoraba en silencio). Ahora el guardia permite únicamente
-- el paso "activo → expirado" de un pedido cuya fecha ya pasó, sin tocar nada más.
create or replace function public.sv_guard_orders()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.sv_is_admin() then return new; end if;
  if new.id is distinct from old.id
     or new.order_code is distinct from old.order_code
     or new.distributor_id is distinct from old.distributor_id
     or new.product_id is distinct from old.product_id
     or new.price_paid is distinct from old.price_paid
     or new.created_at is distinct from old.created_at then
    raise exception 'No autorizado para modificar este pedido';
  end if;
  if old.status = 'activo' and new.status = 'expirado'
     and old.expires_at is not null and old.expires_at < now()
     and new.expires_at is not distinct from old.expires_at
     and new.stock_item_id is not distinct from old.stock_item_id
     and new.client_name is not distinct from old.client_name
     and new.client_whatsapp is not distinct from old.client_whatsapp then
    return new;
  end if;
  if not public.sv_owns_product(old.product_id) and (
       new.status is distinct from old.status
       or new.expires_at is distinct from old.expires_at
       or new.stock_item_id is distinct from old.stock_item_id) then
    raise exception 'Solo puedes editar el nombre y WhatsApp del cliente';
  end if;
  return new;
end;
$$;

create or replace function public.mark_expired_orders()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'expirado', updated_at = now()
   where status = 'activo' and expires_at is not null and expires_at < now();
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  begin perform cron.unschedule('sv-vencer-pedidos'); exception when others then null; end;
  perform cron.schedule('sv-vencer-pedidos', '*/15 * * * *', 'select public.mark_expired_orders()');
  raise notice 'Vencimiento automático programado cada 15 minutos';
exception when others then
  raise notice 'pg_cron no disponible (%). Actívalo en Database → Extensions y vuelve a ejecutar este bloque.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke execute on function public.provider_recharge(uuid, numeric)          from public, anon;
revoke execute on function public.renew_order(uuid, int, boolean)            from public, anon;
revoke execute on function public.cancel_order(uuid, text, text, uuid)       from public, anon;
revoke execute on function public.checkout(jsonb, text, text)                from public, anon;
revoke execute on function public.mark_expired_orders()                      from public, anon;
grant  execute on function public.provider_recharge(uuid, numeric)          to authenticated;
grant  execute on function public.renew_order(uuid, int, boolean)            to authenticated;
grant  execute on function public.cancel_order(uuid, text, text, uuid)       to authenticated;
grant  execute on function public.checkout(jsonb, text, text)                to authenticated;
grant  execute on function public.mark_expired_orders()                      to authenticated;

select 'Operaciones de saldo listas' as resultado;
