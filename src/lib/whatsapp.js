import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const DEFAULT_TEMPLATE = `👋 ¡Hola {nombre_cliente}!

🎬 Tu acceso a *{plataforma}* ya está listo 🚀

📧 Correo: {correo}
🔑 Contraseña: {contrasena}
👤 Perfil: {perfil}
🔢 PIN: {pin}
🔗 URL: {url}
🎟️ Código: {codigo}

⏳ Duración: {duracion} días
📅 Vence: {fecha_vencimiento}

Ante cualquier problema, escríbeme 🙌`

/**
 * Enlace para abrir WhatsApp con un mensaje.
 * Usa api.whatsapp.com y NO wa.me: la redirección de wa.me rompe los emojis
 * de 4 bytes (👋 📧 🔑 📅…) y llegan como "�".
 */
export function waLink(phone, text) {
  const clean = String(phone || '').replace(/\D/g, '')
  const params = []
  if (clean) params.push(`phone=${clean}`)
  if (text) params.push(`text=${encodeURIComponent(String(text).normalize('NFC'))}`)
  return `https://api.whatsapp.com/send${params.length ? '?' + params.join('&') : ''}`
}

/**
 * Builds a WhatsApp URL with pre-filled message from a template.
 * Falls back to DEFAULT_TEMPLATE if template is empty/null.
 */
export function buildWhatsAppUrl(phone, template, variables) {
  const tpl = (template && template.trim()) ? template : DEFAULT_TEMPLATE
  const message = fillTemplate(tpl, variables)

  return waLink(phone, message)
}

/**
 * Replaces {variable} placeholders in template, removing empty lines.
 */
export function fillTemplate(template, variables) {
  let result = template

  const replacements = {
    '{nombre_cliente}': variables.clientName || '',
    '{plataforma}': variables.platformName || '',
    '{correo}': variables.email || '',
    '{contrasena}': variables.password || '',
    '{perfil}': variables.profileName || '',
    '{pin}': variables.profilePin || '',
    '{url}': variables.url || '',
    '{codigo}': variables.activationCode || '',
    '{duracion}': variables.durationDays?.toString() || '30',
    '{fecha_vencimiento}': variables.expiresAt
      ? format(new Date(variables.expiresAt), "d 'de' MMMM yyyy", { locale: es })
      : '',
    // El código de pedido es interno (para el distribuidor y soporte): nunca va al cliente final.
    // Si una plantilla antigua lo incluye, su línea se elimina sola.
    '{id_pedido}': '',
  }

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value)
  }

  result = result
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      if (!trimmed.includes(':')) return true
      const afterColon = trimmed.split(':').slice(1).join(':').trim()
      return afterColon !== ''
    })
    .join('\n')

  // Si falta el nombre del cliente: "¡Hola !" → "¡Hola!"
  result = result.replace(/[ \t]+([!?.,])/g, '$1')
  result = result.replace(/\n{3,}/g, '\n\n').trim()

  return result
}