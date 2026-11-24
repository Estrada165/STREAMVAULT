// StreamVault · Bot de códigos (StreamPanel) — lado del navegador
// Todo pasa por /api/codebot (función de Vercel): la clave del proveedor nunca llega aquí.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const CODE_TYPE_LABELS = {
  login: 'Inicio de sesión',
  reset: 'Restablecer contraseña',
  travel: 'Modo viaje',
  home: 'Actualizar hogar',
  account: 'Código de 6 dígitos',
}

// Tipos que se marcan solos según cómo vendes la cuenta
// · Perfil: lo justo para entrar (nada que permita cambiar la contraseña)
// · Cuenta completa: también restablecer contraseña
// Los sensibles (código de 6 dígitos) nunca vienen marcados.
export function defaultCodeTypes(deliveryType, platformTypes = []) {
  const ids = platformTypes.filter(t => !t.sensitive).map(t => t.id)
  if (deliveryType === 'perfil') return ids.filter(id => id !== 'reset')
  return ids
}

export async function codebot(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  let res
  try {
    res = await fetch('/api/codebot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    throw Object.assign(new Error('Sin conexión con el servidor'), { code: 'NETWORK' })
  }
  let data = {}
  try { data = await res.json() } catch { /* respuesta vacía */ }
  if (!res.ok) throw Object.assign(new Error(data.message || (res.status === 404 ? 'El servidor del bot aún no está desplegado' : 'Error del servidor')), { code: data.code, status: res.status })
  return data
}

// Pide al servidor que ponga al día los accesos de estos pedidos (no bloquea: si falla, se reintenta después)
export function syncOrders(orderIds) {
  const ids = [].concat(orderIds || []).filter(Boolean)
  if (!ids.length) return Promise.resolve({})
  return codebot('sync', { orderIds: ids }).then(r => r.results || {}).catch(() => ({}))
}

// Tras una compra: la próxima pantalla revisa lo pendiente sin esperar los 3 minutos
export function resetSyncThrottle() { try { sessionStorage.removeItem('sv-codebot-sync') } catch { /* ignore */ } }

// Revisa todo lo pendiente del usuario, como mucho una vez cada 3 minutos por pestaña
export function syncPending() {
  try {
    const last = Number(sessionStorage.getItem('sv-codebot-sync') || 0)
    if (Date.now() - last < 3 * 60 * 1000) return Promise.resolve({})
    sessionStorage.setItem('sv-codebot-sync', String(Date.now()))
  } catch { /* sin sessionStorage: se sincroniza igual */ }
  return codebot('sync', { all: true }).then(r => r.results || {}).catch(() => ({}))
}

// Accesos (enlace de códigos) de una lista de pedidos: { [orderId]: { status, link, code, error } }
export function useOrderAccess(orderIds) {
  const key = (orderIds || []).join(',')
  const [map, setMap] = useState({})
  const load = useCallback(async () => {
    const ids = key ? key.split(',') : []
    if (!ids.length) { setMap({}); return }
    const out = {}
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase.from('order_code_access')
        .select('order_id, status, link, code, error, error_code, updated_at')
        .in('order_id', ids.slice(i, i + 100))
      if (error) break   // SQL 012 aún sin ejecutar: simplemente no hay bot
      ;(data || []).forEach(r => { out[r.order_id] = r })
    }
    setMap(out)
  }, [key])
  useEffect(() => { load() }, [load])
  const merge = useCallback((results) => {
    if (!results || !Object.keys(results).length) return
    setMap(m => { const n = { ...m }; for (const [id, r] of Object.entries(results)) n[id] = { ...(n[id] || {}), order_id: id, ...r }; return n })
  }, [])
  return { access: map, reload: load, merge }
}

// Estado de la conexión del proveedor (sin la clave)
export function useCodebotStatus(enabled = true) {
  const [status, setStatus] = useState(null)   // null = cargando
  const load = useCallback(async () => {
    if (!enabled) return
    const { data, error } = await supabase.rpc('codebot_status')
    setStatus(error ? { connected: false, missingSql: /codebot_status|function|schema cache/i.test(error.message || '') } : (data || { connected: false }))
  }, [enabled])
  useEffect(() => { load() }, [load])
  return { status, reload: load }
}

// Plataformas del StreamPanel del proveedor (con sus tipos de código), en caché por sesión
let platformsCache = null
export async function codebotPlatforms(force = false) {
  if (platformsCache && !force) return platformsCache
  const data = await codebot('platforms')
  platformsCache = Array.isArray(data) ? data : []
  return platformsCache
}
export function clearCodebotCache() { platformsCache = null }

// Sugerencia de plataforma por nombre («Netflix» ↔ «Netflix», «HBO Max» ↔ «Max»…)
export function matchPlatform(list, name) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9+]/g, '')
  const n = norm(name)
  if (!n) return null
  return list.find(p => norm(p.name) === n) || list.find(p => norm(p.name).includes(n) || n.includes(norm(p.name))) || null
}
