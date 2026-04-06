-- ============================================================
-- STREAMVAULT — Supabase Migration v1
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- SETTINGS (global config by admin)
-- ============================================================
create table settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value text not null,
  updated_at timestamptz default now()
);

insert into settings (key, value) values
  ('exchange_rate', '3.50'),
  ('app_name', 'StreamVault'),
  ('app_logo', '');

-- ============================================================
-- USERS (extended profile linked to auth.users)
-- ============================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null check (role in ('admin', 'proveedor', 'distribuidor')),
  provider_id uuid, -- null for admin/proveedores, FK set later
  is_active boolean default false,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PROVIDERS
-- ============================================================
create table providers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  display_name text,
  logo_url text,
  expires_at timestamptz,
  is_active boolean default false,
  created_at timestamptz default now()
);

-- Add FK from users to providers
alter table users add constraint fk_users_provider
  foreign key (provider_id) references providers(id) on delete set null;

-- ============================================================
-- PLATFORMS (managed by admin)
-- ============================================================
create table platforms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_filename text not null, -- e.g. "netflix.png"
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into platforms (name, logo_filename) values
  ('Netflix', 'netflix.png'),
  ('Disney+', 'disney.png'),
  ('HBO Max', 'hbo.png'),
  ('Amazon Prime', 'amazon.png'),
  ('Spotify', 'spotify.png'),
  ('YouTube Premium', 'youtube.png'),
  ('Paramount+', 'paramount.png'),
  ('Apple TV+', 'appletv.png'),
  ('Crunchyroll', 'crunchyroll.png'),
  ('Canva', 'canva.png'),
  ('IPTV', 'iptv.png'),
  ('DirecTV Go', 'directv.png'),
  ('Movistar Play', 'movistar.png'),
  ('Vix', 'vix.png'),
  ('Deezer', 'deezer.png'),
  ('Plex', 'plex.png'),
  ('Mubi', 'mubi.png');

-- ============================================================
-- PRODUCTS
-- ============================================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references providers(id) on delete cascade,
  platform_id uuid not null references platforms(id),
  name text not null,
  delivery_type text not null check (delivery_type in ('cuenta_completa','perfil','iptv','activacion_tv','codigo')),
  delivery_mode text not null check (delivery_mode in ('stock','pedido')) default 'stock',
  price_usd numeric(10,2) not null,
  duration_days int not null default 30,
  terms text,
  warranty text,
  what_includes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- STOCK ITEMS
-- ============================================================
create table stock_items (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  email text,
  password text,
  url text,
  profile_name text,
  profile_pin text,
  activation_code text,
  extra_notes text,
  is_sold boolean default false,
  sold_at timestamptz,
  order_id uuid, -- FK set later
  created_at timestamptz default now()
);

-- ============================================================
-- ORDERS
-- ============================================================
create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_code text unique not null default ('ORD-' || upper(substring(uuid_generate_v4()::text, 1, 8))),
  distributor_id uuid not null references users(id),
  product_id uuid not null references products(id),
  stock_item_id uuid references stock_items(id),
  client_name text,
  client_whatsapp text,
  price_paid numeric(10,2) not null,
  status text not null check (status in ('activo','expirado','cancelado','pendiente_credenciales')) default 'activo',
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add FK from stock_items to orders
alter table stock_items add constraint fk_stock_order
  foreign key (order_id) references orders(id) on delete set null;

-- ============================================================
-- BALANCES
-- ============================================================
create table balances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references users(id) on delete cascade,
  amount_usd numeric(10,2) not null default 0.00,
  updated_at timestamptz default now()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  type text not null check (type in ('recarga','compra','devolucion','ajuste')),
  amount_usd numeric(10,2) not null,
  ref_order_id uuid references orders(id) on delete set null,
  description text,
  created_at timestamptz default now()
);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
create table support_tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_code text unique default ('TKT-' || upper(substring(uuid_generate_v4()::text, 1, 6))),
  order_id uuid not null references orders(id),
  distributor_id uuid not null references users(id),
  provider_id uuid not null references providers(id),
  reason text not null check (reason in ('contrasena_incorrecta','no_da_acceso','perfil_ocupado','codigo_invalido','otro')),
  description text,
  status text not null check (status in ('abierto','en_revision','resuelto')) default 'abierto',
  provider_response text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- WHATSAPP TEMPLATES
