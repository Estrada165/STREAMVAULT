# Bot de códigos (StreamVault ↔ StreamPanel)

Cada venta de un producto con **Bot de códigos** crea en el StreamPanel del proveedor un acceso propio
para el comprador: un código `SV-…` que solo ve ese correo, con los tipos de código elegidos y hasta la
fecha del pedido. El enlace (`https://tu-panel/?ref=SV-…`) entra solo, sin contraseña.

| En StreamVault | En StreamPanel |
|---|---|
| Compra | Se crea el acceso (código + asignación del correo) |
| Renovar | Se extiende la fecha |
| Cambiar cliente / WhatsApp / correo del stock | Se actualiza el acceso (mismo código) |
| Vencer, anular o borrar el pedido | Se desactiva el acceso |
| Apagar el bot del producto | Se desactivan sus accesos activos |

## Puesta en marcha (una sola vez)

1. **StreamPanel** → Supabase SQL Editor: `backend/sql/2026-11_integracion_streamvault.sql`
   y desplegar el backend (Railway). Opcional: variable `PUBLIC_APP_URL` con la URL pública del panel
   (si no, usa la primera de `FRONTEND_URL`).
2. **StreamVault** → Supabase SQL Editor: `supabase/migrations/012_bot_codigos.sql`.
3. **Vercel (StreamVault)** → Settings → Environment Variables:
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key de Supabase (secreta, **sin** `VITE_`).
   - `STREAMPANEL_API_URL` = URL del backend de StreamPanel terminada en `/api`.
   Después, *Redeploy*.

## Uso

1. StreamPanel → Configuración → **Tienda StreamVault** → Generar clave (se muestra una sola vez).
2. StreamVault → Configuración → **Bot de códigos** → pegar la clave → Conectar.
3. En cada producto: activar **Bot de códigos**, elegir la plataforma y los tipos de código.
4. En Stock cada correo indica si está en el bot (✓) o no (⚠).

## Cómo funciona por dentro

- `api/codebot.js` (función de Vercel) + `server/codebot.js`: única pieza que conoce la clave del
  proveedor (`codebot_links`, sin acceso desde el navegador).
- `order_code_access`: estado del enlace de cada pedido (lo lee el distribuidor, el proveedor y el admin).
- La compra nunca depende de StreamPanel: si no responde, el pedido queda con «enlace pendiente» y se
  reintenta al abrir *Mis pedidos* o *Ventas*, o con el botón **Reintentar**.
- StreamPanel valida siempre que el correo sea del proveedor dueño de la clave.
