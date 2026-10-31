// =====================================================================
// Asistente de la tienda — SIN inteligencia artificial.
// Responde con reglas y únicamente con datos reales de la tienda:
// productos, precios, stock, garantías, métodos de pago y las preguntas
// frecuentes que configure el proveedor. Si no sabe algo, lo dice.
// =====================================================================

export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const has = (t, re) => re.test(t)

// Apodos comunes de cada plataforma (se suman al nombre real que tenga el producto)
const ALIASES = {
  netflix: ['netflix', 'nf', 'netflis', 'neflix'],
  disney: ['disney', 'disney plus', 'disneyplus', 'dsny'],
  max: ['max', 'hbo', 'hbo max', 'hbomax'],
  prime: ['prime', 'prime video', 'amazon', 'amazon prime'],
  spotify: ['spotify', 'spoti', 'spotfy'],
  youtube: ['youtube', 'yt', 'youtube premium', 'yutub'],
  crunchyroll: ['crunchyroll', 'crunchy', 'crunchi'],
  paramount: ['paramount', 'paramount plus'],
  chatgpt: ['chatgpt', 'chat gpt', 'gpt', 'openai'],
  canva: ['canva'],
  iptv: ['iptv', 'tv en vivo', 'canales'],
  vix: ['vix'],
  apple: ['apple tv', 'appletv'],
  star: ['star plus', 'star+'],
}

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'por', 'para', 'con', 'que', 'mi', 'me', 'tu', 'es', 'del', 'al', 'se', 'lo', 'como', 'cual', 'cuanto', 'cuanta', 'hay', 'quiero'])

export const fmtPEN = (usd, rate) => 'S/ ' + ((parseFloat(usd) || 0) * rate).toFixed(2)
export const fmtUSD = usd => '$' + (parseFloat(usd) || 0).toFixed(2)
export function durationLabel(d) {
  if (d >= 360) { const y = Math.round(d / 365); return `${y} año${y > 1 ? 's' : ''}` }
  if (d >= 30 && d % 30 === 0) { const m = d / 30; return `${m} mes${m > 1 ? 'es' : ''}` }
  return `${d} días`
}

/** Prepara el catálogo para buscar rápido */
export function buildIndex(products) {
  const platforms = {}
  for (const p of products) {
    const name = p.platformName || 'Otros'
    const key = norm(name)
    if (!platforms[key]) {
      const pats = new Set([key, key.replace(/\+/g, '').trim(), key.replace(/\+/g, ' plus').trim()])
      for (const [base, list] of Object.entries(ALIASES)) if (key.includes(base) || list.some(a => key === a)) list.forEach(a => pats.add(a))
      const first = key.split(' ')[0]
      if (first.length >= 4) pats.add(first)
      platforms[key] = { key, name, logo: p.logo_filename, patterns: [...pats].filter(Boolean), products: [] }
    }
    platforms[key].products.push(p)
  }
  return { platforms: Object.values(platforms) }
}

function findPlatforms(t, index) {
  const tt = ' ' + t.replace(/\+/g, ' plus ') + ' '
  return index.platforms.filter(pl => pl.patterns.some(a => new RegExp(`(^|[^a-z0-9])${esc(a.replace(/\+/g, ' plus '))}([^a-z0-9]|$)`).test(tt)))
}

function parseDuration(t) {
  let m
  if ((m = t.match(/(\d+)\s*(mes|meses)\b/))) return parseInt(m[1]) * 30
  if ((m = t.match(/(\d+)\s*(dia|dias)\b/))) return parseInt(m[1])
  if ((m = t.match(/(\d+)\s*(ano|anos)\b/))) return parseInt(m[1]) * 365
  if (/\b(anual|un ano|1 ano|por ano)\b/.test(t)) return 365
  if (/\bsemestr/.test(t)) return 180
  if (/\btrimestr/.test(t)) return 90
  if (/\b(mensual|un mes|por mes)\b/.test(t)) return 30
  return null
}