-- ============================================================
create table whatsapp_templates (
  id uuid primary key default uuid_generate_v4(),
  distributor_id uuid unique not null references users(id) on delete cascade,
  template_text text not null default
    '🎬 *Hola {nombre_cliente}!*

Tu acceso a *{plataforma}* ya está listo 🚀

📧 Correo: {correo}
🔑 Contraseña: {contrasena}
👤 Perfil: {perfil}
🔢 PIN: {pin}
🌐 URL: {url}
🔐 Código: {codigo}

⏳ Duración: {duracion} días
📅 Vence: {fecha_vencimiento}

Ante cualquier problema escríbeme 🙌',
  updated_at timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  message text not null,
  type text check (type in ('info','warning','error','success')) default 'info',
  is_read boolean default false,
  ref_id uuid, -- optional reference to ticket/order
  created_at timestamptz default now()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create balance on user insert
create or replace function handle_new_user_balance()
returns trigger language plpgsql security definer as $$
begin
  insert into balances (user_id, amount_usd) values (new.id, 0.00);
  return new;
end;
$$;

create trigger on_user_created_balance
  after insert on users
  for each row execute procedure handle_new_user_balance();

-- Auto-expire orders
create or replace function expire_orders()
returns void language plpgsql security definer as $$
begin
  update orders
  set status = 'expirado', updated_at = now()
  where status = 'activo'
    and expires_at < now();
end;
$$;

-- Refund balance on order cancel
create or replace function refund_on_cancel()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'cancelado' and old.status != 'cancelado' then
    update balances
    set amount_usd = amount_usd + old.price_paid,
        updated_at = now()
    where user_id = old.distributor_id;

    insert into transactions (user_id, type, amount_usd, ref_order_id, description)
    values (old.distributor_id, 'devolucion', old.price_paid, old.id, 'Devolución por orden cancelada ' || old.order_code);
  end if;
  return new;
end;
$$;

create trigger on_order_cancelled
  after update on orders
  for each row execute procedure refund_on_cancel();

-- ============================================================
-- RLS POLICIES
-- ============================================================

alter table users enable row level security;
alter table providers enable row level security;
alter table platforms enable row level security;
alter table products enable row level security;
alter table stock_items enable row level security;
alter table orders enable row level security;
alter table balances enable row level security;
alter table transactions enable row level security;
alter table support_tickets enable row level security;
alter table whatsapp_templates enable row level security;
alter table notifications enable row level security;
alter table settings enable row level security;

-- Helper function to get role
create or replace function get_user_role(uid uuid)
returns text language sql security definer as $$
  select role from users where id = uid;
$$;

create or replace function get_provider_id(uid uuid)
returns uuid language sql security definer as $$
  select provider_id from users where id = uid;
$$;

-- USERS policies
create policy "Users can view own profile" on users for select using (auth.uid() = id);
create policy "Admin can view all users" on users for select using (get_user_role(auth.uid()) = 'admin');
create policy "Admin can update users" on users for update using (get_user_role(auth.uid()) = 'admin');
create policy "Provider can view own distributors" on users for select using (
  get_user_role(auth.uid()) = 'proveedor' and
  provider_id = (select p.id from providers p where p.user_id = auth.uid())
);
create policy "Users can update own profile" on users for update using (auth.uid() = id);
create policy "Auth users can insert own profile" on users for insert with check (auth.uid() = id);

-- PROVIDERS policies
create policy "Admin full access providers" on providers for all using (get_user_role(auth.uid()) = 'admin');
create policy "Provider can view own" on providers for select using (user_id = auth.uid());
create policy "Provider can update own" on providers for update using (user_id = auth.uid());
create policy "Distribuidor can view own provider" on providers for select using (
  id = get_provider_id(auth.uid())
);

-- PLATFORMS policies
create policy "All can view active platforms" on platforms for select using (is_active = true);
create policy "Admin can manage platforms" on platforms for all using (get_user_role(auth.uid()) = 'admin');

-- PRODUCTS policies
create policy "Provider can manage own products" on products for all using (
  provider_id = (select p.id from providers p where p.user_id = auth.uid())
);
create policy "Distribuidor can view products of own provider" on products for select using (
  provider_id = get_provider_id(auth.uid()) and is_active = true
);
create policy "Admin can view all products" on products for select using (get_user_role(auth.uid()) = 'admin');

-- STOCK ITEMS policies
create policy "Provider can manage own stock" on stock_items for all using (
  product_id in (
    select id from products where provider_id = (
      select p.id from providers p where p.user_id = auth.uid()
    )
  )
);
create policy "Distribuidor can view own sold stock" on stock_items for select using (
  order_id in (select id from orders where distributor_id = auth.uid())
);

-- ORDERS policies
create policy "Distribuidor can view own orders" on orders for select using (distributor_id = auth.uid());
create policy "Distribuidor can create orders" on orders for insert with check (distributor_id = auth.uid());
create policy "Provider can view orders of own products" on orders for select using (
  product_id in (
    select id from products where provider_id = (
      select p.id from providers p where p.user_id = auth.uid()
    )
  )
);
create policy "Provider can update orders" on orders for update using (
  product_id in (
    select id from products where provider_id = (
      select p.id from providers p where p.user_id = auth.uid()
    )
  )
);
create policy "Admin can view all orders" on orders for select using (get_user_role(auth.uid()) = 'admin');

-- BALANCES policies
create policy "Users can view own balance" on balances for select using (user_id = auth.uid());
create policy "Provider can view distribuidor balances" on balances for select using (
  user_id in (
    select id from users where provider_id = (
      select p.id from providers p where p.user_id = auth.uid()
    )
  )
);
create policy "Provider can update distribuidor balances" on balances for update using (
  user_id in (
    select id from users where provider_id = (
      select p.id from providers p where p.user_id = auth.uid()
    )
  )
);
create policy "Admin can manage all balances" on balances for all using (get_user_role(auth.uid()) = 'admin');

-- TRANSACTIONS policies
create policy "Users can view own transactions" on transactions for select using (user_id = auth.uid());
create policy "Provider can view distribuidor transactions" on transactions for select using (
  user_id in (
    select id from users where provider_id = (
      select p.id from providers p where p.user_id = auth.uid()
    )
  )
);
create policy "Admin can view all transactions" on transactions for select using (get_user_role(auth.uid()) = 'admin');

-- SUPPORT TICKETS policies
create policy "Distribuidor can manage own tickets" on support_tickets for all using (distributor_id = auth.uid());
create policy "Provider can view and respond own tickets" on support_tickets for all using (
  provider_id = (select p.id from providers p where p.user_id = auth.uid())
);
create policy "Admin can view all tickets" on support_tickets for select using (get_user_role(auth.uid()) = 'admin');

-- WHATSAPP TEMPLATES policies
create policy "Distribuidor can manage own template" on whatsapp_templates for all using (distributor_id = auth.uid());

-- NOTIFICATIONS policies
create policy "Users can view own notifications" on notifications for select using (user_id = auth.uid());
create policy "Users can update own notifications" on notifications for update using (user_id = auth.uid());

-- SETTINGS policies
create policy "All can view settings" on settings for select using (true);
create policy "Admin can manage settings" on settings for all using (get_user_role(auth.uid()) = 'admin');
