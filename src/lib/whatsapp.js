import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const DEFAULT_TEMPLATE = `› Hola {nombre_cliente}

› Tu acceso a {plataforma} está listo

› Has sido unido al grupo familiar

• Correo: {correo}
• Contraseña: {contrasena}
• Perfil: {perfil}
• PIN: {pin}
• URL: {url}
• Código: {codigo}

› Revisa tu correo y acepta la invitación

› Duración: {duracion} días
› Vence: {fecha_vencimiento}
› Pedido: {id_pedido}

› Soporte: Escríbeme ante cualquier problema`

/**
 * Builds a WhatsApp URL with pre-filled message from a template.
 * Falls back to DEFAULT_TEMPLATE if template is empty/null.
 */
export function buildWhatsAppUrl(phone, template, variables) {
  const tpl = (template && template.trim()) ? template : DEFAULT_TEMPLATE
  const message = fillTemplate(tpl, variables)

  const cleanPhone = phone.startsWith('+')
    ? '+' + phone.slice(1).replace(/\D/g, '')
    : phone.replace(/\D/g, '')

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
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
    '{id_pedido}': variables.orderCode || '',
  }

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value)
  }

  // eliminar líneas vacías tipo "Campo:"
  result = result
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      if (!trimmed.includes(':')) return true
      const afterColon = trimmed.split(':').slice(1).join(':').trim()
      return afterColon !== ''
    })
    .join('\n')

  result = result.replace(/\n{3,}/g, '\n\n').trim()

  return result
}