function parseBudget(t, rate) {
  const num = s => parseFloat(s.replace(',', '.'))
  let m
  if ((m = t.match(/(?:s\/\.?|soles?|lucas|pen)\s*(\d+(?:[.,]\d+)?)/)) || (m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:soles?|lucas|s\/|pen)\b/)))
    return { usd: num(m[1]) / rate, pen: num(m[1]), cur: 'PEN' }
  if ((m = t.match(/(?:\$|usd|dolares?)\s*(\d+(?:[.,]\d+)?)/)) || (m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:\$|usd|dolares?)/)))
    return { usd: num(m[1]), pen: num(m[1]) * rate, cur: 'USD' }
  if ((m = t.match(/\b(?:tengo|presupuesto|cuento con|me alcanza|alcanza con|con)\s*(?:solo\s*)?(\d+(?:[.,]\d+)?)\b(?!\s*(?:mes|dia|ano|perfil|cuenta|pantalla))/)))
    return { usd: num(m[1]) / rate, pen: num(m[1]), cur: 'PEN' }
  return null
}

function parseType(t) {
  if (/\bperfil(es)?\b/.test(t)) return 'perfil'
  if (/\b(cuenta completa|completa|cuenta entera|toda la cuenta)\b/.test(t)) return 'cuenta_completa'
  return null
}

const INTENTS = {
  greet: /^(hola|holi|buenas|buenos|buen dia|hey|que tal|saludos)\b/,
  thanks: /\b(gracias|grax|genial|perfecto|ok gracias|listo)\b/,
  recharge: /\b(recarg\w*|yape\w*|plin|deposit\w*|transfer\w*|pagar|pago|pagos|abon\w*|cargar saldo|metodos? de pago|binance|qr|numero de cuenta|cuenta bancaria|como pago)\b/,
  buy: /\b(compr\w*|adquir\w*|carrito|hacer un pedido|como pido|como hago un pedido)\b/,
  renew: /\b(renov\w*|vencid\w*|vence\w*|extender|ampliar)\b/,
  warranty: /\bgarantia\w*\b/,
  terms: /\b(termino\w*|condicion\w*|reglas?|politicas?)\b/,
  includes: /\b(incluye\w*|trae|contiene|que viene|beneficios?|que tiene)\b/,
  stock: /\b(stock|disponib\w*|quedan?|agotad\w*|hay)\b/,
  compare: /\b(compar\w*|conviene|diferencia|mejor|mas barato|barato|economic\w*|ahorr\w*|vs|versus)\b/,
  price: /\b(precios?|cuanto|cuesta|vale|costo|tarifa|sale)\b/,
  balance: /\b(mi saldo|cuanto tengo|saldo)\b/,
  support: /\b(soporte|problema\w*|falla\w*|no funciona|no entra|no carga|contrasena incorrecta|clave incorrecta|reclamo|ticket|caid\w*|error|me botaron|cambiaron la clave)\b/,
  contact: /\b(whatsapp|contacto|contactar|hablar con|asesor|humano|persona real|numero del proveedor|llamar)\b/,
  catalog: /\b(catalogo|que venden|que tienen|que plataformas|productos|lista|todo lo que)\b/,
  send: /\b(enviar|mandar|pasar)\b.*\b(cliente|credenciales|cuenta)\b|\bcredenciales\b/,
}

function intentsOf(t) {
  const out = {}
  for (const [k, re] of Object.entries(INTENTS)) if (has(t, re)) out[k] = true
  return out
}

/** Preguntas frecuentes del proveedor: "palabras clave" separadas por coma */
function matchFaq(t, faqs = []) {
  let best = null, bestScore = 0
  for (const f of faqs) {
    if (!f?.q || !f?.a) continue
    const keys = String(f.q).split(/[,;\n]/).map(norm).filter(Boolean)
    let score = 0
    for (const k of keys) {
      if (k.length < 3) continue
      if (t.includes(k)) score += k.split(' ').length + 1
      else {
        const words = k.split(' ').filter(w => w.length > 3 && !STOP.has(w))
        const hits = words.filter(w => t.includes(w)).length
        if (words.length && hits === words.length) score += 1
      }
    }
    if (score > bestScore) { best = f; bestScore = score }
  }
  return bestScore >= 2 ? best : null
}

const available = p => (p.delivery_mode === 'pedido' ? p.stock_qty !== 0 : (p.stock || 0) > 0)
const perMonth = p => p.price_usd / Math.max(1, p.duration_days / 30)

function sortForList(list) {
  return [...list].sort((a, b) => Number(available(b)) - Number(available(a)) || a.duration_days - b.duration_days || a.price_usd - b.price_usd)
}

// ---------- Bloques de respuesta (los dibuja la pantalla del asistente) ----------
const T = text => ({ type: 'text', text })
const chips = list => ({ type: 'chips', chips: list.filter(Boolean).slice(0, 5) })

