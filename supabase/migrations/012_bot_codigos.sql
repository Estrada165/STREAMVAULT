-- =====================================================================
-- 012 · Bot de códigos (conexión con StreamPanel)
-- Cada venta de un producto con «bot de códigos» crea en el StreamPanel del
-- proveedor un acceso propio para el comprador (solo ese correo, esos tipos de
-- código y hasta la fecha del pedido). Al renovar se extiende; al vencer,
-- anular o borrar el pedido se desactiva.
--
-- Quien habla con StreamPanel es el servidor (api/codebot.js en Vercel) con la
-- service key. Desde el navegador nadie puede leer la clave del proveedor.
-- Seguro de ejecutar más de una vez.
-- =====================================================================

-- 1 · Conexión de cada proveedor (privada: RLS sin políticas = solo el servidor)
create table if not exists public.codebot_links (
  provider_id   uuid primary key references public.providers(id) on delete cascade,
  token         text not null,
  panel_name    text,
  link_base     text,
  connected_at  timestamptz not null default now(),
  last_ok_at    timestamptz,
  last_error    text
);
alter table public.codebot_links enable row level security;
revoke all on public.codebot_links from anon, authenticated;

-- 2 · Configuración por producto: { enabled, platform_id, platform_name, types: [...] }
alter table public.products add column if not exists code_bot jsonb;

-- 3 · Estado del acceso de cada pedido
--     Sin FK a orders a propósito: si borran el pedido, la fila queda para poder desactivar el acceso.
create table if not exists public.order_code_access (
  order_id        uuid primary key,
  provider_id     uuid not null references public.providers(id) on delete cascade,
  distributor_id  uuid references public.users(id) on delete set null,
  status          text not null default 'pending'
                  check (status in ('pending', 'active', 'revoked', 'error')),
  code            text,
  link            text,
  error           text,
  error_code      text,
  synced_hash     text,
  attempts        int not null default 0,
  updated_at      timestamptz not null default now()
);
create index if not exists order_code_access_provider_idx on public.order_code_access (provider_id, status);
create index if not exists order_code_access_dist_idx on public.order_code_access (distributor_id);

alter table public.order_code_access enable row level security;
revoke insert, update, delete on public.order_code_access from anon, authenticated;
grant select on public.order_code_access to authenticated;

drop policy if exists sv_oca_select on public.order_code_access;
create policy sv_oca_select on public.order_code_access for select to authenticated
  using (
    distributor_id = auth.uid()
    or provider_id = public.sv_my_provider_id()
    or public.sv_is_admin()
  );

-- 4 · Estado de la conexión para la pantalla del proveedor (sin exponer la clave)
create or replace function public.codebot_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
        'connected', true, 'panel_name', l.panel_name, 'connected_at', l.connected_at,
        'last_ok_at', l.last_ok_at, 'last_error', l.last_error)
       from public.codebot_links l where l.provider_id = public.sv_my_provider_id()),
    jsonb_build_object('connected', false))
$$;
revoke execute on function public.codebot_status() from public, anon;
grant execute on function public.codebot_status() to authenticated;
