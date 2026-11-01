-- =====================================================================
-- 011 · Tipos de notificación nuevos
-- Arregla: "new row for relation notifications violates check constraint
-- notifications_type_check" al recargar saldo, renovar o anular.
-- Las funciones nuevas usan los tipos 'recarga', 'stock' y 'pedido',
-- que la restricción original (info, warning, error, success) no permitía.
-- Seguro de ejecutar más de una vez.
-- =====================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('info', 'warning', 'error', 'success', 'recarga', 'stock', 'pedido'));