function stepsRecharge(ctx) {
  const m = ctx.methods
  return [
    T(m.length ? `Recargar es rápido. Tu proveedor recibe pagos por **${m.map(x => x.label).join(', ')}**:` : 'Tu proveedor aún no configuró métodos de pago. Escríbele por WhatsApp para coordinar.'),
    m.length && { type: 'steps', steps: [
      'Toca **Recargar** (en la tienda o junto a tu saldo, en el menú).',
      'Elige el método de pago y escribe cuánto quieres recargar. Te mostramos el monto en soles.',
      'Transfiere al titular y número que aparecen (puedes copiarlos con un toque).',
      'Toca **Avisar al proveedor**: se abre WhatsApp con el detalle. Envía tu comprobante ahí.',
      'Cuando tu proveedor confirme, el saldo se carga solo y lo ves en **Mi saldo**.',
    ] },
    m.length && { type: 'methods', methods: m },
    { type: 'actions', actions: [{ label: 'Recargar ahora', to: '/tienda?recargar=1', primary: true }, { label: 'Ver mi saldo', to: '/saldo' }] },
  ].filter(Boolean)
}

function stepsBuy() {
  return [
    T('Así compras una cuenta para tu cliente:'),
    { type: 'steps', steps: [
      'En la **Tienda**, toca **Agregar** en el producto (o **Pedir** si es a pedido).',
      'Ve al **Carrito** y revisa el total. Se descuenta de tu saldo.',
      'Toca **Confirmar compra** y escribe el nombre y WhatsApp de tu cliente.',
      'Las credenciales aparecen al instante en **Mis pedidos** (los productos "a pedido" llegan cuando tu proveedor las cargue).',
      'Desde el pedido, toca **Enviar** para mandárselas a tu cliente por WhatsApp con tu plantilla.',
    ] },
    { type: 'actions', actions: [{ label: 'Ir a la tienda', to: '/tienda', primary: true }, { label: 'Mis pedidos', to: '/dashboard' }] },
  ]
}

function stepsRenew() {
  return [
    T('Para renovar un acceso:'),
    { type: 'steps', steps: [
      'Entra a **Mis pedidos**. Arriba verás **Vencen pronto** con los que están por vencer.',
      'Toca **Recordar** para avisarle a tu cliente por WhatsApp (sin precios ni datos internos).',
      'Toca **Renovar** para pedírselo a tu proveedor: el mensaje ya lleva el código del pedido y el costo.',
      'Cuando tu proveedor lo renueva, la nueva fecha aparece en el pedido.',
    ] },
    { type: 'actions', actions: [{ label: 'Ver mis pedidos', to: '/dashboard', primary: true }] },
  ]
}

function stepsSupport(ctx) {
  return [
    T('Si una cuenta falla, repórtalo así:'),
    { type: 'steps', steps: [
      'En **Mis pedidos**, busca el pedido con el problema.',
      'Toca el ícono de **soporte** (audífonos) y elige el motivo: contraseña incorrecta, perfil ocupado, etc.',
      'Tu proveedor recibe el ticket y te responde en **Soporte**. Si cambia las credenciales, se actualizan en el pedido.',
    ] },
    { type: 'actions', actions: [{ label: 'Ir a soporte', to: '/soporte', primary: true }, ctx.provider?.whatsapp_support && { label: 'Escribir al proveedor', wa: ctx.provider.whatsapp_support }].filter(Boolean) },
  ]
}

function productDetail(field, label, products) {
  const withText = products.filter(p => p[field])
  if (!withText.length) return [T(`Tu proveedor no registró **${label.toLowerCase()}** para ${products.length === 1 ? 'este producto' : 'estos productos'}. Puedes preguntarle por WhatsApp.`)]
  // Agrupa textos iguales para no repetir
  const groups = {}
  withText.forEach(p => { const k = p[field].trim(); (groups[k] = groups[k] || []).push(p) })
  return Object.entries(groups).slice(0, 4).map(([text, ps]) => ({ type: 'detail', title: label, products: ps.map(p => p.name), text }))
}

const TYPE_LABEL = { perfil: 'Perfil', cuenta_completa: 'Cuenta completa', iptv: 'IPTV', activacion_tv: 'Activación TV', codigo: 'Código' }
const typeName = p => (p.delivery_type === 'otro' && p.custom_delivery_type) || TYPE_LABEL[p.delivery_type] || p.delivery_type

