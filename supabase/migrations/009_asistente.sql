-- =====================================================================
-- StreamVault v2 · 009 · Asistente de la tienda (sin IA) + QR de pago
--   providers.assistant   → configuración del asistente del proveedor
--      { "enabled": true, "name": "Asistente", "welcome": "...",
--        "faqs": [ { "q": "horario, atienden", "a": "Atendemos de 9 a 22 h" } ] }
--   payment_methods.qr_url → imagen del QR (Yape, Plin, etc.), opcional
-- Seguro de re-ejecutar. Requiere 008.
-- =====================================================================
alter table public.providers add column if not exists assistant jsonb not null default '{}'::jsonb;
alter table public.providers drop constraint if exists providers_assistant_check;
alter table public.providers add constraint providers_assistant_check check (
  jsonb_typeof(assistant) = 'object'
  and length(assistant::text) < 12000
  and (assistant->'faqs' is null or jsonb_typeof(assistant->'faqs') = 'array')
);

alter table public.payment_methods add column if not exists qr_url text;
alter table public.payment_methods drop constraint if exists payment_methods_qr_url_check;
alter table public.payment_methods add constraint payment_methods_qr_url_check
  check (qr_url is null or qr_url ~* '^https://');

-- (El trigger sv_guard_providers ya deja que el dueño edite esta columna;
--  sus distribuidores pueden leerla porque ya leen la fila de su proveedor.)

select 'Asistente listo' as resultado;
