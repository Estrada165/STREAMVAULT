-- =====================================================================
-- StreamVault v2 · 008 · Funciones nuevas
--   1. Color propio del distribuidor            (users.ui_accent)
--   2. Avisos del proveedor a su red            (announcements)
--   3. Cobros de renovación a proveedores       (provider_payments)
--   4. Registro de actividad automático         (activity_log + triggers)
--   5. Alertas automáticas (stock bajo/agotado, pedidos "a pedido")
--   6. Salud de la plataforma para el admin     (admin_platform_health)
-- Requiere: seguridad parte A y B, 005, 006 y 007.
-- Seguro de re-ejecutar. Nada de esto cambia cómo funciona lo que ya existe:
-- los registros y alertas nunca bloquean una compra (si fallan, se omiten).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Color propio del distribuidor (null = usa el de su proveedor)
-- ---------------------------------------------------------------------
alter table public.users add column if not exists ui_accent text;
alter table public.users drop constraint if exists users_ui_accent_check;
alter table public.users add constraint users_ui_accent_check check (
  ui_accent is null
  or ui_accent in ('turquesa', 'menta', 'cian', 'azul', 'rosa', 'ambar')
  or ui_accent ~ '^custom:#[0-9A-Fa-f]{6}:#[0-9A-Fa-f]{6}$'
);

-- ---------------------------------------------------------------------
-- 2. Avisos a la red
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  message     text check (message is null or char_length(message) <= 400),
  image_url   text check (image_url is null or image_url ~* '^https?://'),
  link_url    text check (link_url is null or link_url ~* '^https?://'),
  link_label  text check (link_label is null or char_length(link_label) <= 30),
  tone        text not null default 'a' check (tone in ('a', 'b', 'neutral')),
  is_active   boolean not null default true,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_announcements_provider on public.announcements (provider_id, is_active);
alter table public.announcements enable row level security;

drop policy if exists sv_admin_all on public.announcements;
create policy sv_admin_all on public.announcements for all to authenticated
  using ((select public.sv_is_admin())) with check ((select public.sv_is_admin()));
drop policy if exists sv_ann_prov_all on public.announcements;
create policy sv_ann_prov_all on public.announcements for all to authenticated
  using (provider_id = (select public.sv_my_provider_id()))
  with check (provider_id = (select public.sv_my_provider_id()));
drop policy if exists sv_ann_dist_select on public.announcements;
create policy sv_ann_dist_select on public.announcements for select to authenticated
  using (provider_id = (select public.sv_dist_provider_id())
         and is_active and starts_at <= now() and (ends_at is null or ends_at > now()));

-- ---------------------------------------------------------------------
-- 3. Cobros de renovación (los registra el admin; el proveedor ve los suyos)
-- ---------------------------------------------------------------------
create table if not exists public.provider_payments (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  amount      numeric(10,2) not null check (amount >= 0),
  currency    text not null default 'PEN' check (currency in ('PEN', 'USD')),
  days_added  int not null default 0,
  method      text check (method is null or char_length(method) <= 30),
  note        text check (note is null or char_length(note) <= 200),
  paid_at     timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_payments_provider on public.provider_payments (provider_id, paid_at desc);
alter table public.provider_payments enable row level security;

drop policy if exists sv_admin_all on public.provider_payments;
create policy sv_admin_all on public.provider_payments for all to authenticated
  using ((select public.sv_is_admin())) with check ((select public.sv_is_admin()));
drop policy if exists sv_pay_prov_select on public.provider_payments;
create policy sv_pay_prov_select on public.provider_payments for select to authenticated
  using (provider_id = (select public.sv_my_provider_id()));

-- ---------------------------------------------------------------------
-- 4. Registro de actividad (solo lo lee el admin; lo escriben los triggers)
-- ---------------------------------------------------------------------
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  actor_role  text,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  provider_id uuid,
  summary     text not null,
  details     jsonb not null default '{}'::jsonb
);
create index if not exists idx_activity_created  on public.activity_log (created_at desc);
create index if not exists idx_activity_provider on public.activity_log (provider_id, created_at desc);
alter table public.activity_log enable row level security;

drop policy if exists sv_admin_all on public.activity_log;
drop policy if exists sv_admin_select on public.activity_log;
create policy sv_admin_select on public.activity_log for select to authenticated
  using ((select public.sv_is_admin()));
-- (sin políticas de escritura: desde el navegador nadie puede insertar ni borrar)