function compareBlock(products, ctx) {
  const types = new Set(products.map(p => p.delivery_type))
  const rows = [...products].sort((a, b) => a.delivery_type.localeCompare(b.delivery_type) || a.duration_days - b.duration_days || a.price_usd - b.price_usd)
  // Ahorro: contra el plan más corto del MISMO tipo
  const base = {}
  rows.forEach(p => { const k = p.delivery_type; if (!base[k] || p.duration_days < base[k].duration_days) base[k] = p })
  return {
    type: 'compare',
    rows: rows.map(p => {
      const b = base[p.delivery_type]
      return {
        product: p,
        duration: types.size > 1 ? `${durationLabel(p.duration_days)} · ${typeName(p)}` : durationLabel(p.duration_days),
        price: fmtPEN(p.price_usd, ctx.rate), priceUsd: fmtUSD(p.price_usd),
        perMonth: fmtPEN(perMonth(p), ctx.rate),
        saving: p !== b && b.duration_days !== p.duration_days ? Math.round((1 - perMonth(p) / perMonth(b)) * 100) : null,
        available: available(p),
      }
    }),
  }
}

// Temas para "combo de anime", "combo de música", etc. (palabras que aparecen en el nombre de la plataforma)
const THEMES = [
  { re: /\b(anime|otaku|manga)\b/, label: 'anime', match: ['crunchy', 'hidive', 'funimation', 'anime'] },
  { re: /\b(musica|canciones|playlist|podcast)\b/, label: 'música', match: ['spotify', 'youtube', 'deezer', 'tidal', 'apple music', 'music'] },
  { re: /\b(pelis?|peliculas?|series?|cine)\b/, label: 'películas y series', match: ['netflix', 'disney', 'max', 'hbo', 'prime', 'paramount', 'vix', 'star', 'apple tv', 'mubi'] },
  { re: /\b(deportes?|futbol|partidos?|liga|champions|f1)\b/, label: 'deportes', match: ['max', 'hbo', 'disney', 'star', 'espn', 'iptv', 'dazn', 'paramount', 'fanatiz'] },
  { re: /\b(ninos?|infantil|familia|familiar|peques?)\b/, label: 'familia', match: ['disney', 'netflix', 'youtube'] },
  { re: /\b(trabajo|estudio|estudiar|productividad|diseno|oficina|ia)\b/, label: 'trabajo y estudio', match: ['chatgpt', 'gpt', 'canva', 'office', 'microsoft', 'gemini', 'capcut'] },
  { re: /\b(tv en vivo|canales|television)\b/, label: 'TV en vivo', match: ['iptv', 'tv'] },
]
function parseTheme(t) { return THEMES.find(x => x.re.test(t)) || null }
const inTheme = (p, theme) => theme.match.some(m => norm(p.platformName).includes(m))
function parseComboSize(t) {
  const m = t.match(/\b(\d|dos|tres|cuatro)\s*(plataformas|servicios|cuentas|streamings?)\b/)
  if (!m) return null
  return { dos: 2, tres: 3, cuatro: 4 }[m[1]] || Math.min(4, Math.max(2, parseInt(m[1])))
}

/**
 * Combos dentro de un presupuesto, sin saturar:
 * - toma la opción más barata de cada plataforma (máx. 12 plataformas)
 * - prueba combinaciones de 2 a 4, ordena por cuánto aprovechan el presupuesto
 * - elige 3 bien distintas entre sí; "más combos" muestra las siguientes 3
 */
