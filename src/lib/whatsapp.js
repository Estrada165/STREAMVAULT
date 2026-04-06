import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Builds a WhatsApp URL with pre-filled message from a template
 */
export function buildWhatsAppUrl(phone, template, variables) {
  const message = fillTemplate(template, variables)
  const cleanPhone = phone.replace(/\D/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

/**
 * Replaces {variable} placeholders in template, removing empty lines
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
    '{id_pedido}': variables.orderCode || '',
  }

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value)
  }

  // Remove lines that only contain an emoji + empty value
  result = result
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      // Remove lines like "📧 Correo: " or "👤 Perfil: " with nothing after colon
      const afterColon = trimmed.split(':').slice(1).join(':').trim()
      if (trimmed.includes(':') && afterColon === '') return false
      return true
    })
    .join('\n')

  // Clean up multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

/**
 * Default template
 */
export const DEFAULT_TEMPLATE = `🎬 *Hola {nombre_cliente}!*

Tu acceso a *{plataforma}* ya está listo 🚀

📧 Correo: {correo}
🔑 Contraseña: {contrasena}
👤 Perfil: {perfil}
🔢 PIN: {pin}
🌐 URL: {url}
🔐 Código: {codigo}

⏳ Duración: {duracion} días
📅 Vence: {fecha_vencimiento}
🆔 Pedido: {id_pedido}

Ante cualquier problema escríbeme 🙌`
