import { formatDistanceToNow, differenceInDays, format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Format USD price */
export function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0)
}

/** Format PEN price */
export function formatPEN(amount) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(amount || 0)
}

/** Convert USD to PEN using exchange rate */
export function usdToPen(usd, rate = 3.5) {
  return usd * rate
}

/** Get logo path from filename */
export function getLogoPath(filename) {
  if (!filename) return null
  return `/logos/${filename}`
}

/** Days remaining from a date */
export function daysRemaining(date) {
  if (!date) return 0
  return differenceInDays(new Date(date), new Date())
}

/** Status color based on days remaining */
export function getDaysColor(days) {
  if (days <= 0) return 'red'
  if (days <= 3) return 'red'
  if (days <= 7) return 'yellow'
  return 'green'
}

/** Format date in Spanish */
export function formatDate(date) {
  if (!date) return '—'
  return format(new Date(date), "d MMM yyyy", { locale: es })
}

/** Format date with time */
export function formatDateTime(date) {
  if (!date) return '—'
  return format(new Date(date), "d MMM yyyy, HH:mm", { locale: es })
}

/** Relative time */
export function timeAgo(date) {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

/** Generate order code display */
export function truncateId(id) {
  if (!id) return ''
  return id.slice(0, 8).toUpperCase()
}

/** Delivery type label */
export function getDeliveryTypeLabel(type) {
  const labels = {
    cuenta_completa: 'Cuenta Completa',
    perfil: 'Perfil',
    iptv: 'IPTV',
    activacion_tv: 'Activación TV',
    codigo: 'Código',
  }
  return labels[type] || type
}

/** Delivery mode label */
export function getDeliveryModeLabel(mode) {
  return mode === 'stock' ? 'En Stock' : 'A Pedido'
}

/** Order status label */
export function getStatusLabel(status) {
  const labels = {
    activo: 'Activo',
    expirado: 'Expirado',
    cancelado: 'Cancelado',
    pendiente_credenciales: 'Pendiente',
  }
  return labels[status] || status
}

/** Order status color */
export function getStatusColor(status) {
  const colors = {
    activo: 'green',
    expirado: 'red',
    cancelado: 'red',
    pendiente_credenciales: 'yellow',
  }
  return colors[status] || 'neutral'
}

/** Support reason label */
export function getReasonLabel(reason) {
  const labels = {
    contrasena_incorrecta: 'Contraseña incorrecta',
    no_da_acceso: 'No da acceso',
    perfil_ocupado: 'Perfil ocupado',
    codigo_invalido: 'Código inválido',
    otro: 'Otro',
  }
  return labels[reason] || reason
}

/** Ticket status color */
export function getTicketStatusColor(status) {
  const colors = {
    abierto: 'red',
    en_revision: 'yellow',
    resuelto: 'green',
  }
  return colors[status] || 'neutral'
}

/** Copy text to clipboard */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Clamp a number between min and max */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}
