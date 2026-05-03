import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Modal, Alert, Spinner, Badge, Tabs } from '@/components/ui'
import { IconSearch, IconDownload, IconEdit, IconRefreshCw, IconCopy } from '@/assets/icons'
import { formatUSD, formatDateTime, formatDate, getStatusColor, getStatusLabel, getLogoPath } from '@/utils'

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
      title="Copiar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: copied ? 'var(--status-green)' : 'var(--ink-faint)', flexShrink: 0 }}>
      {copied
        ? <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <IconCopy size={11} />}
    </button>
  )
}

export default function ProveedorVentas() {
  const { provider } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [modal, setModal] = useState(null)
  const [renewModal, setRenewModal] = useState(null)
  const [renewDays, setRenewDays] = useState(30)
  const [renewBalance, setRenewBalance] = useState(null)
  const [credsForm, setCredsForm] = useState({ email: '', password: '', url: '', profile_name: '', profile_pin: '', activation_code: '', extra_notes: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { if (provider) fetchOrders() }, [provider])

  async function fetchOrders() {
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
    const stockIds = ordersData.map(o => o.stock_item_id).filter(Boolean)

    const [{ data: prods }, { data: users }, { data: stocks }] = await Promise.all([
      // ── Incluir is_renewable y renewal_price_usd ──
      supabase.from('products').select('id, name, is_renewable, renewal_price_usd, platforms(name, logo_filename)').in('id', productIds),
      supabase.from('users').select('id, full_name, email').in('id', userIds),
      stockIds.length ? supabase.from('stock_items').select('*').in('id', stockIds) : { data: [] },
    ])

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
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)
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

  // ── Calcula el costo real de renovación ──
  // Si el producto tiene renewal_price_usd configurado, usar ese.
  // Si no, usar price_paid (precio original de la orden).
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
      const currentExpiry = renewModal.expires_at ? new Date(renewModal.expires_at) : new Date()
      const base = currentExpiry > new Date() ? currentExpiry : new Date()
      base.setDate(base.getDate() + parseInt(renewDays))

      const { error: oErr } = await supabase.from('orders').update({
        expires_at: base.toISOString(), status: 'activo',
        updated_at: new Date().toISOString(),
      }).eq('id', renewModal.id)
      if (oErr) throw oErr

      await supabase.from('balances').update({ amount_usd: renewBalance - cost }).eq('user_id', renewModal.distributor_id)

      await supabase.from('transactions').insert({
        user_id: renewModal.distributor_id, type: 'compra', amount_usd: -cost,
        ref_order_id: renewModal.id,
        description: `Renovación: ${renewModal.products?.name} (+${renewDays} días)`,
      })

      await supabase.from('notifications').insert({
        user_id: renewModal.distributor_id,
        title: 'Suscripción renovada',
        message: `Tu pedido ${renewModal.order_code} fue renovado por ${renewDays} días. Nueva fecha: ${formatDate(base.toISOString())}`,
        type: 'success', ref_id: renewModal.id,
      })

      setRenewModal(null); fetchOrders()
    } catch (e) { setSaveError(e.message) }
    setSaving(false)
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader title="Ventas"
        subtitle={`${orders.length} pedidos · ${formatUSD(totalRevenue)} en ingresos`}
        action={<button className="btn-secondary" onClick={exportCSV} style={{ fontSize: 13 }}><IconDownload size={15} />CSV</button>}
      />

      {pendingCount > 0 && (
        <div style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow-border)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--status-yellow)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
          <strong>{pendingCount} pedido{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''}</strong> — haz click en <strong>Cargar</strong> para subir credenciales.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingLeft: 36 }}
            placeholder="Buscar pedido, cliente, producto, distribuidor o correo..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Tabs tabs={[
          { label: 'Todos', value: 'all' },
          { label: 'Activos', value: 'activo' },
          { label: 'Pendientes', value: 'pendiente_credenciales', count: pendingCount },
          { label: 'Expirados', value: 'expirado' },
        ]} active={tab} onChange={setTab} />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Pedido</th><th>Producto</th><th>Distribuidor</th><th>Cliente</th>
              <th>Correo plataforma</th><th>Precio</th><th>Estado</th><th>Fecha</th><th>Creds</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--ink-muted)' }}>#{o.order_code}</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={getLogoPath(o.products?.platforms?.logo_filename)} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                    <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.products?.name}</span>
                  </div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.user?.full_name || o.user?.email}</td>
                <td style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{o.client_name || '—'}</td>
                <td>
                  {o.stock_item?.email ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: 170 }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.stock_item.email}</span>
                      <CopyBtn value={o.stock_item.email} />
                    </div>
                  ) : <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>—</span>}
                </td>
                <td><span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{formatUSD(o.price_paid)}</span></td>
                <td><Badge color={getStatusColor(o.status)} dot>{getStatusLabel(o.status)}</Badge></td>
                <td style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDateTime(o.created_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openCredentials(o)} className="btn-secondary"
                      style={{ fontSize: 11, padding: '5px 10px', gap: 4,
                        background: o.status === 'pendiente_credenciales' ? 'var(--status-yellow-bg)' : undefined,
                        borderColor: o.status === 'pendiente_credenciales' ? 'var(--status-yellow-border)' : undefined,
                        color: o.status === 'pendiente_credenciales' ? 'var(--status-yellow)' : undefined }}>
                      <IconEdit size={12} />{o.status === 'pendiente_credenciales' ? 'Cargar' : 'Editar'}
                    </button>
                    {(o.status === 'activo' || o.status === 'expirado') && (
                      <button onClick={() => openRenew(o)} className="btn-secondary"
                        style={{ fontSize: 11, padding: '5px 10px', gap: 4, color: 'var(--status-green)', borderColor: 'var(--status-green-border)', background: 'var(--status-green-bg)' }}>
                        <IconRefreshCw size={12} />Renovar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 32 }}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal credenciales */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={`${modal?.stock_item_id ? 'Editar' : 'Cargar'} credenciales — ${modal?.order_code}`} maxWidth="max-w-md">
        {modal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>
              <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{modal.products?.name}</p>
              <p style={{ color: 'var(--ink-muted)' }}>Cliente: {modal.client_name || '—'} {modal.client_whatsapp ? `· ${modal.client_whatsapp}` : ''}</p>
            </div>
            {showEmail && <div><label className="label">Correo</label><input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="correo@ejemplo.com" value={credsForm.email} onChange={e => setCredsForm(f => ({ ...f, email: e.target.value }))} /></div>}
            {showPassword && <div><label className="label">Contraseña</label><input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="contraseña" value={credsForm.password} onChange={e => setCredsForm(f => ({ ...f, password: e.target.value }))} /></div>}
            {showUrl && <div><label className="label">URL</label><input className="input" style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }} placeholder="http://..." value={credsForm.url} onChange={e => setCredsForm(f => ({ ...f, url: e.target.value }))} /></div>}
            {showProfile && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="label">Perfil</label><input className="input" placeholder="Mi Perfil" value={credsForm.profile_name} onChange={e => setCredsForm(f => ({ ...f, profile_name: e.target.value }))} /></div>
                <div><label className="label">PIN</label><input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="1234" value={credsForm.profile_pin} onChange={e => setCredsForm(f => ({ ...f, profile_pin: e.target.value }))} /></div>
              </div>
            )}
            {showCode && <div><label className="label">Código</label><input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="XXXX-XXXX" value={credsForm.activation_code} onChange={e => setCredsForm(f => ({ ...f, activation_code: e.target.value }))} /></div>}
            {dt === 'activacion_tv' && <Alert type="info">Activación TV: pide al cliente el código de su televisor e ingrésalo en notas.</Alert>}
            <div><label className="label">Nota para el distribuidor (opcional)</label>
              <textarea className="input" rows={2} style={{ resize: 'none' }} placeholder="Instrucciones adicionales..." value={credsForm.extra_notes} onChange={e => setCredsForm(f => ({ ...f, extra_notes: e.target.value }))} />
            </div>
            {saveError && <Alert type="error">{saveError}</Alert>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={saveCredentials} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? <Spinner size={15} /> : 'Guardar y notificar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal renovar — ahora usa renewal_price_usd si existe */}
      <Modal open={!!renewModal} onClose={() => { setRenewModal(null); setSaveError('') }} title={`Renovar — ${renewModal?.order_code}`} maxWidth="max-w-sm">
        {renewModal && (() => {
          const cost = getRenewalCost(renewModal)
          const hasDiff = renewModal.products?.is_renewable &&
            renewModal.products?.renewal_price_usd &&
            parseFloat(renewModal.products.renewal_price_usd) !== parseFloat(renewModal.price_paid)
          const canRenew = renewBalance >= cost
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{renewModal.products?.name}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>Cliente: {renewModal.client_name || '—'}</p>
                {renewModal.expires_at && (
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                    Vence actualmente: <strong style={{ color: 'var(--ink)' }}>{formatDate(renewModal.expires_at)}</strong>
                  </p>
                )}
              </div>

              {/* Aviso si el precio de renovación es diferente al original */}
              {hasDiff && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--status-green-bg)', border: '1px solid var(--status-green-border)', borderRadius: 10, fontSize: 12, color: 'var(--status-green)' }}>
                  <IconRefreshCw size={13} />
                  <span>Precio especial de renovación: <strong>{formatUSD(cost)}</strong> (original: {formatUSD(renewModal.price_paid)})</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: canRenew ? 'var(--status-green-bg)' : 'var(--status-red-bg)', border: `1px solid ${canRenew ? 'var(--status-green-border)' : 'var(--status-red-border)'}` }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo del distribuidor</p>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: canRenew ? 'var(--status-green)' : 'var(--status-red)' }}>{formatUSD(renewBalance)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Costo renovación</p>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>{formatUSD(cost)}</p>
                </div>
              </div>

              {!canRenew && <Alert type="error">Saldo insuficiente. Recárgale saldo al distribuidor primero.</Alert>}

              <div>
                <label className="label">Días a agregar</label>
                <select className="input" value={renewDays} onChange={e => setRenewDays(e.target.value)}>
                  {[7, 15, 30, 60, 90].map(d => <option key={d} value={d}>{d} días</option>)}
                </select>
                {renewModal.expires_at && (
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 5 }}>
                    Nueva fecha: <strong style={{ color: 'var(--ink)' }}>
                      {(() => {
                        const base = new Date(renewModal.expires_at) > new Date() ? new Date(renewModal.expires_at) : new Date()
                        base.setDate(base.getDate() + parseInt(renewDays))
                        return formatDate(base.toISOString())
                      })()}
                    </strong>
                  </p>
                )}
              </div>

              {saveError && <Alert type="error">{saveError}</Alert>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setRenewModal(null); setSaveError('') }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                <button onClick={confirmRenew} disabled={saving || !canRenew} className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', background: 'var(--status-green)', opacity: !canRenew ? 0.4 : 1 }}>
                  {saving ? <Spinner size={15} /> : `Renovar y descontar ${formatUSD(cost)}`}
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}