function bestCombos(can, budgetUsd, { size = null, theme = null, page = 0 } = {}) {
  const byPlatform = {}
  can.forEach(p => { const k = norm(p.platformName); if (!byPlatform[k] || p.price_usd < byPlatform[k].price_usd) byPlatform[k] = p })
  let base = Object.values(byPlatform).sort((a, b) => a.price_usd - b.price_usd)
  // Con tema: si hay 2+ plataformas del tema, solo esas; si hay 1, cada combo la incluye
  const themed = theme ? base.filter(p => inTheme(p, theme)) : []
  const mustInclude = theme && themed.length === 1 ? themed[0] : null
  if (theme && themed.length >= 2) base = themed
  base = base.slice(0, 12)
  const n = base.length, all = []
  const sizes = size ? [size] : [2, 3, 4]
  const walk = (start, pick, total) => {
    if (sizes.includes(pick.length) && (!mustInclude || pick.includes(mustInclude))) all.push({ items: [...pick], total })
    if (pick.length === Math.max(...sizes)) return
    for (let i = start; i < n; i++) {
      const t = total + base[i].price_usd
      if (t > budgetUsd + 1e-9) break // ordenado por precio: los siguientes también se pasan
      pick.push(base[i]); walk(i + 1, pick, t); pick.pop()
    }
  }
  walk(0, [], 0)
  const score = c => c.total / budgetUsd * 10 + (size ? 0 : c.items.length * 2)
  all.sort((a, b) => score(b) - score(a))
  // Selección variada: penaliza repetir plataformas ya mostradas
  const chosen = [], used = new Map()
  const pool = [...all]
  while (pool.length && chosen.length < (page + 1) * 3) {
    let bi = 0, bs = -Infinity
    pool.forEach((c, i) => { const s = score(c) - c.items.reduce((x, p) => x + (used.get(p.id) || 0), 0) * 3; if (s > bs) { bs = s; bi = i } })
    const [c] = pool.splice(bi, 1)
    chosen.push(c); c.items.forEach(p => used.set(p.id, (used.get(p.id) || 0) + 1))
  }
  return { combos: chosen.slice(page * 3, page * 3 + 3), total: all.length, hasMore: all.length > (page + 1) * 3 }
}

function budgetAnswer(budget, pool, ctx, opts = {}) {
  const { platformsAsked = false, theme = null, size = null, page = 0, wantsCombo = false } = opts
  const can = pool.filter(p => available(p) && p.price_usd <= budget.usd + 1e-9)
  const money = `S/ ${budget.pen.toFixed(2)}`
  const head = `Con **${money}** (${fmtUSD(budget.usd)})`
  if (!can.length) {
    const cheapest = pool.filter(available).sort((a, b) => a.price_usd - b.price_usd)[0]
    return [T(`${head} no alcanza para ${platformsAsked || theme ? 'eso' : 'ningún producto disponible'}.` + (cheapest ? ` Lo más económico es **${cheapest.name}** a **${fmtPEN(cheapest.price_usd, ctx.rate)}**.` : '')),
      cheapest && { type: 'products', products: [cheapest] }].filter(Boolean)
  }
  const { combos, total, hasMore } = bestCombos(theme ? ctx.products.filter(p => available(p) && p.price_usd <= budget.usd + 1e-9) : can, budget.usd, { size, theme, page })
  const out = []
  if (combos.length) {
    out.push(T(page
      ? `Otras ${combos.length} opciones de combo con **${money}**:`
      : `${head} hay **${total}** combinaci${total === 1 ? 'ón' : 'ones'} posible${total === 1 ? '' : 's'}${theme ? ` de ${theme.label}` : ''}. Te muestro ${combos.length === 1 ? 'la que mejor aprovecha' : `las ${combos.length} que mejor aprovechan`} tu presupuesto:`))
    out.push({ type: 'combos', combos: combos.map(c => ({ items: c.items, total: c.total, left: budget.usd - c.total })) })
  } else if (wantsCombo || theme) {
    out.push(T(`${head} no alcanza para un combo${theme ? ` de ${theme.label}` : ''}, pero sí para un producto:`))
  }
  if (!page) {
    if (combos.length) out.push(T('O un solo producto:'))
    else if (!wantsCombo && !theme) out.push(T(`${head} te alcanza para:`))
    const themed = theme ? can.filter(p => inTheme(p, theme)) : []
    out.push({ type: 'products', products: [...(themed.length ? themed : can)].sort((a, b) => b.price_usd - a.price_usd).slice(0, 3) })
  }
  out.push(chips([hasMore && `Más combos con ${money}`, '¿Cómo recargo?', !page && 'Ver catálogo']))
  return out
}

/**
 * Responde a un mensaje. ctx = { products, methods, rate, provider, balance, config }
 * Devuelve una lista de bloques.
 */
