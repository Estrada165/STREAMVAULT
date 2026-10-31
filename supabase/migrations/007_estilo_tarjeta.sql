-- =====================================================================
-- StreamVault v2 · Estilo de la tarjeta de cada producto
-- products.card_style guarda cómo se ve la tarjeta en la tienda:
--   { "fit": "cover" | "contain",          -- llenar el marco o imagen completa
--     "pos": "top" | "center" | "bottom",  -- qué parte de la imagen se prioriza
--     "color": "#RRGGBB" | null }          -- color de la tarjeta
-- Seguro de ejecutar con la app actual: es una columna nueva con valor por defecto.
-- =====================================================================
alter table public.products
  add column if not exists card_style jsonb not null default '{}'::jsonb;

alter table public.products drop constraint if exists products_card_style_check;
alter table public.products add constraint products_card_style_check check (
  jsonb_typeof(card_style) = 'object'
  and length(card_style::text) < 300
  and coalesce(card_style->>'fit', 'cover') in ('cover', 'contain')
  and coalesce(card_style->>'pos', 'center') in ('top', 'center', 'bottom')
  and (card_style->>'color' is null or card_style->>'color' ~ '^#[0-9A-Fa-f]{6}$')
);

select 'Estilo de tarjeta listo' as resultado;
