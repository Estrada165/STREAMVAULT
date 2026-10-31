-- =====================================================================
-- StreamVault v2 · Colores personalizados del proveedor
-- Permite, además de los 6 dúos, guardar dos colores libres con el formato
--   custom:#RRGGBB:#RRGGBB   (principal : secundario)
-- Requiere haber ejecutado antes el 005 (columna brand_accent).
-- =====================================================================
alter table public.providers
  add column if not exists brand_accent text not null default 'turquesa';

alter table public.providers drop constraint if exists providers_brand_accent_check;
alter table public.providers add constraint providers_brand_accent_check
  check (
    brand_accent in ('turquesa', 'menta', 'cian', 'azul', 'rosa', 'ambar')
    or brand_accent ~ '^custom:#[0-9A-Fa-f]{6}:#[0-9A-Fa-f]{6}$'
  );

select 'Colores personalizados listos' as resultado;