export function answer(input, ctx, index = buildIndex(ctx.products)) {
  const t = norm(input)
  if (!t) return [T('Escribe tu pregunta 🙂')]
  const it = intentsOf(t)
  const plats = findPlatforms(t, index)
  const duration = parseDuration(t)
  const type = parseType(t)
  const budget = parseBudget(t, ctx.rate)
  const faq = matchFaq(t, ctx.config?.faqs)

  // 1. Preguntas frecuentes configuradas por el proveedor
  if (faq && !budget && !plats.length) return [T(faq.a), chips(['Ver precios', '¿Cómo recargo?'])]

  // 2. Presupuesto: "tengo 20 soles", "combo de anime con S/ 25", "más combos con S/ 20"
  const theme = parseTheme(t)
  const wantsCombo = /\bcombos?\b|\bpack\b|\bpaquete\b/.test(t)
  if (budget) {
    let pool = plats.length ? plats.flatMap(p => p.products) : ctx.products
    if (duration) pool = pool.filter(p => Math.abs(p.duration_days - duration) <= 5)
    if (type) pool = pool.filter(p => p.delivery_type === type)
    const page = /\b(mas|otros?)\s+combos?\b/.test(t) ? 1 : 0
    return budgetAnswer(budget, pool, ctx, { platformsAsked: plats.length > 0, theme: plats.length ? null : theme, size: parseComboSize(t), page, wantsCombo })
  }
  // Combo o tema sin presupuesto: mostrar opciones y pedir el monto
  if ((wantsCombo || theme) && !plats.length) {
    const pool = (theme ? ctx.products.filter(p => inTheme(p, theme)) : ctx.products).filter(available)
    if (theme && !pool.length) return [T(`Esta tienda no tiene plataformas de **${theme.label}** por ahora.`), chips(['Ver catálogo'])]
    return [
      T(`${theme ? `Para **${theme.label}** hay esto` : 'Puedo armarte un combo'}. Dime tu presupuesto y te digo qué combinación te alcanza, por ejemplo: "${theme ? 'combo de ' + theme.label : 'combo'} con S/ 25".`),
      theme && { type: 'products', products: sortForList(pool).slice(0, 4) },
      chips([`${theme ? 'Combo de ' + theme.label : 'Combo'} con S/ 20`, `${theme ? 'Combo de ' + theme.label : 'Combo'} con S/ 40`]),
    ].filter(Boolean)
  }

  if (it.greet && Object.keys(it).length === 1 && !plats.length) return [T(ctx.config?.welcome || welcomeText(ctx)), chips(SUGGESTIONS(ctx))]
  if (it.thanks && Object.keys(it).length <= 2 && !plats.length) return [T('¡Con gusto! Si necesitas algo más, aquí estoy.'), chips(SUGGESTIONS(ctx))]

  // 3. Producto(s) mencionados
  if (plats.length) {
    let products = plats.flatMap(p => p.products)
    if (duration) { const f = products.filter(p => Math.abs(p.duration_days - duration) <= 5); if (f.length) products = f }
    if (type) { const f = products.filter(p => p.delivery_type === type); if (f.length) products = f }
    products = sortForList(products)
    const name = plats.map(p => p.name).join(' y ')
    const out = []
    if (it.warranty) out.push(...productDetail('warranty', 'Garantía', products))
    if (it.terms) out.push(...productDetail('terms', 'Términos y condiciones', products))
    if (it.includes) out.push(...productDetail('what_includes', '¿Qué incluye?', products))
    if (out.length) return [...out, chips([`Precios de ${plats[0].name}`, '¿Cómo compro?'])]

    if (it.stock && !it.price) {
      const av = products.filter(available)
      return [T(av.length ? `De **${name}** hay disponible:` : `**${name}** está agotado por ahora. Tu proveedor puede reponer pronto.`),
        { type: 'products', products: av.length ? av : products.slice(0, 3) }, chips([`Comparar ${plats[0].name}`, '¿Cómo compro?'])]
    }

    // Comparar cuando hay varias duraciones del mismo tipo (o si lo pide)
    const multiDuration = Object.values(products.reduce((m, p) => { (m[p.delivery_type] = m[p.delivery_type] || new Set()).add(p.duration_days); return m }, {})).some(set => set.size > 1)
    if ((it.compare || multiDuration) && products.length > 1) {
      return [
        T(`Así se comparan los planes de **${name}**. "Por mes" te dice cuál conviene más:`),
        compareBlock(products, ctx),
        { type: 'products', products: products.slice(0, 6) },
        chips([`Garantía de ${plats[0].name}`, `¿Qué incluye ${plats[0].name}?`, '¿Cómo compro?']),
      ]
    }
    return [
      T(products.length === 1 ? `Esto es lo que hay de **${name}**:` : `Encontré **${products.length}** opciones de **${name}**:`),
      { type: 'products', products: products.slice(0, 6) },
      chips([`Garantía de ${plats[0].name}`, `Términos de ${plats[0].name}`, '¿Cómo compro?']),
    ]
  }

  // 4. Guías paso a paso
  if (it.recharge) return [...stepsRecharge(ctx), chips(['¿Cómo compro?', 'Mi saldo'])]
  if (it.support) return [...stepsSupport(ctx), chips(['¿Cómo renuevo?'])]
  if (it.renew) return [...stepsRenew(), chips(['¿Cómo recargo?'])]
  if (it.buy || it.send) return [...stepsBuy(), chips(['¿Cómo recargo?', 'Ver catálogo'])]
  if (it.balance) return [
    T(ctx.balance === null || ctx.balance === undefined ? 'Tu saldo aparece en el menú y en **Mi saldo**.' : `Tienes **${fmtUSD(ctx.balance)}** (≈ ${fmtPEN(ctx.balance, ctx.rate)}).`),
    { type: 'actions', actions: [{ label: 'Ver movimientos', to: '/saldo', primary: true }, { label: 'Recargar', to: '/tienda?recargar=1' }] },
  ]
  if (it.contact) return [
    T(ctx.provider?.whatsapp_support ? `Puedes escribirle a **${ctx.provider.display_name || 'tu proveedor'}** por WhatsApp:` : 'Tu proveedor aún no registró un WhatsApp de contacto.'),
    ctx.provider?.whatsapp_support && { type: 'actions', actions: [{ label: 'Abrir WhatsApp', wa: ctx.provider.whatsapp_support, primary: true }] },
  ].filter(Boolean)
  if (faq) return [T(faq.a), chips(['Ver precios', '¿Cómo recargo?'])]

  // 5. Catálogo general / comparaciones sin plataforma
  if (it.catalog || it.price || it.compare || it.stock) return catalogAnswer(index, ctx, it.compare)

  // 6. No sabe: lo dice
  return [
    T('No encontré eso en la información de esta tienda. Prueba preguntando por una plataforma ("precio de Netflix"), un presupuesto ("tengo 20 soles") o una guía ("¿cómo recargo?").'),
    chips(SUGGESTIONS(ctx)),
    ctx.provider?.whatsapp_support && { type: 'actions', actions: [{ label: 'Preguntarle a mi proveedor', wa: ctx.provider.whatsapp_support }] },
  ].filter(Boolean)
}

