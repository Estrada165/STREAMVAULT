import { supabase } from '@/lib/supabase'

export const PAY_METHODS = ['Yape', 'Plin', 'Transferencia', 'Binance', 'Efectivo', 'Otro']

/** Lee un número de un texto como "S/ 60" o "$15.50" */
export function parseAmount(text) {
  const m = String(text || '').replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return m ? m[1] : ''
}
export function currencyOf(text) { return /\$|usd/i.test(String(text || '')) ? 'USD' : 'PEN' }
export const money = (n, cur = 'PEN') => (cur === 'USD' ? '$' : 'S/ ') + (parseFloat(n) || 0).toFixed(2)

/** Nueva fecha de vencimiento al sumar/restar días (si ya venció, cuenta desde hoy) */
export function nextExpiry(expiresAt, days) {
  const current = expiresAt ? new Date(expiresAt) : new Date()
  const base = current > new Date() ? current : new Date()
  base.setDate(base.getDate() + parseInt(days || 0))
  return base < new Date() ? new Date() : base
}

/** Suma (o resta) días de acceso a un proveedor. Al sumar, queda activo junto con su cuenta. */
export async function extendProviderAccess(provider, days) {
  const d = parseInt(days)
  const { error } = await supabase.from('providers').update({
    expires_at: nextExpiry(provider.expires_at, d).toISOString(),
    is_active: d > 0 ? true : provider.is_active,
  }).eq('id', provider.id)
  if (error) throw error
  if (d > 0) await supabase.from('users').update({ is_active: true }).eq('id', provider.user_id)
}

/** Registra un cobro de renovación */
export async function registerPayment({ providerId, amount, currency = 'PEN', days = 0, method = null, note = null, paidAt = null }) {
  const { error } = await supabase.from('provider_payments').insert({
    provider_id: providerId, amount: parseFloat(amount) || 0, currency, days_added: parseInt(days) || 0,
    method: method || null, note: note?.trim() || null, paid_at: paidAt || new Date().toISOString(),
  })
  if (error) throw new Error(error.message?.includes('provider_payments') ? 'Falta ejecutar el SQL 008 en Supabase.' : error.message)
}
