import { useLocation } from 'react-router-dom'
import { rpcError } from '@/lib/rpcError'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader, Modal, Alert, Spinner, Badge, Tabs, PageLoader, EmptyState, useToast } from '@/components/ui'
import { PlatformLogo } from '@/utils/platform'
import { IconSearch, IconDownload, IconEdit, IconRefreshCw, IconCopy, IconTrash, IconWhatsApp, IconX, IconTrendingUp } from '@/assets/icons'
import { formatUSD, formatDateTime, formatDate, getStatusLabel } from '@/utils'
import { waLink } from '@/lib/whatsapp'

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
      title="Copiar" aria-label="Copiar"
      className={`p-1 rounded-md flex-shrink-0 transition-colors ${copied ? 'text-[var(--a)]' : 'text-[var(--ink-faint)] hover:text-[var(--ink)]'}`}
    >
      {copied
        ? <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <IconCopy size={12} />}
    </button>
  )
}

const STATUS_BADGE = { activo: 'green', pendiente_credenciales: 'violet', expirado: 'neutral', cancelado: 'red' }

export default function ProveedorVentas() {
  const { provider } = useAuth()
  const { settings } = useSettings()
  const toast = useToast()
  const [visible, setVisible] = useState(40)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const location = useLocation()
  const [tab, setTab] = useState(location.state?.tab || 'all')
  const [modal, setModal] = useState(null)
  const [renewModal, setRenewModal] = useState(null)
  const [renewDays, setRenewDays] = useState(30)
  const [renewBalance, setRenewBalance] = useState(null)
  const [credsForm, setCredsForm] = useState({ email: '', password: '', url: '', profile_name: '', profile_pin: '', activation_code: '', extra_notes: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { if (provider) fetchOrders() }, [provider])

  async function fetchOrders() {
    // Sin vaciar la lista: los datos se actualizan en su lugar (sin parpadeo)
    try { await supabase.rpc('mark_expired_orders') } catch (_) {}

    const { data: products } = await supabase
      .from('products').select('id, delivery_type').eq('provider_id', provider.id)
    if (!products?.length) { setLoading(false); return }
    const ids = products.map(p => p.id)
    const dtMap = {}
    products.forEach(p => { dtMap[p.id] = p.delivery_type })

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, order_code, status, price_paid, expires_at, created_at, client_name, client_whatsapp, product_id, stock_item_id, distributor_id')
      .in('product_id', ids)
      .order('created_at', { ascending: false })

    if (!ordersData?.length) { setOrders([]); setLoading(false); return }

    const productIds = [...new Set(ordersData.map(o => o.product_id))]
    const userIds = [...new Set(ordersData.map(o => o.distributor_id))]
const stockIds = [...new Set(ordersData.map(o => o.stock_item_id).filter(id => id && typeof id === 'string' && id.length > 0))]

// Supabase tiene límite de URL — hacer el query en lotes de 100
let allStocks = []
if (stockIds.length > 0) {
  const chunkSize = 100
  for (let i = 0; i < stockIds.length; i += chunkSize) {
    const chunk = stockIds.slice(i, i + chunkSize)
    const { data: chunkData } = await supabase
      .from('stock_items').select('*').in('id', chunk)
    if (chunkData) allStocks = allStocks.concat(chunkData)
  }
}

const [{ data: prods }, { data: users }] = await Promise.all([
  supabase.from('products').select('id, name, is_renewable, renewal_price_usd, platforms(name, logo_filename)').in('id', productIds),
  supabase.from('users').select('id, full_name, email, phone').in('id', userIds),
])

const stocks = allStocks


    const prodsMap = {}; prods?.forEach(p => { prodsMap[p.id] = p })
    const usersMap = {}; users?.forEach(u => { usersMap[u.id] = u })
    const stockMap = {}; stocks?.forEach(s => { stockMap[s.id] = s })

    setOrders(ordersData.map(o => ({
      ...o,
      delivery_type: dtMap[o.product_id],
      products: prodsMap[o.product_id] || null,
      user: usersMap[o.distributor_id] || null,
      stock_item: stockMap[o.stock_item_id] || null,
    })))
    setLoading(false)
  }

  function openCredentials(order) {
    const si = order.stock_item
    setCredsForm({
      email: si?.email || '', password: si?.password || '', url: si?.url || '',
      profile_name: si?.profile_name || '', profile_pin: si?.profile_pin || '',
      activation_code: si?.activation_code || '', extra_notes: si?.extra_notes || '',
    })
    setSaveError('')
    setModal(order)
  }

  async function saveCredentials() {
    setSaving(true); setSaveError('')
    try {
      const dt = modal.delivery_type
      const payload = {
        email: dt !== 'activacion_tv' ? credsForm.email || null : null,
        password: dt !== 'activacion_tv' ? credsForm.password || null : null,
        url: dt === 'iptv' ? credsForm.url || null : null,
        profile_name: dt === 'perfil' ? credsForm.profile_name || null : null,
        profile_pin: dt === 'perfil' ? credsForm.profile_pin || null : null,
        activation_code: dt === 'codigo' ? credsForm.activation_code || null : null,
        extra_notes: credsForm.extra_notes || null,
      }
      if (modal.stock_item_id) {
        const { error: err } = await supabase.from('stock_items').update(payload).eq('id', modal.stock_item_id)
        if (err) throw err
      } else {
        const { data: si, error: siErr } = await supabase.from('stock_items').insert({
          ...payload, product_id: modal.product_id, is_sold: true,
          sold_at: new Date().toISOString(), order_id: modal.id,
        }).select().single()
        if (siErr) throw siErr

        // Usar duration_days del producto, fallback 30
        const { data: prod } = await supabase
          .from('products').select('duration_days').eq('id', modal.product_id).single()
        const durationDays = prod?.duration_days || 30

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + durationDays)
        const { error: oErr } = await supabase.from('orders').update({
          stock_item_id: si.id, status: 'activo', expires_at: expiresAt.toISOString(),
        }).eq('id', modal.id)
        if (oErr) throw oErr
      }
      await supabase.from('notifications').insert({
        user_id: modal.distributor_id,
        title: modal.stock_item_id ? 'Credenciales actualizadas' : 'Credenciales disponibles',
        message: `Tu pedido ${modal.order_code} ya tiene credenciales actualizadas. Revisa tus pedidos.`,
        type: 'success', ref_id: modal.id,
      })
      setModal(null); fetchOrders()
      toast.success('Credenciales guardadas y distribuidor notificado')
    } catch (e) { setSaveError(e.message) }
    setSaving(false)
  }

  async function openRenew(order) {
    setRenewDays(30); setSaveError('')
    const { data: bal } = await supabase
      .from('balances').select('amount_usd').eq('user_id', order.distributor_id).maybeSingle()
    setRenewBalance(parseFloat(bal?.amount_usd || 0))
    setRenewModal(order)
  }

  function getRenewalCost(order) {
    const prod = order.products
    if (prod?.is_renewable && prod?.renewal_price_usd && parseFloat(prod.renewal_price_usd) > 0) {
      return parseFloat(prod.renewal_price_usd)
    }
    return parseFloat(order.price_paid)
  }

  async function confirmRenew() {
    const cost = getRenewalCost(renewModal)
    if (renewBalance < cost) return setSaveError(`Saldo insuficiente. El distribuidor tiene ${formatUSD(renewBalance)} y el costo es ${formatUSD(cost)}.`)
    setSaving(true); setSaveError('')
    try {
      // Cobro + nueva fecha + movimiento + aviso en un solo paso (el costo lo calcula la base de datos)
      const { error: rpcErr } = await supabase.rpc('renew_order', { p_order: renewModal.id, p_days: parseInt(renewDays), p_charge: true })
      if (rpcErr) throw new Error(rpcError(rpcErr))
      setRenewModal(null); fetchOrders()
      toast.success(`Renovado por ${renewDays} días`)
    } catch (e) { setSaveError(e.message) }
    setSaving(false)
  }

  const [deleteModal, setDeleteModal] = useState(null) // orden a eliminar
  const [deleting, setDeleting] = useState(false)

  // ── Liberar a stock (devuelve credenciales al inventario, borra la orden) ──
  async function releaseToStock(order) {
    setDeleting(true)
    try {
      if (order.stock_item_id) {
        await supabase.from('stock_items')
          .update({ is_sold: false, sold_at: null, order_id: null })
          .eq('id', order.stock_item_id)
      }
      await supabase.from('support_tickets').delete().eq('order_id', order.id)
      await supabase.from('orders').delete().eq('id', order.id)
      setOrders(prev => prev.filter(o => o.id !== order.id))
      setDeleteModal(null)
      toast.success('Pedido eliminado')
    } catch (e) { toast.error('Error: ' + e.message) }
    setDeleting(false)
  }

  // ── Eliminar permanente (borra orden Y stock item) ──
  async function deletePermanent(order) {
    setDeleting(true)
    try {
      await supabase.from('support_tickets').delete().eq('order_id', order.id)
      await supabase.from('orders').delete().eq('id', order.id)
      if (order.stock_item_id) {
        await supabase.from('stock_items').delete().eq('id', order.stock_item_id)
      }
      setOrders(prev => prev.filter(o => o.id !== order.id))
      setDeleteModal(null)
      toast.success('Pedido eliminado')
    } catch (e) { toast.error('Error: ' + e.message) }
    setDeleting(false)
  }

  function exportCSV() {
    const rows = [['Pedido', 'Producto', 'Distribuidor', 'Cliente', 'Correo plataforma', 'Precio', 'Estado', 'Fecha']]
    filtered.forEach(o => rows.push([
      o.order_code, o.products?.name, o.user?.full_name || o.user?.email,
      o.client_name, o.stock_item?.email || '', o.price_paid, o.status,
      new Date(o.created_at).toLocaleDateString('es-PE')
    ]))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = 'ventas.csv'; a.click()
  }

  const q = search.toLowerCase()
  const filtered = orders
    .filter(o => tab === 'all' || o.status === tab)
    .filter(o =>
      (o.order_code || '').toLowerCase().includes(q) ||
      (o.client_name || '').toLowerCase().includes(q) ||
      (o.products?.name || '').toLowerCase().includes(q) ||
      (o.user?.full_name || '').toLowerCase().includes(q) ||
      (o.user?.email || '').toLowerCase().includes(q) ||
      (o.stock_item?.email || '').toLowerCase().includes(q)
    )

  const totalRevenue = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + parseFloat(o.price_paid), 0)
  const pendingCount = orders.filter(o => o.status === 'pendiente_credenciales').length

  const dt = modal?.delivery_type
  const showEmail = ['cuenta_completa', 'perfil', 'iptv'].includes(dt)
  const showPassword = ['cuenta_completa', 'perfil', 'iptv'].includes(dt)
  const showUrl = dt === 'iptv'
  const showProfile = dt === 'perfil'
  const showCode = dt === 'codigo'

  if (loading) return <PageLoader />

  const rate = parseFloat(settings?.exchange_rate) || 3.5

  // Datos derivados por pedido (estado real, vence pronto, aviso por WhatsApp)
  function meta(o) {
    const isReallyExpired = o.status === 'activo' && o.expires_at && new Date(o.expires_at) < new Date()
    const displayStatus = isReallyExpired ? 'expirado' : o.status
    const expiresSoon = o.status === 'activo' && o.expires_at && !isReallyExpired && (new Date(o.expires_at) - new Date()) < 3 * 864e5
    const canDelete = o.status === 'expirado' || o.status === 'cancelado' || isReallyExpired
    let waUrl = null
    if (expiresSoon && o.user?.phone) {
      const phone = o.user.phone.replace(/\D/g, '')
      const daysLeft = Math.ceil((new Date(o.expires_at) - new Date()) / 864e5)
      const costPen = (parseFloat(o.products?.renewal_price_usd || o.price_paid) * rate).toFixed(2)
      const msg =
        `Hola *${o.client_name || o.user?.full_name || 'cliente'}*!\n\n` +
        `Tu acceso a *${o.products?.name}* vence ${daysLeft <= 1 ? 'hoy' : `en *${daysLeft} dias*`}.\n\n` +
        (o.stock_item?.email ? `Correo: ${o.stock_item.email}\n` : '') +
        (o.stock_item?.password ? `Contrasena: ${o.stock_item.password}\n` : '') +
        `\nCosto de renovacion: *S/ ${costPen}*\n\n` +
        `Para renovar, contactanos. Gracias!`
      waUrl = waLink(phone, msg)
    }
    return { isReallyExpired, displayStatus, expiresSoon, canDelete, waUrl }
  }

  function Actions({ o, m }) {
    const pending = o.status === 'pendiente_credenciales'
    return (
      <div className="flex items-center gap-1.5 justify-end flex-wrap">
        <button onClick={() => openCredentials(o)} className={`btn-sm ${pending ? 'btn-primary' : 'btn-secondary'}`}>
          <IconEdit size={13} />{pending ? 'Cargar' : 'Editar'}
        </button>
        {(o.status === 'activo' || o.status === 'expirado' || m.isReallyExpired) && (
          <button onClick={() => openRenew(o)} className="btn-accent btn-sm btn-icon" title="Renovar" aria-label="Renovar"><IconRefreshCw size={14} /></button>
        )}
        {m.waUrl && (
          <a href={m.waUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm btn-icon !text-[var(--status-yellow)]" title="Avisar renovación por WhatsApp" aria-label="Avisar renovación por WhatsApp"><IconWhatsApp size={14} /></a>
        )}
        {m.canDelete && (
          <button onClick={() => setDeleteModal(o)} className="btn-secondary btn-sm btn-icon hover:!text-[var(--status-red)]" title="Eliminar pedido" aria-label="Eliminar pedido"><IconTrash size={14} /></button>
        )}
      </div>
    )
  }

  function Expiry({ o, m }) {
    if (!o.expires_at) return <span className="text-xs text-[var(--ink-faint)]">Sin fecha</span>
    return (
      <span className={`text-xs font-medium ${m.isReallyExpired ? 'text-[var(--status-red)]' : m.expiresSoon ? 'text-[var(--status-yellow)]' : 'text-[var(--ink-muted)]'}`}>
        {m.isReallyExpired ? 'Venció ' : 'Vence '}{formatDate(o.expires_at)}
        {m.expiresSoon && <span className="ml-1.5 dot inline-block align-middle animate-pulse-soft" />}
      </span>
    )
  }

  const shown = filtered.slice(0, visible)

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={`${orders.length} pedidos · ${formatUSD(totalRevenue)} en ingresos`}
        action={<button className="btn-secondary" onClick={exportCSV}><IconDownload size={15} />Exportar CSV</button>}
      />

      {pendingCount > 0 && (
        <button onClick={() => setTab('pendiente_credenciales')} className="w-full mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-left border bg-[var(--b-soft)] border-[var(--b-line)] text-[var(--ink)] animate-slide-up hover:brightness-105">
          <span className="dot dot-glow animate-pulse-soft" style={{ color: 'var(--b)' }} />
          <span className="flex-1"><strong>{pendingCount} pedido{pendingCount > 1 ? 's' : ''} esperando credenciales.</strong> <span className="text-[var(--ink-muted)]">Tócalo para verlos y cargarlas.</span></span>
          <span className="text-[var(--b)] font-semibold">Ver →</span>
        </button>
      )}

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
          <input className="input input-icon" placeholder="Pedido, cliente, producto, distribuidor o correo" value={search} onChange={e => { setSearch(e.target.value); setVisible(40) }} aria-label="Buscar ventas" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1.5" aria-label="Limpiar"><IconX size={14} /></button>}
        </label>
        <Tabs tabs={[
          { label: 'Todos', value: 'all', count: orders.length },
          { label: 'Activos', value: 'activo' },
          { label: 'Pendientes', value: 'pendiente_credenciales', count: pendingCount },
          { label: 'Expirados', value: 'expirado' },
        ]} active={tab} onChange={v => { setTab(v); setVisible(40) }} />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={IconTrendingUp} title="Sin resultados" description={search ? `Nada coincide con "${search}".` : 'No hay pedidos en esta categoría.'} /></div>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="table-wrapper hidden lg:block">
            <table>
              <thead>
                <tr><th>Producto</th><th>Distribuidor · cliente</th><th>Precio</th><th>Estado</th><th className="!text-right">Acciones</th></tr>
              </thead>
              <tbody>
                {shown.map(o => {
                  const m = meta(o)
                  return (
                    <tr key={o.id}>
                      <td className="max-w-[320px]">
                        <div className="flex items-center gap-3">
                          <PlatformLogo name={o.products?.platforms?.name} filename={o.products?.platforms?.logo_filename} size={36} />
                          <div className="min-w-0">
                            <p className="font-medium text-[13.5px] truncate">{o.products?.name}</p>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="font-mono text-[11px] text-[var(--ink-faint)] truncate">{o.stock_item?.email || o.order_code}</span>
                              <CopyBtn value={o.stock_item?.email} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[220px]">
                        <p className="text-[13px] truncate">{o.user?.full_name || o.user?.email}</p>
                        <p className="text-xs text-[var(--ink-faint)] truncate">{o.client_name || 'Sin cliente'} · {formatDateTime(o.created_at)}</p>
                      </td>
                      <td><span className="font-mono">{formatUSD(o.price_paid)}</span></td>
                      <td>
                        <Badge color={STATUS_BADGE[m.displayStatus] || 'neutral'} dot>{getStatusLabel(m.displayStatus)}</Badge>
                        <div className="mt-1"><Expiry o={o} m={m} /></div>
                      </td>
                      <td><Actions o={o} m={m} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Móvil y tablet: tarjetas */}
          <div className="lg:hidden space-y-3">
            {shown.map(o => {
              const m = meta(o)
              return (
                <article key={o.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <PlatformLogo name={o.products?.platforms?.name} filename={o.products?.platforms?.logo_filename} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[14.5px] text-[var(--ink)] truncate">{o.products?.name}</p>
                        <span className="font-mono text-sm flex-shrink-0">{formatUSD(o.price_paid)}</span>
                      </div>
                      <p className="text-xs text-[var(--ink-muted)] truncate">{o.user?.full_name || o.user?.email} → {o.client_name || 'sin cliente'}</p>
                      {o.stock_item?.email && (
                        <div className="flex items-center gap-1 mt-0.5 min-w-0">
                          <span className="font-mono text-[11px] text-[var(--ink-faint)] truncate">{o.stock_item.email}</span>
                          <CopyBtn value={o.stock_item.email} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-[var(--surface-border)]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={STATUS_BADGE[m.displayStatus] || 'neutral'} dot>{getStatusLabel(m.displayStatus)}</Badge>
                      <Expiry o={o} m={m} />
                    </div>
                    <Actions o={o} m={m} />
                  </div>
                </article>
              )
            })}
          </div>

          {visible < filtered.length && (
            <div className="flex flex-col items-center gap-2 mt-5">
              <button className="btn-secondary" onClick={() => setVisible(v => v + 40)}>Mostrar más</button>
              <p className="text-xs text-[var(--ink-faint)]">Mostrando {shown.length} de {filtered.length}</p>
            </div>
          )}
        </>
      )}

      {/* Modal credenciales */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal?.stock_item_id ? 'Editar' : 'Cargar'} credenciales`}
        subtitle={modal ? `${modal.products?.name} · ${modal.order_code}` : ''}
        maxWidth="max-w-md"
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={saveCredentials} disabled={saving} className="btn-primary min-w-[160px]">{saving ? <Spinner size={15} /> : 'Guardar y notificar'}</button>
        </>}
      >
        {modal && (
          <div className="space-y-4">
            <div className="inset px-3.5 py-2.5 text-[13px] text-[var(--ink-muted)]">
              Cliente: <span className="text-[var(--ink)] font-medium">{modal.client_name || '—'}</span>{modal.client_whatsapp ? ` · ${modal.client_whatsapp}` : ''}
            </div>
            {showEmail && <div><label className="label">Correo</label><input className="input font-mono" placeholder="correo@ejemplo.com" value={credsForm.email} onChange={e => setCredsForm(f => ({ ...f, email: e.target.value }))} /></div>}
            {showPassword && <div><label className="label">Contraseña</label><input className="input font-mono" placeholder="contraseña" value={credsForm.password} onChange={e => setCredsForm(f => ({ ...f, password: e.target.value }))} /></div>}
            {showUrl && <div><label className="label">URL</label><input className="input font-mono !text-[13px]" placeholder="http://..." value={credsForm.url} onChange={e => setCredsForm(f => ({ ...f, url: e.target.value }))} /></div>}
            {showProfile && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Perfil</label><input className="input" placeholder="Perfil 1" value={credsForm.profile_name} onChange={e => setCredsForm(f => ({ ...f, profile_name: e.target.value }))} /></div>
                <div><label className="label">PIN</label><input className="input font-mono" placeholder="1234" value={credsForm.profile_pin} onChange={e => setCredsForm(f => ({ ...f, profile_pin: e.target.value }))} /></div>
              </div>
            )}
            {showCode && <div><label className="label">Código</label><input className="input font-mono" placeholder="XXXX-XXXX" value={credsForm.activation_code} onChange={e => setCredsForm(f => ({ ...f, activation_code: e.target.value }))} /></div>}
            {dt === 'activacion_tv' && <Alert type="info">Activación TV: pide al cliente el código de su televisor e ingrésalo en la nota.</Alert>}
            <div>
              <label className="label">Nota para el distribuidor (opcional)</label>
              <textarea className="input" rows={2} placeholder="Instrucciones adicionales..." value={credsForm.extra_notes} onChange={e => setCredsForm(f => ({ ...f, extra_notes: e.target.value }))} />
            </div>
            {saveError && <Alert type="error">{saveError}</Alert>}
          </div>
        )}
      </Modal>

      {/* Modal renovar */}
      <Modal open={!!renewModal} onClose={() => { setRenewModal(null); setSaveError('') }} title="Renovar pedido" subtitle={renewModal ? `${renewModal.products?.name} · ${renewModal.order_code}` : ''} maxWidth="max-w-sm">
        {renewModal && (() => {
          const cost = getRenewalCost(renewModal)
          const hasDiff = renewModal.products?.is_renewable && renewModal.products?.renewal_price_usd &&
            parseFloat(renewModal.products.renewal_price_usd) !== parseFloat(renewModal.price_paid)
          const canRenew = renewBalance >= cost
          const newDate = (() => {
            const base = renewModal.expires_at && new Date(renewModal.expires_at) > new Date() ? new Date(renewModal.expires_at) : new Date()
            base.setDate(base.getDate() + parseInt(renewDays))
            return formatDate(base.toISOString())
          })()
          return (
            <div className="space-y-4">
              <div className="inset px-3.5 py-3 text-[13px] text-[var(--ink-muted)] space-y-0.5">
                <p>Cliente: <span className="text-[var(--ink)]">{renewModal.client_name || '—'}</span></p>
                {renewModal.expires_at && <p>Vence: <span className="text-[var(--ink)]">{formatDate(renewModal.expires_at)}</span></p>}
              </div>
              {hasDiff && <Alert type="success">Precio de renovación: <strong>{formatUSD(cost)}</strong> (original {formatUSD(renewModal.price_paid)})</Alert>}

              <div>
                <p className="label">Días a agregar</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[7, 15, 30, 60, 90].map(d => (
                    <button key={d} onClick={() => setRenewDays(d)} className={`btn-secondary btn-sm !px-0 ${parseInt(renewDays) === d ? 'is-down !text-[var(--a)]' : ''}`}>{d}</button>
                  ))}
                </div>
                <p className="text-xs text-[var(--ink-faint)] mt-2">Nueva fecha: <span className="text-[var(--ink)] font-medium">{newDate}</span></p>
              </div>

              <div className={`grid grid-cols-2 rounded-xl border overflow-hidden ${canRenew ? 'border-[var(--a-line)]' : 'border-[var(--status-red-border)]'}`}>
                <div className={`p-3 ${canRenew ? 'bg-[var(--a-soft)]' : 'bg-[var(--status-red-bg)]'}`}>
                  <p className="eyebrow !text-[10px]">Saldo distribuidor</p>
                  <p className={`font-mono text-lg mt-1 ${canRenew ? 'text-[var(--a)]' : 'text-[var(--status-red)]'}`}>{formatUSD(renewBalance)}</p>
                </div>
                <div className="p-3 text-right">
                  <p className="eyebrow !text-[10px]">Costo</p>
                  <p className="font-mono text-lg mt-1 text-[var(--ink)]">{formatUSD(cost)}</p>
                </div>
              </div>
              {!canRenew && <Alert type="error">Saldo insuficiente. Recárgale saldo al distribuidor primero.</Alert>}
              {saveError && <Alert type="error">{saveError}</Alert>}
              <div className="flex gap-2.5">
                <button onClick={() => { setRenewModal(null); setSaveError('') }} className="btn-ghost flex-1 justify-center">Cancelar</button>
                <button onClick={confirmRenew} disabled={saving || !canRenew} className="btn-primary flex-[2]">{saving ? <Spinner size={15} /> : `Renovar · ${formatUSD(cost)}`}</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Modal eliminar */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="¿Qué hacemos con este pedido?" subtitle={deleteModal ? `${deleteModal.products?.name} · ${deleteModal.order_code}` : ''} maxWidth="max-w-sm">
        {deleteModal && (
          <div className="space-y-3">
            <button onClick={() => releaseToStock(deleteModal)} disabled={deleting} className="w-full text-left flex items-start gap-3 p-4 rounded-2xl border border-[var(--a-line)] bg-[var(--a-soft)] hover:brightness-105 transition">
              <span className="w-9 h-9 rounded-xl grid place-items-center bg-[var(--a)] text-white flex-shrink-0">{deleting ? <Spinner size={15} /> : <IconRefreshCw size={16} />}</span>
              <span>
                <span className="block font-semibold text-sm text-[var(--a)]">Devolver al stock</span>
                <span className="block text-xs text-[var(--ink-muted)] leading-relaxed mt-0.5">Las credenciales vuelven a estar a la venta. El pedido se elimina.</span>
              </span>
            </button>
            <button onClick={() => deletePermanent(deleteModal)} disabled={deleting} className="w-full text-left flex items-start gap-3 p-4 rounded-2xl border border-[var(--status-red-border)] bg-[var(--status-red-bg)] hover:brightness-105 transition">
              <span className="w-9 h-9 rounded-xl grid place-items-center bg-[var(--status-red)] text-white flex-shrink-0">{deleting ? <Spinner size={15} /> : <IconTrash size={15} />}</span>
              <span>
                <span className="block font-semibold text-sm text-[var(--status-red)]">Eliminar para siempre</span>
                <span className="block text-xs text-[var(--ink-muted)] leading-relaxed mt-0.5">Borra el pedido y sus credenciales. No se puede recuperar.</span>
              </span>
            </button>
            <button onClick={() => setDeleteModal(null)} className="btn-ghost w-full justify-center">Cancelar</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