function catalogAnswer(index, ctx, cheapestFirst) {
  const rows = index.platforms.map(pl => {
    const av = pl.products.filter(available)
    const from = (av.length ? av : pl.products).reduce((m, p) => (p.price_usd < m.price_usd ? p : m))
    const best = (av.length ? av : pl.products).reduce((m, p) => (perMonth(p) < perMonth(m) ? p : m))
    return { name: pl.name, logo: pl.logo, from, count: pl.products.length, available: av.length > 0, bestMonth: perMonth(best),
      sub: cheapestFirst ? `${fmtPEN(perMonth(best), ctx.rate)} al mes` : `desde ${fmtPEN(from.price_usd, ctx.rate)}` }
  }).sort((a, b) => Number(b.available) - Number(a.available) || (cheapestFirst ? a.bestMonth - b.bestMonth : a.name.localeCompare(b.name)))
  return [
    T(cheapestFirst ? 'Plataformas ordenadas por el mejor precio mensual. Toca una para ver sus planes:' : `La tienda tiene **${rows.length}** plataformas. Toca una para ver sus planes:`),
    { type: 'platforms', rows },
  ]
}

export function welcomeText(ctx) {
  return `¡Hola! Soy ${ctx.config?.name || 'el asistente'} de ${ctx.provider?.display_name || 'la tienda'}. Te ayudo con precios, comparaciones, qué te alcanza según tu presupuesto, recargas y compras.`
}

export const SUGGESTIONS = ctx => {
  const firstPlat = ctx.products.find(p => available(p))?.platformName
  return [
    firstPlat && `Precios de ${firstPlat}`,
    'Tengo S/ 20, ¿qué me alcanza?',
    '¿Cómo recargo?',
    'Lo más barato por mes',
    '¿Cómo compro?',
  ].filter(Boolean)
}
