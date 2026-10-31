-- =====================================================================
-- StreamVault v2 · Color de marca del proveedor
-- Agrega providers.brand_accent (el dúo de colores que elige el proveedor
-- en Configuración). Seguro de ejecutar con la app actual: es una columna nueva.
-- =====================================================================
alter table public.providers
  add column if not exists brand_accent text not null default 'turquesa';

alter table public.providers drop constraint if exists providers_brand_accent_check;
alter table public.providers add constraint providers_brand_accent_check
  check (brand_accent in ('turquesa', 'menta', 'cian', 'azul', 'rosa', 'ambar'));

-- El trigger sv_guard_providers ya permite que el dueño cambie esta columna
-- (solo bloquea is_active, expires_at, renewal_cost, user_id, id y created_at).

select 'Color de marca listo' as resultado;
