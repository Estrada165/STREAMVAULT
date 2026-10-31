// Mensajes de vencimiento y renovación (se envían por WhatsApp con waLink)
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function daysLeft(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - new Date()) / 86400000)
}

export function whenText(days) {
  if (days === null) return 'está por vencer'
  if (days < 0) return `venció hace ${-days} día${days === -1 ? '' : 's'}`
  if (days === 0) return 'vence hoy'
  if (days === 1) return 'vence mañana'
  return `vence en ${days} días`
}

const fmtDate = d => (d ? format(new Date(d), "d 'de' MMMM", { locale: es }) : '')

/** Recordatorio para el cliente final. Sin precios ni credenciales ni códigos internos. */
export function clientReminder({ clientName, platformName, expiresAt }) {
  const days = daysLeft(expiresAt)
  const date = fmtDate(expiresAt)
  return (
    `👋 ¡Hola${clientName ? ` *${clientName}*` : ''}!\n\n` +
    `⏳ Tu acceso a *${platformName || 'tu plataforma'}* ${whenText(days)}${date ? ` (${date})` : ''}.\n\n` +
    (days !== null && days < 0
      ? '🔄 ¿Lo reactivamos? Respóndeme este mensaje y te lo dejo listo al toque.\n\n'
      : '🔄 ¿Lo renovamos? Respóndeme este mensaje y te lo dejo listo, sin cortes.\n\n') +
    '¡Gracias por tu preferencia! 🙌'
  )
}

/** Pedido de renovación del distribuidor a su proveedor (aquí sí van código y costo) */
export function providerRenewal({ orderCode, productName, email, expiresAt, costUsd, exchangeRate = 3.5 }) {
  const days = daysLeft(expiresAt)
  const cost = parseFloat(costUsd) || 0
  return (
    `🔄 ¡Hola! Quiero renovar un pedido.\n\n` +
    `🆔 Pedido: *${orderCode}*\n` +
    `📺 Producto: *${productName || '—'}*\n` +
    (email ? `📧 Cuenta: ${email}\n` : '') +
    `⏳ Estado: ${whenText(days)}\n` +
    (cost ? `💰 Costo: *S/ ${(cost * exchangeRate).toFixed(2)}* (~$${cost.toFixed(2)})\n` : '') +
    `\n¿Me ayudas con la renovación? ¡Gracias! 🙌`
  )
}

// ---- Marcas locales de "ya avisé a este cliente" (solo en este navegador) ----
const KEY = 'sv-reminded'
function readMarks() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
export function getReminded(orderId) { return readMarks()[orderId] || null }
export function markReminded(orderId) {
  try {
    const m = readMarks()
    m[orderId] = new Date().toISOString()
    // conserva solo los últimos 300
    const entries = Object.entries(m).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 300)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {}
}
