// ============================================================
// Marca de la plataforma y colores de cada proveedor
// ============================================================

// Nombre de la plataforma: cámbialo aquí y se actualiza en toda la app.
// (El <title> de la pestaña está en index.html)
export const APP_NAME = { first: 'Stream', second: 'Vault' }
export const APP_FULL_NAME = APP_NAME.first + APP_NAME.second

// "a" = color principal · "b" = color secundario.
// Cada uno con versión para modo claro (l) y oscuro (d), con contraste revisado.
export const BRAND_DUOS = {
  turquesa: { label: 'Turquesa + violeta', a: { l: '#0D9488', d: '#2DD4BF' }, b: { l: '#7C3AED', d: '#A78BFA' } },
  menta:    { label: 'Menta + lila',       a: { l: '#059669', d: '#6EE7B7' }, b: { l: '#9333EA', d: '#D8B4FE' } },
  cian:     { label: 'Cian + índigo',      a: { l: '#0891B2', d: '#67E8F9' }, b: { l: '#4F46E5', d: '#A5B4FC' } },
  azul:     { label: 'Azul + celeste',     a: { l: '#2563EB', d: '#7DA7FF' }, b: { l: '#0891B2', d: '#67E8F9' } },
  rosa:     { label: 'Rosa + violeta',     a: { l: '#DB2777', d: '#F472B6' }, b: { l: '#7C3AED', d: '#C4B5FD' } },
  ambar:    { label: 'Ámbar + coral',      a: { l: '#B45309', d: '#FBBF24' }, b: { l: '#E11D48', d: '#FB7185' } },
}

export const DEFAULT_DUO = 'turquesa'

// Dónde se usa cada color (se muestra al proveedor en Configuración)
export const COLOR_USES = {
  a: ['Relieve del botón principal', 'Opción activa del menú', 'Saldo y montos destacados', 'Stock disponible y estados "activo"', 'Enlaces, foco y casillas activadas'],
  b: ['Insignias de "a pedido" y renovables', 'Contadores de tickets y avisos', 'Segundo tono de los degradados', 'Detalles y líneas de firma'],
}

// ---------- Colores personalizados ----------
// Se guardan en brand_accent como "custom:#RRGGBB:#RRGGBB"
const HEX = /^#[0-9a-f]{6}$/i

export function encodeCustom(a, b) { return `custom:${a.toUpperCase()}:${b.toUpperCase()}` }

export function parseCustom(value) {
  if (typeof value !== 'string' || !value.startsWith('custom:')) return null
  const [, a, b] = value.split(':')
  return HEX.test(a) && HEX.test(b) ? { a, b } : null
}

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase() }
function luminance([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6
  }
  return [h, s, l]
}
function hslToRgb([h, s, l]) {
  if (!s) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const t = x => { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p }
  return [t(h + 1 / 3) * 255, t(h) * 255, t(h - 1 / 3) * 255]
}

/** Ajusta la luminosidad hasta que el color se lea bien sobre el fondo indicado */
function fit(hex, bg, minRatio, dir) {
  let hsl = rgbToHsl(hexToRgb(hex))
  for (let i = 0; i < 40 && contrast(hslToRgb(hsl), bg) < minRatio; i++) {
    hsl = [hsl[0], hsl[1], Math.max(0, Math.min(1, hsl[2] + dir * 0.02))]
  }
  return rgbToHex(...hslToRgb(hsl))
}

/** A partir de un color elegido, genera su versión legible para modo claro y oscuro */
export function deriveTones(hex) {
  return {
    l: fit(hex, [255, 255, 255], 3.6, -1),   // sobre blanco: oscurece si hace falta
    d: fit(hex, [10, 10, 12], 7, +1),        // sobre negro: aclara si hace falta
  }
}

/** Devuelve { a:{l,d}, b:{l,d} } para cualquier valor guardado (dúo o personalizado) */
export function resolveBrand(value) {
  const c = parseCustom(value)
  if (c) return { a: deriveTones(c.a), b: deriveTones(c.b) }
  return BRAND_DUOS[value] || BRAND_DUOS[DEFAULT_DUO]
}

/** Aplica los colores a toda la app (variables CSS en <html>). */
export function applyBrand(value) {
  const duo = resolveBrand(value)
  const s = document.documentElement.style
  s.setProperty('--a-light', duo.a.l)
  s.setProperty('--a-dark', duo.a.d)
  s.setProperty('--b-light', duo.b.l)
  s.setProperty('--b-dark', duo.b.d)
}