create or replace function public.sv_log(p_action text, p_entity text, p_entity_id uuid,
                                         p_provider uuid, p_summary text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text;
begin
  if v_uid is not null then select role into v_role from public.users where id = v_uid; end if;
  insert into public.activity_log (actor_id, actor_role, action, entity, entity_id, provider_id, summary, details)
  values (v_uid, coalesce(v_role, 'sistema'), p_action, p_entity, p_entity_id, p_provider, left(p_summary, 300), coalesce(p_details, '{}'::jsonb));
exception when others then
  raise warning 'sv_log: %', sqlerrm;  -- registrar nunca debe romper la operación
end;
$$;
revoke execute on function public.sv_log(text, text, uuid, uuid, text, jsonb) from public, anon, authenticated;

-- Nombre legible de un usuario
create or replace function public.sv_user_label(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(full_name, ''), email, 'usuario') from public.users where id = p_uid
$$;
revoke execute on function public.sv_user_label(uuid) from public, anon, authenticated;

-- ---- Proveedores ----
create or replace function public.sv_trg_log_providers()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  v_name := coalesce(nullif(new.display_name, ''), new.slug);
  if tg_op = 'INSERT' then
    perform public.sv_log('registro', 'proveedor', new.id, new.id, 'Nuevo proveedor registrado: ' || v_name);
    return new;
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.sv_log(case when new.is_active then 'activar' else 'desactivar' end, 'proveedor', new.id, new.id,
      case when new.is_active then 'Proveedor activado: ' else 'Proveedor desactivado: ' end || v_name);
  end if;
  if new.expires_at is distinct from old.expires_at then
    perform public.sv_log('acceso', 'proveedor', new.id, new.id,
      'Acceso de ' || v_name || ' hasta ' || coalesce(to_char(new.expires_at at time zone 'America/Lima', 'DD/MM/YYYY'), 'sin fecha')
      || coalesce(' (' || case when new.expires_at > old.expires_at then '+' else '' end
         || round(extract(epoch from (new.expires_at - old.expires_at)) / 86400)::int || ' días)', ''),
      jsonb_build_object('antes', old.expires_at, 'despues', new.expires_at));
  end if;
  if new.slug is distinct from old.slug or new.display_name is distinct from old.display_name
     or new.renewal_cost is distinct from old.renewal_cost then
    perform public.sv_log('editar', 'proveedor', new.id, new.id, 'Datos actualizados de ' || v_name);
  end if;
  return new;
end;
$$;
drop trigger if exists sv_log_providers on public.providers;
create trigger sv_log_providers after insert or update on public.providers
  for each row execute function public.sv_trg_log_providers();

-- ---- Usuarios (registro y activación) ----
create or replace function public.sv_trg_log_users()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_label text := coalesce(nullif(new.full_name, ''), new.email);
begin
  if tg_op = 'INSERT' then
    if new.role = 'distribuidor' then
      perform public.sv_log('registro', 'distribuidor', new.id, new.provider_id, 'Nuevo distribuidor registrado: ' || v_label);
    end if;
    return new;
  end if;
  if new.is_active is distinct from old.is_active and new.role in ('distribuidor', 'proveedor') then
    perform public.sv_log(case when new.is_active then 'activar' else 'desactivar' end,
      case when new.role = 'distribuidor' then 'distribuidor' else 'usuario' end, new.id,
      coalesce(new.provider_id, (select id from public.providers where user_id = new.id)),
      case when new.is_active then 'Cuenta activada: ' else 'Cuenta desactivada: ' end || v_label);
  end if;
  return new;
end;
$$;
drop trigger if exists sv_log_users on public.users;
create trigger sv_log_users after insert or update of is_active on public.users
  for each row execute function public.sv_trg_log_users();

-- ---- Saldos ----
create or replace function public.sv_trg_log_balances()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_delta numeric := round(coalesce(new.amount_usd, 0) - coalesce(old.amount_usd, 0), 2);
begin
  if v_delta = 0 then return new; end if;
  perform public.sv_log('saldo', 'saldo', new.user_id,
    (select provider_id from public.users where id = new.user_id),
    'Saldo de ' || coalesce(public.sv_user_label(new.user_id), '?') || ': $' || to_char(old.amount_usd, 'FM999990.00')
      || ' → $' || to_char(new.amount_usd, 'FM999990.00') || ' (' || case when v_delta > 0 then '+' else '' end
      || to_char(v_delta, 'FM999990.00') || ')',
    jsonb_build_object('antes', old.amount_usd, 'despues', new.amount_usd, 'delta', v_delta));
  return new;
end;
$$;
drop trigger if exists sv_log_balances on public.balances;
create trigger sv_log_balances after update of amount_usd on public.balances
  for each row execute function public.sv_trg_log_balances();

-- ---- Pedidos (y alerta "a pedido" al proveedor) ----
create or replace function public.sv_trg_log_orders()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prod record;
begin
  select p.name, p.provider_id, pr.user_id as prov_user into v_prod
  from public.products p join public.providers pr on pr.id = p.provider_id where p.id = new.product_id;

  if tg_op = 'INSERT' then
    perform public.sv_log('compra', 'pedido', new.id, v_prod.provider_id,
      coalesce(public.sv_user_label(new.distributor_id), '?') || ' compró ' || coalesce(v_prod.name, 'un producto')
      || ' (' || new.order_code || ') por $' || to_char(new.price_paid, 'FM999990.00'));
    if new.status = 'pendiente_credenciales' and v_prod.prov_user is not null then
      begin
        insert into public.notifications (user_id, title, message, type, ref_id)
        values (v_prod.prov_user, 'Pedido por entregar',
                coalesce(v_prod.name, 'Producto') || ' · ' || new.order_code || ': carga las credenciales.', 'pedido', new.id);
      exception when others then null; end;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.sv_log('estado', 'pedido', new.id, v_prod.provider_id,
      new.order_code || ': ' || coalesce(old.status, '?') || ' → ' || coalesce(new.status, '?'));
  end if;
  if new.expires_at is distinct from old.expires_at and new.expires_at > coalesce(old.expires_at, now()) then
    perform public.sv_log('renovacion', 'pedido', new.id, v_prod.provider_id,
      new.order_code || ' renovado hasta ' || to_char(new.expires_at at time zone 'America/Lima', 'DD/MM/YYYY'));
  end if;
  return new;
end;
$$;
drop trigger if exists sv_log_orders on public.orders;
create trigger sv_log_orders after insert or update of status, expires_at on public.orders
  for each row execute function public.sv_trg_log_orders();

-- ---- Productos ----
create or replace function public.sv_trg_log_products()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.sv_log('crear', 'producto', new.id, new.provider_id, 'Producto creado: ' || new.name);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.sv_log('eliminar', 'producto', old.id, old.provider_id, 'Producto eliminado: ' || old.name);
    return old;
  end if;
  if new.price_usd is distinct from old.price_usd then
    perform public.sv_log('precio', 'producto', new.id, new.provider_id,
      'Precio de ' || new.name || ': $' || to_char(old.price_usd, 'FM999990.00') || ' → $' || to_char(new.price_usd, 'FM999990.00'));
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.sv_log(case when new.is_active then 'mostrar' else 'ocultar' end, 'producto', new.id, new.provider_id,
      new.name || case when new.is_active then ' visible en la tienda' else ' oculto de la tienda' end);
  end if;
  return new;
end;
$$;
drop trigger if exists sv_log_products on public.products;
create trigger sv_log_products after insert or delete or update of price_usd, is_active on public.products
  for each row execute function public.sv_trg_log_products();

-- ---- Stock cargado (una línea por carga, no por cuenta) ----
create or replace function public.sv_trg_log_stock_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select n.product_id, count(*) as qty, p.name, p.provider_id
    from new_rows n join public.products p on p.id = n.product_id
    group by n.product_id, p.name, p.provider_id
  loop
    perform public.sv_log('stock', 'producto', r.product_id, r.provider_id,
      'Se cargaron ' || r.qty || ' cuenta' || case when r.qty = 1 then '' else 's' end || ' en ' || r.name);
  end loop;
  return null;
exception when others then
  raise warning 'sv_trg_log_stock_insert: %', sqlerrm; return null;
end;
$$;
drop trigger if exists sv_log_stock_insert on public.stock_items;
create trigger sv_log_stock_insert after insert on public.stock_items
  referencing new table as new_rows for each statement execute function public.sv_trg_log_stock_insert();

-- ---- Cobros ----
create or replace function public.sv_trg_log_payments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sv_log('cobro', 'proveedor', new.provider_id, new.provider_id,
    'Cobro registrado: ' || case when new.currency = 'USD' then '$' else 'S/ ' end || to_char(new.amount, 'FM999990.00')
    || ' de ' || coalesce((select coalesce(nullif(display_name, ''), slug) from public.providers where id = new.provider_id), '?')
    || case when new.days_added <> 0 then ' (+' || new.days_added || ' días)' else '' end);
  return new;
end;
$$;
drop trigger if exists sv_log_payments on public.provider_payments;
create trigger sv_log_payments after insert on public.provider_payments
  for each row execute function public.sv_trg_log_payments();

-- ---------------------------------------------------------------------
-- 5. Alerta automática de stock: avisa al proveedor cuando quedan 2 y cuando se agota
-- ---------------------------------------------------------------------
create or replace function public.sv_trg_stock_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_left int; v_prod record;
begin
  if not (coalesce(new.is_sold, false) and not coalesce(old.is_sold, false)) then return new; end if;
  select p.id, p.name, p.is_active, pr.user_id as prov_user into v_prod
  from public.products p join public.providers pr on pr.id = p.provider_id where p.id = new.product_id;
  if v_prod.prov_user is null or not coalesce(v_prod.is_active, false) then return new; end if;
  select count(*) into v_left from public.stock_items where product_id = new.product_id and not coalesce(is_sold, false);
  if v_left = 0 then
    insert into public.notifications (user_id, title, message, type, ref_id)
    values (v_prod.prov_user, 'Sin stock: ' || v_prod.name, 'Se vendió la última cuenta. Tus distribuidores ya no pueden comprarlo.', 'stock', v_prod.id);
  elsif v_left = 2 then
    insert into public.notifications (user_id, title, message, type, ref_id)
    values (v_prod.prov_user, 'Stock bajo: ' || v_prod.name, 'Quedan 2 cuentas disponibles. Repón pronto.', 'stock', v_prod.id);
  end if;
  return new;
exception when others then
  raise warning 'sv_trg_stock_alert: %', sqlerrm; return new;
end;
$$;
drop trigger if exists sv_stock_alert on public.stock_items;
create trigger sv_stock_alert after update of is_sold on public.stock_items
  for each row execute function public.sv_trg_stock_alert();

-- Los triggers no se llaman directo desde el navegador
revoke execute on function public.sv_trg_log_providers()     from public, anon, authenticated;
revoke execute on function public.sv_trg_log_users()         from public, anon, authenticated;
revoke execute on function public.sv_trg_log_balances()      from public, anon, authenticated;
revoke execute on function public.sv_trg_log_orders()        from public, anon, authenticated;
revoke execute on function public.sv_trg_log_products()      from public, anon, authenticated;
revoke execute on function public.sv_trg_log_stock_insert()  from public, anon, authenticated;
revoke execute on function public.sv_trg_log_payments()      from public, anon, authenticated;
revoke execute on function public.sv_trg_stock_alert()       from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Salud de la plataforma (solo admin). Cifras exactas, sin el límite de 1000 filas.
-- ---------------------------------------------------------------------
create or replace function public.admin_platform_health()
returns table (
  provider_id uuid, display_name text, slug text, is_active boolean, expires_at timestamptz,
  sales_7d bigint, revenue_7d numeric, revenue_30d numeric, revenue_total numeric, orders_total bigint,
  last_sale_at timestamptz, active_distributors bigint, total_distributors bigint,
  available_stock bigint, active_products bigint, pending_orders bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sv_is_admin() then raise exception 'No autorizado'; end if;
  return query
  select pr.id, pr.display_name, pr.slug, pr.is_active, pr.expires_at,
    coalesce(o.sales_7d, 0), coalesce(o.rev_7d, 0), coalesce(o.rev_30d, 0), coalesce(o.rev_total, 0), coalesce(o.orders_total, 0),
    o.last_sale,
    (select count(*) from public.users u where u.provider_id = pr.id and u.role = 'distribuidor' and u.is_active),
    (select count(*) from public.users u where u.provider_id = pr.id and u.role = 'distribuidor'),
    (select count(*) from public.stock_items s join public.products p on p.id = s.product_id
       where p.provider_id = pr.id and p.is_active and not coalesce(s.is_sold, false)),
    (select count(*) from public.products p where p.provider_id = pr.id and p.is_active),
    coalesce(o.pending, 0)
  from public.providers pr
  left join lateral (
    select
      count(*) filter (where od.created_at > now() - interval '7 days' and od.status <> 'cancelado') as sales_7d,
      sum(od.price_paid) filter (where od.created_at > now() - interval '7 days' and od.status <> 'cancelado') as rev_7d,
      sum(od.price_paid) filter (where od.created_at > now() - interval '30 days' and od.status <> 'cancelado') as rev_30d,
      sum(od.price_paid) filter (where od.status <> 'cancelado') as rev_total,
      count(*) as orders_total,
      max(od.created_at) as last_sale,
      count(*) filter (where od.status = 'pendiente_credenciales') as pending
    from public.orders od join public.products p on p.id = od.product_id
    where p.provider_id = pr.id
  ) o on true
  order by pr.created_at desc;
end;
$$;
revoke execute on function public.admin_platform_health() from public, anon;
grant  execute on function public.admin_platform_health() to authenticated;

-- Índices de apoyo
create index if not exists idx_orders_product_created on public.orders (product_id, created_at desc);
create index if not exists idx_transactions_created  on public.transactions (created_at desc);

select 'Funciones v2 listas' as resultado;
