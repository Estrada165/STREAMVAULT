// StreamVault · Bot de códigos (servidor)
// Habla con el StreamPanel de cada proveedor usando su clave «spk_…».
// Lo usa api/codebot.js (función de Vercel). Nunca corre en el navegador.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SUPABASE_URL (o VITE_SUPABASE_URL)   · URL del proyecto
//   SUPABASE_SERVICE_ROLE_KEY            · service_role key (¡secreta! sin VITE_)
//   STREAMPANEL_API_URL                  · ej. https://tu-backend.up.railway.app/api
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const env = (k) => (process.env[k] || '').trim()
let _db = null
export function db() {
  if (_db) return _db
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw Object.assign(new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.'), { status: 503, code: 'NOT_CONFIGURED' })
  _db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return _db
}
const spBase = () => {
  const u = env('STREAMPANEL_API_URL').replace(/\/+$/, '')
  if (!u) throw Object.assign(new Error('Falta configurar STREAMPANEL_API_URL en Vercel.'), { status: 503, code: 'NOT_CONFIGURED' })
  return u
}

const fail = (status, message, code) => Object.assign(new Error(message), { status, code })

/* ── Llamada a StreamPanel ──────────────────────────────── */
async function sp(token, method, path, body) {
  try {
    const r = await fetch(`${spBase()}/integration/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
    })
    let data = null
    try { data = await r.json() } catch { data = {} }
    return { ok: r.ok, status: r.status, data }
  } catch (e) {
    if (e.code === 'NOT_CONFIGURED') throw e
    return { ok: false, status: 0, data: { message: 'No se pudo conectar con StreamPanel. Intenta en un momento.', code: 'NETWORK' } }
  }
}

/* ── Quién llama ────────────────────────────────────────── */
async function whoAmI(authHeader) {
  const jwt = String(authHeader || '').replace(/^Bearer\s+/i, '')
  if (!jwt) throw fail(401, 'Inicia sesión de nuevo', 'NO_SESSION')
  const { data, error } = await db().auth.getUser(jwt)
  if (error || !data?.user) throw fail(401, 'Tu sesión venció. Inicia sesión de nuevo', 'NO_SESSION')
  const uid = data.user.id
  const { data: me } = await db().from('users').select('id, role, provider_id, full_name, is_active').eq('id', uid).maybeSingle()
  if (!me) throw fail(403, 'Usuario no encontrado', 'NO_USER')
  let provider = null
  if (me.role === 'proveedor') {
    const { data: p } = await db().from('providers').select('id, display_name').eq('user_id', uid).maybeSingle()
    provider = p || null
  }
  return { uid, role: me.role, me, provider }
}

const getLink = async (providerId) =>
  (await db().from('codebot_links').select('provider_id, token, panel_name, link_base').eq('provider_id', providerId).maybeSingle()).data || null

async function markLink(providerId, ok, error) {
  const patch = ok ? { last_ok_at: new Date().toISOString(), last_error: null } : { last_error: String(error || '').slice(0, 240) }
  await db().from('codebot_links').update(patch).eq('provider_id', providerId)
}

/* ── Sincronizar un pedido ──────────────────────────────── */
const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 32)

async function saveRow(order, providerId, patch) {
  const row = { order_id: order.id, provider_id: providerId, distributor_id: order.distributor_id || null, updated_at: new Date().toISOString(), ...patch }
  const { data, error } = await db().from('order_code_access').upsert(row, { onConflict: 'order_id' }).select().single()
  if (error) throw error
  return data
}

// Estado deseado → StreamPanel. Devuelve la fila de order_code_access (o null si el producto no usa bot).
async function syncOne({ order, product, stock, distributor, row, link, providerId }) {
  const bot = product?.code_bot
  const enabled = !!(bot?.enabled && bot.platform_id)
  const email = (stock?.email || '').trim()
  const alive = order && order.status === 'activo' && (!order.expires_at || new Date(order.expires_at) > new Date())

  // Debe estar activo
  if (enabled && alive && email) {
    if (!link) return saveRow(order, providerId, { status: 'error', error: 'El proveedor no tiene conectado su StreamPanel', error_code: 'NOT_CONNECTED', attempts: (row?.attempts || 0) + 1 })
    const payload = {
      email,
      platformId: bot.platform_id,
      expiresAt: order.expires_at || null,
      allowedTypes: Array.isArray(bot.types) ? bot.types : [],
      label: order.client_name || (distributor?.full_name ? `Cliente de ${distributor.full_name}` : 'Cliente StreamVault'),
      phone: order.client_whatsapp || null,
      meta: {
        orderCode: order.order_code, productName: product.name, deliveryType: product.delivery_type, days: product.duration_days || null,
        store: distributor?.full_name || null, storePhone: distributor?.phone || null, clientName: order.client_name || null,
      },
    }
    const h = hash(payload)
    if (row?.status === 'active' && row.synced_hash === h && row.link) return row   // ya está al día
    const r = await sp(link.token, 'PUT', `/access/${order.id}`, payload)
    if (r.ok) {
      await markLink(providerId, true)
      return saveRow(order, providerId, { status: 'active', code: r.data.code, link: r.data.link, error: null, error_code: null, synced_hash: h, attempts: 0 })
    }
    if (r.status === 401) await markLink(providerId, false, r.data?.message)
    return saveRow(order, providerId, {
      status: 'error', error: r.data?.message || 'Error de StreamPanel', error_code: r.data?.code || `HTTP_${r.status}`,
      attempts: (row?.attempts || 0) + 1, synced_hash: null,
    })
  }

  // Debe estar inactivo (vencido, anulado, borrado, sin correo o bot apagado)
  if (!row) return null
  if (row.status === 'revoked') return row
  if (!link || !row.code) return saveRow(order || { id: row.order_id, distributor_id: row.distributor_id }, providerId, { status: 'revoked', synced_hash: null })
  const r = await sp(link.token, 'DELETE', `/access/${row.order_id}`)
  if (r.ok) return saveRow(order || { id: row.order_id, distributor_id: row.distributor_id }, providerId, { status: 'revoked', error: null, error_code: null, synced_hash: null })
  return saveRow(order || { id: row.order_id, distributor_id: row.distributor_id }, providerId, {
    status: row.status, error: r.data?.message || 'No se pudo desactivar en StreamPanel', error_code: r.data?.code || `HTTP_${r.status}`,
    attempts: (row.attempts || 0) + 1,
  })
}

// Varios pedidos a la vez (máx. 4 en paralelo para no saturar StreamPanel)
async function syncMany(ctx, orderIds) {
  const ids = [...new Set(orderIds)].slice(0, 200)
  if (!ids.length) return {}
  const { data: orders } = await db().from('orders')
    .select('id, order_code, distributor_id, product_id, stock_item_id, client_name, client_whatsapp, status, expires_at')
    .in('id', ids)
  const { data: rows } = await db().from('order_code_access').select('*').in('order_id', ids)
  const rowBy = new Map((rows || []).map(r => [r.order_id, r]))
  const orderBy = new Map((orders || []).map(o => [o.id, o]))

  const productIds = [...new Set((orders || []).map(o => o.product_id))]
  const { data: products } = productIds.length
    ? await db().from('products').select('id, name, provider_id, delivery_type, duration_days, code_bot').in('id', productIds) : { data: [] }
  const prodBy = new Map((products || []).map(p => [p.id, p]))

  const stockIds = (orders || []).map(o => o.stock_item_id).filter(Boolean)
  const { data: stock } = stockIds.length ? await db().from('stock_items').select('id, email').in('id', stockIds) : { data: [] }
  const stockBy = new Map((stock || []).map(s => [s.id, s]))

  const distIds = [...new Set((orders || []).map(o => o.distributor_id))]
  const { data: dists } = distIds.length ? await db().from('users').select('id, full_name, phone').in('id', distIds) : { data: [] }
  const distBy = new Map((dists || []).map(d => [d.id, d]))

  // Permisos: cada quien solo sus pedidos
  const allowed = (order, row) => {
    if (ctx.role === 'admin') return true
    const provId = order ? prodBy.get(order.product_id)?.provider_id : row?.provider_id
    if (ctx.role === 'proveedor') return !!ctx.provider && provId === ctx.provider.id
    return order ? order.distributor_id === ctx.uid : row?.distributor_id === ctx.uid
  }

  const links = new Map()
  const linkFor = async (pid) => { if (!links.has(pid)) links.set(pid, await getLink(pid)); return links.get(pid) }

  const out = {}
  const queue = ids.filter(id => {
    const o = orderBy.get(id), r = rowBy.get(id)
    return (o || r) && allowed(o, r)
  })
  async function worker() {
    while (queue.length) {
      const id = queue.shift()
      const order = orderBy.get(id) || null
      const row = rowBy.get(id) || null
      const product = order ? prodBy.get(order.product_id) : null
      const providerId = product?.provider_id || row?.provider_id
      if (!providerId) continue
      try {
        const res = await syncOne({
          order, product, row, providerId,
          stock: order?.stock_item_id ? stockBy.get(order.stock_item_id) : null,
          distributor: order ? distBy.get(order.distributor_id) : null,
          link: await linkFor(providerId),
        })
        if (res) out[id] = pick(res)
      } catch (e) { out[id] = { status: 'error', error: e.message } }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return out
}

const pick = (r) => ({ status: r.status, code: r.code, link: r.link, error: r.error, error_code: r.error_code, updated_at: r.updated_at })

// Pedidos que conviene revisar (para «sincronizar todo» al abrir una pantalla)
async function pendingOrderIds(ctx) {
  const ids = new Set()
  // Filas con algo pendiente o activas cuyo pedido pudo cambiar
  let q = db().from('order_code_access').select('order_id, status, updated_at').in('status', ['pending', 'error', 'active']).limit(300)
  if (ctx.role === 'proveedor') q = q.eq('provider_id', ctx.provider?.id || '00000000-0000-0000-0000-000000000000')
  else if (ctx.role !== 'admin') q = q.eq('distributor_id', ctx.uid)
  const { data: rows } = await q
  ;(rows || []).forEach(r => ids.add(r.order_id))

  // Pedidos activos de productos con bot que aún no tienen fila
  let pq = db().from('products').select('id').not('code_bot', 'is', null).filter('code_bot->>enabled', 'eq', 'true')
  if (ctx.role === 'proveedor') pq = pq.eq('provider_id', ctx.provider?.id || '00000000-0000-0000-0000-000000000000')
  const { data: prods } = await pq.limit(500)
  const pids = (prods || []).map(p => p.id)
  if (pids.length) {
    let oq = db().from('orders').select('id').in('product_id', pids).eq('status', 'activo').order('created_at', { ascending: false }).limit(300)
    if (ctx.role !== 'admin' && ctx.role !== 'proveedor') oq = oq.eq('distributor_id', ctx.uid)
    const { data: ords } = await oq
    const known = new Set((rows || []).map(r => r.order_id))
    ;(ords || []).forEach(o => { if (!known.has(o.id)) ids.add(o.id) })
  }
  return [...ids]
}

/* ── Acciones ───────────────────────────────────────────── */
export async function handle(authHeader, body = {}) {
  const ctx = await whoAmI(authHeader)
  const action = body.action
  const needProvider = () => { if (ctx.role !== 'proveedor' || !ctx.provider) throw fail(403, 'Solo para proveedores', 'FORBIDDEN'); return ctx.provider }

  if (action === 'connect') {
    const p = needProvider()
    const token = String(body.token || '').trim()
    if (!/^spk_[A-Za-z0-9_-]{20,}$/.test(token)) throw fail(400, 'Esa clave no parece de StreamPanel. Debe empezar con spk_', 'BAD_TOKEN')
    const r = await sp(token, 'GET', '/me')
    if (!r.ok) throw fail(r.status === 401 ? 400 : 502, r.data?.message || 'StreamPanel rechazó la clave', r.data?.code || 'SP_ERROR')
    const { error } = await db().from('codebot_links').upsert({
      provider_id: p.id, token, panel_name: r.data.provider?.name || null, link_base: r.data.linkBase || null,
      connected_at: new Date().toISOString(), last_ok_at: new Date().toISOString(), last_error: null,
    }, { onConflict: 'provider_id' })
    if (error) throw error
    // Los pedidos activos que ya existían también reciben su acceso
    const synced = await syncMany(ctx, await pendingOrderIds(ctx))
    return { connected: true, panel_name: r.data.provider?.name || null, synced: Object.keys(synced).length }
  }

  if (action === 'disconnect') {
    const p = needProvider()
    await db().from('codebot_links').delete().eq('provider_id', p.id)
    return { connected: false }
  }

  if (action === 'platforms' || action === 'check') {
    const p = needProvider()
    const link = await getLink(p.id)
    if (!link) throw fail(409, 'Primero conecta tu StreamPanel en Configuración', 'NOT_CONNECTED')
    const r = action === 'platforms'
      ? await sp(link.token, 'GET', '/platforms')
      : await sp(link.token, 'POST', '/check', { emails: (body.emails || []).slice(0, 500), platformId: body.platformId || null })
    if (!r.ok) {
      if (r.status === 401) await markLink(p.id, false, r.data?.message)
      throw fail(r.status === 401 ? 409 : 502, r.data?.message || 'Error de StreamPanel', r.data?.code || 'SP_ERROR')
    }
    return r.data
  }

  if (action === 'sync') {
    const ids = body.all ? await pendingOrderIds(ctx) : (Array.isArray(body.orderIds) ? body.orderIds.filter(x => typeof x === 'string') : [])
    return { results: await syncMany(ctx, ids) }
  }

  throw fail(400, 'Acción no válida', 'BAD_ACTION')
}
