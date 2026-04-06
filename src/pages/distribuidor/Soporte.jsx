import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Modal, Alert, Spinner, Badge, EmptyState, Tabs } from '@/components/ui'
import { IconHeadphones, IconEdit, IconX, IconCheck, IconAlertCircle, IconRefreshCw, IconDollar, IconTrash } from '@/assets/icons'
import { formatDateTime, getReasonLabel } from '@/utils'

function calcRefund(pricePaid, createdAt, expiresAt) {
  const now = new Date()
  const start = new Date(createdAt)
  const end = new Date(expiresAt)
  const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
  const usedDays = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)))
  const remainingDays = Math.max(0, totalDays - usedDays)
  const refundAmount = Math.round((pricePaid / totalDays) * remainingDays * 100) / 100
  return { totalDays, usedDays, remainingDays, refundAmount }
}

export default function ProveedorSoporte() {
  const { provider } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('abierto')
  const [deletingId, setDeletingId] = useState(null)

  // Modal principal: responder ticket
  const [modal, setModal] = useState(null)
  const [response, setResponse] = useState('')
  const [newStatus, setNewStatus] = useState('resuelto')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modal secundario: editar credenciales
  const [showEditCreds, setShowEditCreds] = useState(false)
  const [creds, setCreds] = useState({})
  const [credsSaving, setCredsSaving] = useState(false)
  const [credsError, setCredsError] = useState('')
  const [credsSaved, setCredsSaved] = useState(false)

  // Modal renovar
  const [renewModal, setRenewModal] = useState(null)
  const [renewDays, setRenewDays] = useState(30)
  const [renewSaving, setRenewSaving] = useState(false)
  const [renewError, setRenewError] = useState('')

  // Modal anular
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelNote, setCancelNote] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelDone, setCancelDone] = useState(false)

  useEffect(() => { if (provider) fetchTickets() }, [provider, tab])

  async function fetchTickets() {
    setLoading(true)
    let q = supabase
      .from('support_tickets')
      .select(`*, orders(id, order_code, client_name, price_paid, created_at, expires_at, product_id, stock_item_id, distributor_id, products(name, duration_days, platforms(name, logo_filename))), users(full_name, email, phone)`)
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false })
    if (tab !== 'all') q = q.eq('status', tab)
    const { data } = await q

    const stockIds = (data || []).map(t => t.orders?.stock_item_id).filter(Boolean)
    let stockMap = {}
    if (stockIds.length) {
      const { data: stocks } = await supabase.from('stock_items').select('*').in('id', stockIds)
      stocks?.forEach(s => { stockMap[s.id] = s })
    }
    setTickets((data || []).map(t => ({ ...t, stock_item: stockMap[t.orders?.stock_item_id] || null })))
    setLoading(false)
  }

  async function deleteTicket(ticketId) {
    setDeletingId(ticketId)
    await supabase.from('support_tickets').delete().eq('id', ticketId)
    setTickets(prev => prev.filter(t => t.id !== ticketId))
    setDeletingId(null)
  }

  function openTicket(ticket) {
    setModal(ticket)
    setResponse(ticket.provider_response || '')
    setNewStatus(ticket.status === 'abierto' ? 'en_revision' : ticket.status === 'en_revision' ? 'resuelto' : ticket.status)
    setError('')
    setCredsSaved(false)
  }

  function openEditCreds() {
    if (!modal?.stock_item) return
    setCreds({
      email: modal.stock_item.email || '',
      password: modal.stock_item.password || '',
      url: modal.stock_item.url || '',
      profile_name: modal.stock_item.profile_name || '',
      profile_pin: modal.stock_item.profile_pin || '',
      activation_code: modal.stock_item.activation_code || '',
    })
    setCredsError('')
    setShowEditCreds(true)
  }

  async function saveCredentials() {
    if (!modal?.orders?.stock_item_id) return
    setCredsSaving(true); setCredsError('')
    try {
      const update = Object.fromEntries(Object.entries(creds).filter(([, v]) => v !== ''))
      const { error: credErr } = await supabase.from('stock_items').update(update).eq('id', modal.orders.stock_item_id)
      if (credErr) throw credErr
      setModal(prev => ({ ...prev, stock_item: { ...prev.stock_item, ...update } }))
      setCredsSaved(true)
      setShowEditCreds(false)
    } catch (e) { setCredsError(e.message) }
    setCredsSaving(false)
  }

  async function saveResponse() {
    if (!response.trim()) return setError('Escribe una respuesta antes de guardar')
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase.from('support_tickets').update({
        provider_response: response, status: newStatus, updated_at: new Date().toISOString(),
      }).eq('id', modal.id)
      if (err) throw err
      await supabase.from('notifications').insert({
        user_id: modal.orders?.distributor_id,
        title: newStatus === 'resuelto' ? 'Ticket resuelto' : 'Respuesta de soporte',
        message: `Tu ticket #${modal.ticket_code} fue actualizado${credsSaved ? ' y las credenciales fueron actualizadas' : ''}.`,
        type: newStatus === 'resuelto' ? 'success' : 'info',
        ref_id: modal.id,
      })
      setModal(null)
      fetchTickets()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function saveRenewal() {
    setRenewSaving(true); setRenewError('')
    try {
      const base = new Date(renewModal.orders.expires_at) < new Date() ? new Date() : new Date(renewModal.orders.expires_at)
      base.setDate(base.getDate() + Number(renewDays))
      const { error: orderErr } = await supabase.from('orders').update({ expires_at: base.toISOString(), status: 'activo' }).eq('id', renewModal.orders?.id)
      if (orderErr) throw orderErr
      await supabase.from('notifications').insert({
        user_id: renewModal.orders?.distributor_id,
        title: 'Pedido renovado',
        message: `Tu pedido #${renewModal.orders?.order_code} de ${renewModal.orders?.products?.name} fue renovado por ${renewDays} días.`,
        type: 'success', ref_id: renewModal.orders?.id,
      })
      if (renewModal.status !== 'resuelto') {
        await supabase.from('support_tickets').update({ status: 'resuelto', updated_at: new Date().toISOString() }).eq('id', renewModal.id)
      }
      setRenewModal(null)
      fetchTickets()
    } catch (e) { setRenewError(e.message) }
    setRenewSaving(false)
  }

  async function executeCancel(type) {
    setCancelSaving(true); setCancelError('')
    try {
      const order = cancelModal.orders
      const refund = calcRefund(order.price_paid, order.created_at, order.expires_at)
      await supabase.from('orders').update({ status: 'cancelado' }).eq('id', order.id)
      if (order.stock_item_id) {
        await supabase.from('stock_items').update({ status: 'disponible', assigned_order_id: null }).eq('id', order.stock_item_id)
      }
      if (type === 'platform' && refund.refundAmount > 0) {
        const { data: balanceRow } = await supabase.from('balances').select('amount').eq('user_id', order.distributor_id).maybeSingle()
        const current = balanceRow?.amount || 0
        await supabase.from('balances').upsert({ user_id: order.distributor_id, amount: Math.round((current + refund.refundAmount) * 100) / 100 }, { onConflict: 'user_id' })
        await supabase.from('transactions').insert({ user_id: order.distributor_id, type: 'reembolso', amount: refund.refundAmount, description: `Reembolso proporcional — Pedido #${order.order_code} (${refund.remainingDays}d restantes de ${refund.totalDays}d)`, ref_id: order.id })
      }
      const msg = type === 'platform' ? `Venta anulada. Se acreditaron $${refund.refundAmount} en tu saldo de plataforma.` : type === 'external' ? `Venta anulada. Recibirás un reembolso externo de $${refund.refundAmount}.` : cancelNote || 'Venta anulada sin reembolso.'
      await supabase.from('support_tickets').update({ status: 'resuelto', provider_response: msg, updated_at: new Date().toISOString() }).eq('id', cancelModal.id)
      await supabase.from('notifications').insert({ user_id: order.distributor_id, title: 'Venta anulada', message: msg, type: 'warning', ref_id: order.id })
      setCancelDone(true)
      setTimeout(() => { setCancelModal(null); setCancelDone(false); fetchTickets() }, 2000)
    } catch (e) { setCancelError(e.message) }
    setCancelSaving(false)
  }

  const statusColor = { abierto: 'red', en_revision: 'yellow', resuelto: 'green' }
  const statusLabel = { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto' }

  const activeCredFields = modal?.stock_item
    ? [{ key: 'email', label: 'Email' }, { key: 'password', label: 'Contraseña' }, { key: 'url', label: 'URL' }, { key: 'profile_name', label: 'Perfil' }, { key: 'profile_pin', label: 'PIN' }, { key: 'activation_code', label: 'Código' }].filter(f => modal.stock_item[f.key])
    : []

  return (
    <div>
      <PageHeader title="Soporte" subtitle="Tickets de tus distribuidores" />

      <div style={{ marginBottom: 16 }}>
        <Tabs
          tabs={[
            { label: 'Abiertos', value: 'abierto', count: tickets.filter(t => t.status === 'abierto').length },
            { label: 'En revisión', value: 'en_revision' },
            { label: 'Resueltos', value: 'resuelto' },
            { label: 'Todos', value: 'all' },
          ]}
          active={tab}
          onChange={t => setTab(t)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>
      ) : tickets.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconHeadphones} title="Sin tickets" description="No hay tickets en esta categoría." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger">
          {tickets.map(t => (
            <div key={t.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: t.status === 'abierto' ? 'var(--status-red)' : t.status === 'en_revision' ? 'var(--status-yellow)' : 'var(--status-green)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--ink-faint)' }}>#{t.ticket_code}</span>
                    <Badge color={statusColor[t.status] || 'neutral'}>{statusLabel[t.status] || t.status}</Badge>
                  </div>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>{getReasonLabel(t.reason)}</p>
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Pedido <span style={{ fontFamily: 'DM Mono, monospace' }}>#{t.orders?.order_code}</span> · {t.orders?.products?.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>De: {t.users?.full_name || t.users?.email} · {formatDateTime(t.created_at)}</p>
                  {t.description && <div style={{ marginTop: 8, background: 'var(--surface-overlay)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--ink-muted)' }}>{t.description}</div>}
                  {t.provider_response && (
                    <div style={{ marginTop: 8, background: 'var(--status-green-bg)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--status-green)', border: '1px solid var(--status-green-border)' }}>
                      <strong>Tu respuesta:</strong> {t.provider_response}
                    </div>
                  )}
                  {t.stock_item && (
                    <div style={{ marginTop: 8, background: 'var(--surface-overlay)', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)', lineHeight: 1.8 }}>
                      {t.stock_item.email && <div>Email: {t.stock_item.email}</div>}
                      {t.stock_item.password && <div>Pass: {t.stock_item.password}</div>}
                      {t.stock_item.profile_name && <div>Perfil: {t.stock_item.profile_name}</div>}
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openTicket(t)} className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                    <IconEdit size={13} />Responder
                  </button>
                  <button onClick={() => { setRenewModal(t); setRenewDays(30); setRenewError('') }}
                    style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, background: 'var(--status-green-bg)', border: '1px solid var(--status-green)', color: 'var(--status-green)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
                    <IconRefreshCw size={13} />Renovar
                  </button>
                  <button onClick={() => { setCancelModal(t); setCancelNote(''); setCancelDone(false); setCancelError('') }}
                    style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, background: 'var(--status-red-bg)', border: '1px solid var(--status-red)', color: 'var(--status-red)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
                    <IconX size={13} />Anular venta
                  </button>
                  {/* Botón eliminar — solo visible si está resuelto */}
                  {t.status === 'resuelto' && (
                    <button
                      onClick={() => deleteTicket(t.id)}
                      disabled={deletingId === t.id}
                      title="Eliminar ticket"
                      style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', color: 'var(--ink-faint)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, opacity: deletingId === t.id ? 0.5 : 1 }}>
                      {deletingId === t.id ? <Spinner size={13} /> : <IconTrash size={13} />}
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ MODAL PRINCIPAL: RESPONDER TICKET ══ */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={`Ticket #${modal?.ticket_code}`} maxWidth="max-w-lg">
        {modal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: '9px 12px', fontSize: 12 }}>
              <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{getReasonLabel(modal.reason)}</p>
              <p style={{ color: 'var(--ink-muted)' }}>Pedido #{modal.orders?.order_code} · {modal.orders?.products?.name}</p>
              {modal.description && <p style={{ color: 'var(--ink-faint)', marginTop: 4 }}>{modal.description}</p>}
            </div>

            {activeCredFields.length > 0 && (
              <div style={{ border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: 'var(--surface-overlay)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)' }}>
                    Credenciales del pedido
                    {credsSaved && <span style={{ marginLeft: 8, color: 'var(--status-green)', fontWeight: 600 }}>✓ Guardadas</span>}
                  </p>
                  <button onClick={openEditCreds}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'transparent', color: 'var(--ink-muted)', border: '1px solid var(--surface-border)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconEdit size={11} />Editar
                  </button>
                </div>
                <div style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)', lineHeight: 1.9 }}>
                  {activeCredFields.map(f => (
                    <div key={f.key}>{f.label}: <span style={{ color: 'var(--ink)' }}>{modal.stock_item[f.key]}</span></div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Tu respuesta al distribuidor</label>
              <textarea className="input" rows={3} style={{ resize: 'none' }}
                placeholder="Explica qué hiciste o qué debe hacer el distribuidor..."
                value={response} onChange={e => setResponse(e.target.value)} />
            </div>
            <div>
              <label className="label">Cambiar estado a</label>
              <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option value="en_revision">En revisión</option>
                <option value="resuelto">Resuelto</option>
              </select>
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={saveResponse} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? <Spinner size={15} /> : 'Guardar y notificar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══ MODAL SECUNDARIO: EDITAR CREDENCIALES ══ */}
      <Modal open={showEditCreds} onClose={() => setShowEditCreds(false)} title="Editar credenciales" maxWidth="max-w-md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--status-yellow)', marginBottom: 4 }}>Los cambios se guardan inmediatamente al confirmar.</p>
          {Object.entries(creds).filter(([key]) => modal?.stock_item?.[key]).map(([key, val]) => {
            const labels = { email: 'Email', password: 'Contraseña', url: 'URL', profile_name: 'Perfil', profile_pin: 'PIN', activation_code: 'Código de activación' }
            return (
              <div key={key}>
                <label className="label">{labels[key]}</label>
                <input className="input" value={val} onChange={e => setCreds(prev => ({ ...prev, [key]: e.target.value }))} />
              </div>
            )
          })}
          {credsError && <Alert type="error">{credsError}</Alert>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setShowEditCreds(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={saveCredentials} disabled={credsSaving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {credsSaving ? <Spinner size={15} /> : 'Guardar credenciales'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: RENOVAR PEDIDO ══ */}
      <Modal open={!!renewModal} onClose={() => setRenewModal(null)} title="Renovar pedido" maxWidth="max-w-sm">
        {renewModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>
              <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{renewModal.orders?.products?.name}</p>
              <p style={{ color: 'var(--ink-muted)' }}>Pedido #{renewModal.orders?.order_code}</p>
              {renewModal.orders?.expires_at && <p style={{ color: 'var(--ink-faint)', marginTop: 4 }}>Vence: {new Date(renewModal.orders.expires_at).toLocaleDateString('es-PE')}</p>}
            </div>
            <div>
              <label className="label">Días a agregar</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {[7, 15, 30, 60].map(d => (
                  <button key={d} onClick={() => setRenewDays(d)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', background: renewDays === d ? 'var(--ink)' : 'var(--surface-overlay)', color: renewDays === d ? 'var(--surface)' : 'var(--ink-muted)', border: `1px solid ${renewDays === d ? 'var(--ink)' : 'var(--surface-border)'}` }}>
                    {d}d
                  </button>
                ))}
              </div>
              <input type="number" min={1} max={365} className="input" value={renewDays} onChange={e => setRenewDays(Number(e.target.value))} placeholder="Días personalizados" />
            </div>
            {renewModal.orders?.expires_at && (
              <div style={{ background: 'var(--status-green-bg)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--status-green)' }}>
                Nueva fecha: <strong>{(() => {
                  const base = new Date(renewModal.orders.expires_at) < new Date() ? new Date() : new Date(renewModal.orders.expires_at)
                  base.setDate(base.getDate() + Number(renewDays))
                  return base.toLocaleDateString('es-PE')
                })()}</strong>
              </div>
            )}
            {renewError && <Alert type="error">{renewError}</Alert>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRenewModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={saveRenewal} disabled={renewSaving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {renewSaving ? <Spinner size={15} /> : `Renovar +${renewDays}d`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══ MODAL: ANULAR VENTA ══ */}
      <Modal open={!!cancelModal} onClose={() => { setCancelModal(null); setCancelDone(false) }} title="Anular venta" maxWidth="max-w-sm">
        {cancelModal && (cancelDone ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <IconCheck size={20} style={{ color: 'var(--status-green)' }} />
            </div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, color: 'var(--ink)' }}>Venta anulada</p>
            <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>El distribuidor fue notificado.</p>
          </div>
        ) : (() => {
          const order = cancelModal.orders
          const refund = order ? calcRefund(order.price_paid, order.created_at, order.expires_at) : null
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>
                <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{order?.products?.name}</p>
                <p style={{ color: 'var(--ink-muted)' }}>Pedido #{order?.order_code} · ${order?.price_paid}</p>
              </div>
              {refund && (
                <div style={{ border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '7px 12px', background: 'var(--surface-overlay)', borderBottom: '1px solid var(--surface-border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)' }}>Cálculo de reembolso</p>
                  </div>
                  <div style={{ padding: '10px 12px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[['Precio pagado', `$${order.price_paid}`], ['Días totales', `${refund.totalDays}d`], ['Días usados', `${refund.usedDays}d`], ['Días restantes', `${refund.remainingDays}d`]].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-muted)' }}><span>{k}</span><span>{v}</span></div>
                    ))}
                    <div style={{ height: 1, background: 'var(--surface-border)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Reembolso</span>
                      <span style={{ fontWeight: 700, color: 'var(--status-green)', fontSize: 14 }}>${refund.refundAmount}</span>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="label">Nota para el distribuidor (opcional)</label>
                <textarea className="input" rows={2} style={{ resize: 'none' }} placeholder="Motivo de la anulación..." value={cancelNote} onChange={e => setCancelNote(e.target.value)} />
              </div>
              {cancelError && <Alert type="error">{cancelError}</Alert>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => executeCancel('platform')} disabled={cancelSaving}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, background: 'var(--status-green-bg)', border: '1px solid var(--status-green)', color: 'var(--status-green)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  {cancelSaving ? <Spinner size={15} /> : <><IconDollar size={15} />Devolver ${refund?.refundAmount} en plataforma</>}
                </button>
                <button onClick={() => executeCancel('external')} disabled={cancelSaving}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)', color: 'var(--status-yellow)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  {cancelSaving ? <Spinner size={15} /> : <><IconAlertCircle size={15} />Reembolso externo (${refund?.refundAmount})</>}
                </button>
                <button onClick={() => executeCancel('none')} disabled={cancelSaving}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, background: 'var(--status-red-bg)', border: '1px solid var(--status-red)', color: 'var(--status-red)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  {cancelSaving ? <Spinner size={15} /> : <><IconX size={15} />Anular sin reembolso</>}
                </button>
                <button onClick={() => setCancelModal(null)} className="btn-secondary" style={{ justifyContent: 'center' }}>Cancelar</button>
              </div>
            </div>
          )
        })())}
      </Modal>
    </div>
  )
}