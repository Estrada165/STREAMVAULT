import { useLocation } from 'react-router-dom'
import { rpcError } from '@/lib/rpcError'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Modal, Alert, Spinner, Badge, EmptyState, Tabs, SkeletonList } from '@/components/ui'
import { IconHeadphones, IconEdit, IconX, IconCheck, IconAlertCircle, IconRefreshCw, IconDollar, IconTrash, IconWhatsApp, IconMail, IconKey, IconUser, IconLink } from '@/assets/icons'
import { formatDateTime, getReasonLabel } from '@/utils'
import { waLink } from '@/lib/whatsapp'

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

// ── Botón WhatsApp reutilizable ──────────────────────────────
function WaBtn({ phone, message, label = 'WhatsApp', className = '' }) {
  if (!phone) return null
  const clean = phone.replace(/\D/g, '')
  return (
    <a href={waLink(clean, message)} target="_blank" rel="noreferrer" className={`btn-accent btn-sm ${className}`}>
      <IconWhatsApp size={14} />{label}
    </a>
  )
}

export default function ProveedorSoporte() {
  const { provider } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const [tab, setTab] = useState(location.state?.tab || 'abierto')
  const [deletingId, setDeletingId] = useState(null)

  const [modal, setModal] = useState(null)
  const [response, setResponse] = useState('')
  const [newStatus, setNewStatus] = useState('resuelto')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showEditCreds, setShowEditCreds] = useState(false)
  const [creds, setCreds] = useState({})
  const [credsSaving, setCredsSaving] = useState(false)
  const [credsError, setCredsError] = useState('')
  const [credsSaved, setCredsSaved] = useState(false)

  const [renewModal, setRenewModal] = useState(null)
  const [renewDays, setRenewDays] = useState(30)
  const [renewSaving, setRenewSaving] = useState(false)
  const [renewError, setRenewError] = useState('')

  const [cancelModal, setCancelModal] = useState(null)
  const [cancelNote, setCancelNote] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelDone, setCancelDone] = useState(false)

  useEffect(() => { if (provider) fetchTickets() }, [provider, tab])

  async function fetchTickets() {
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
    setError(''); setCredsSaved(false)
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
        type: newStatus === 'resuelto' ? 'success' : 'info', ref_id: modal.id,
      })
      setModal(null); fetchTickets()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function saveRenewal() {
    setRenewSaving(true); setRenewError('')
    try {
      // Renovación de cortesía (sin cobro): fecha + aviso en un solo paso
      const { error: rpcErr } = await supabase.rpc('renew_order', { p_order: renewModal.orders?.id, p_days: Number(renewDays), p_charge: false })
      if (rpcErr) throw new Error(rpcError(rpcErr))
      if (renewModal.status !== 'resuelto') {
        await supabase.from('support_tickets').update({ status: 'resuelto', updated_at: new Date().toISOString() }).eq('id', renewModal.id)
      }
      setRenewModal(null); fetchTickets()
    } catch (e) { setRenewError(e.message) }
    setRenewSaving(false)
  }

  async function executeCancel(type) {
    setCancelSaving(true)
    setCancelError('')
    try {
      // Anulación completa en un solo paso: estado, cuenta de vuelta al stock, reembolso,
      // ticket resuelto y aviso. El reembolso lo calcula la base de datos.
      const { error: rpcErr } = await supabase.rpc('cancel_order', {
        p_order: cancelModal.orders.id,
        p_mode: ['platform', 'external'].includes(type) ? type : 'none',
        p_note: cancelNote?.trim() || null,
        p_ticket: cancelModal.id,
      })
      if (rpcErr) throw new Error(rpcError(rpcErr))
      setCancelDone(true)
      setTimeout(() => { setCancelModal(null); setCancelDone(false); fetchTickets() }, 2000)
    } catch (e) {
      setCancelError(e.message)
    }
    setCancelSaving(false)
  }

  const statusColor = { abierto: 'violet', en_revision: 'yellow', resuelto: 'green' }
  const statusLabel = { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto' }

  const activeCredFields = modal?.stock_item
    ? [{ key: 'email', label: 'Correo' }, { key: 'password', label: 'Contraseña' }, { key: 'url', label: 'URL' }, { key: 'profile_name', label: 'Perfil' }, { key: 'profile_pin', label: 'PIN' }, { key: 'activation_code', label: 'Código' }].filter(f => modal.stock_item[f.key])
    : []

  return (
    <div>
      <PageHeader title="Soporte" subtitle="Tickets de tus distribuidores: responde, repón o renueva" />
      <div className="mb-5">
        <Tabs
          tabs={[
            { label: 'Abiertos', value: 'abierto', count: tab === 'abierto' ? tickets.length : undefined },
            { label: 'En revisión', value: 'en_revision' },
            { label: 'Resueltos', value: 'resuelto' },
            { label: 'Todos', value: 'all' },
          ]}
          active={tab} onChange={t => setTab(t)}
        />
      </div>

      {loading ? <SkeletonList rows={4} /> : tickets.length === 0 ? (
        <div className="card"><EmptyState icon={IconHeadphones} title={tab === 'abierto' ? 'Sin tickets abiertos' : 'Nada por aquí'} description={tab === 'abierto' ? 'Cuando un distribuidor reporte un problema aparecerá aquí.' : 'No hay tickets en esta categoría.'} /></div>
      ) : (
        <div className="space-y-3 stagger">
          {tickets.map(t => {
            const distPhone = (t.users?.phone || '').replace(/\D/g, '')
            return (
              <article key={t.id} className={`card overflow-hidden ${t.status === 'abierto' ? 'card-sig' : ''}`}>
                <div className="p-4 sm:p-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge color={statusColor[t.status] || 'neutral'} dot>{statusLabel[t.status] || t.status}</Badge>
                      <span className="font-mono text-[11px] text-[var(--ink-faint)]">#{t.ticket_code}</span>
                      <span className="text-[11px] text-[var(--ink-faint)]">· {formatDateTime(t.created_at)}</span>
                    </div>
                    <h3 className="font-display font-semibold text-base text-[var(--ink)]">{getReasonLabel(t.reason)}</h3>
                    <p className="text-[13px] text-[var(--ink-muted)] mt-0.5">
                      {t.users?.full_name || t.users?.email} · <span className="font-mono">#{t.orders?.order_code}</span> · {t.orders?.products?.name}
                    </p>
                    {t.description && <p className="text-[13.5px] text-[var(--ink)] mt-3 leading-relaxed">“{t.description}”</p>}

                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                      {t.stock_item && (
                        <div className="inset px-3 py-2.5 font-mono text-[12px] text-[var(--ink-muted)] leading-[1.8] min-w-0">
                          {t.stock_item.email && <div className="truncate flex items-center gap-2"><IconMail size={12} className="flex-shrink-0" /><span className="text-[var(--ink)] truncate">{t.stock_item.email}</span></div>}
                          {t.stock_item.password && <div className="truncate flex items-center gap-2"><IconKey size={12} className="flex-shrink-0" /><span className="text-[var(--ink)] truncate">{t.stock_item.password}</span></div>}
                          {t.stock_item.profile_name && <div className="truncate flex items-center gap-2"><IconUser size={12} className="flex-shrink-0" />{t.stock_item.profile_name}{t.stock_item.profile_pin ? ` · ${t.stock_item.profile_pin}` : ''}</div>}
                          {t.stock_item.url && <div className="truncate flex items-center gap-2"><IconLink size={12} className="flex-shrink-0" /><span className="truncate">{t.stock_item.url}</span></div>}
                        </div>
                      )}
                      {t.provider_response && (
                        <div className="rounded-xl px-3 py-2.5 text-[13px] bg-[var(--a-soft)] border border-[var(--a-line)]">
                          <p className="eyebrow !text-[10px] mb-1">Tu respuesta</p>
                          <p className="text-[var(--ink)] leading-relaxed">{t.provider_response}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex lg:flex-col flex-wrap gap-2 lg:w-44">
                    <button onClick={() => openTicket(t)} className="btn-primary btn-sm lg:w-full"><IconEdit size={14} />Responder</button>
                    {(t.status === 'en_revision' || t.status === 'resuelto') && distPhone && (
                      <WaBtn
                        phone={distPhone}
                        label="Avisar"
                        className="lg:w-full"
                        message={
                          t.status === 'resuelto'
                            ? `Hola ${t.users?.full_name || ''}!\n\nTu ticket *#${t.ticket_code}* ha sido *resuelto*\nPedido: #${t.orders?.order_code} - ${t.orders?.products?.name}\n` +
                              (t.provider_response ? `\nRespuesta: ${t.provider_response}` : '')
                            : `Hola ${t.users?.full_name || ''}!\n\nTu ticket *#${t.ticket_code}* esta *en revision*\nPedido: #${t.orders?.order_code} - ${t.orders?.products?.name}\n\nEstamos trabajando en ello, te avisamos pronto.`
                        }
                      />
                    )}
                    <button onClick={() => { setRenewModal(t); setRenewDays(30); setRenewError('') }} className="btn-secondary btn-sm lg:w-full"><IconRefreshCw size={14} />Renovar</button>
                    <button onClick={() => { setCancelModal(t); setCancelNote(''); setCancelDone(false); setCancelError('') }} className="btn-danger btn-sm lg:w-full"><IconX size={14} />Anular venta</button>
                    {t.status === 'resuelto' && (
                      <button onClick={() => deleteTicket(t.id)} disabled={deletingId === t.id} className="btn-ghost btn-sm lg:w-full justify-center hover:!text-[var(--status-red)]">
                        {deletingId === t.id ? <Spinner size={13} /> : <IconTrash size={14} />}Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ══ RESPONDER ══ */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? getReasonLabel(modal.reason) : ''}
        subtitle={modal ? `#${modal.ticket_code} · ${modal.orders?.products?.name} · ${modal.users?.full_name || modal.users?.email || ''}` : ''}
        maxWidth="max-w-lg"
      >
        {modal && (
          <div className="space-y-4">
            {modal.description && <p className="inset px-3.5 py-2.5 text-[13px] text-[var(--ink)] leading-relaxed">“{modal.description}”</p>}
            {activeCredFields.length > 0 && (
              <div className="rounded-xl border border-[var(--surface-border)] overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 bg-[var(--surface-side)] border-b border-[var(--surface-border)]">
                  <p className="eyebrow !text-[10px]">Credenciales {credsSaved && <span className="text-[var(--a)] normal-case tracking-normal">· guardadas</span>}</p>
                  <button onClick={openEditCreds} className="btn-ghost btn-sm !py-1"><IconEdit size={12} />Cambiar</button>
                </div>
                <div className="px-3.5 py-2.5 font-mono text-[12.5px] text-[var(--ink-muted)] leading-[1.9]">
                  {activeCredFields.map(f => <div key={f.key}>{f.label}: <span className="text-[var(--ink)]">{modal.stock_item[f.key]}</span></div>)}
                </div>
              </div>
            )}
            <div>
              <label className="label">Tu respuesta</label>
              <textarea className="input" rows={3} placeholder="Ej: Ya cambié la contraseña, vuelve a intentar con la nueva." value={response} onChange={e => setResponse(e.target.value)} autoFocus />
            </div>
            <div>
              <p className="label">Estado</p>
              <div className="grid grid-cols-2 gap-2">
                {[['en_revision', 'En revisión', 'var(--status-yellow)'], ['resuelto', 'Resuelto', 'var(--a)']].map(([v, l, c]) => (
                  <button key={v} type="button" onClick={() => setNewStatus(v)} className={`btn-secondary btn-sm ${newStatus === v ? 'is-down' : ''}`} style={newStatus === v ? { color: c } : undefined}>
                    <span className="dot" style={{ color: newStatus === v ? c : 'var(--surface-border-strong)' }} />{l}
                  </button>
                ))}
              </div>
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
              <div className="flex-1" />
              {newStatus === 'resuelto' && modal.users?.phone && (
                <WaBtn
                  phone={modal.users.phone}
                  label="Avisar por WhatsApp"
                  message={`Hola ${modal.users?.full_name || ''}!\n\nTu ticket *#${modal.ticket_code}* ha sido *resuelto*\nPedido: #${modal.orders?.order_code} - ${modal.orders?.products?.name}\n` + (response ? `\nRespuesta: ${response}` : '')}
                />
              )}
              <button onClick={saveResponse} disabled={saving} className="btn-primary min-w-[150px]">{saving ? <Spinner size={15} /> : 'Guardar y notificar'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══ EDITAR CREDENCIALES ══ */}
      <Modal
        open={showEditCreds}
        onClose={() => setShowEditCreds(false)}
        title="Cambiar credenciales"
        subtitle="Se guardan al instante y el distribuidor recibe el aviso."
        maxWidth="max-w-md"
        footer={<>
          <button onClick={() => setShowEditCreds(false)} className="btn-ghost">Cancelar</button>
          <button onClick={saveCredentials} disabled={credsSaving} className="btn-primary min-w-[150px]">{credsSaving ? <Spinner size={15} /> : 'Guardar'}</button>
        </>}
      >
        <div className="space-y-3">
          {Object.entries(creds).filter(([key]) => modal?.stock_item?.[key]).map(([key, val]) => {
            const labels = { email: 'Correo', password: 'Contraseña', url: 'URL', profile_name: 'Perfil', profile_pin: 'PIN', activation_code: 'Código' }
            return (
              <div key={key}>
                <label className="label">{labels[key]}</label>
                <input className="input font-mono" value={val} onChange={e => setCreds(prev => ({ ...prev, [key]: e.target.value }))} />
              </div>
            )
          })}
          {credsError && <Alert type="error">{credsError}</Alert>}
        </div>
      </Modal>

      {/* ══ RENOVAR ══ */}
      <Modal
        open={!!renewModal}
        onClose={() => setRenewModal(null)}
        title="Renovar pedido"
        subtitle={renewModal ? `${renewModal.orders?.products?.name} · #${renewModal.orders?.order_code}` : ''}
        maxWidth="max-w-sm"
        footer={<>
          <button onClick={() => setRenewModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={saveRenewal} disabled={renewSaving} className="btn-primary min-w-[130px]">{renewSaving ? <Spinner size={15} /> : `Renovar +${renewDays} d`}</button>
        </>}
      >
        {renewModal && (
          <div className="space-y-4">
            <div>
              <p className="label">Días a agregar</p>
              <div className="flex flex-wrap gap-1.5">
                {[7, 15, 30, 60].map(d => (
                  <button key={d} onClick={() => setRenewDays(d)} className={`btn-secondary btn-sm min-w-[56px] ${renewDays === d ? 'is-down !text-[var(--a)]' : ''}`}>{d} d</button>
                ))}
                <input type="number" min={1} max={365} className="input !w-24 !min-h-[2.25rem] font-mono" value={renewDays} onChange={e => setRenewDays(Number(e.target.value))} aria-label="Días personalizados" />
              </div>
            </div>
            {renewModal.orders?.expires_at && (
              <div className="rounded-xl px-3.5 py-2.5 text-[13px] bg-[var(--a-soft)] border border-[var(--a-line)] flex justify-between">
                <span className="text-[var(--ink-muted)]">Vence {new Date(renewModal.orders.expires_at).toLocaleDateString('es-PE')} →</span>
                <span className="font-semibold text-[var(--a)]">{(() => {
                  const base = new Date(renewModal.orders.expires_at) < new Date() ? new Date() : new Date(renewModal.orders.expires_at)
                  base.setDate(base.getDate() + Number(renewDays))
                  return base.toLocaleDateString('es-PE')
                })()}</span>
              </div>
            )}
            {renewError && <Alert type="error">{renewError}</Alert>}
          </div>
        )}
      </Modal>

      {/* ══ ANULAR VENTA ══ */}
      <Modal open={!!cancelModal} onClose={() => { setCancelModal(null); setCancelDone(false) }} title="Anular venta" subtitle={cancelModal ? `${cancelModal.orders?.products?.name} · #${cancelModal.orders?.order_code}` : ''} maxWidth="max-w-sm">
        {cancelModal && (cancelDone ? (
          <div className="text-center py-5 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)] animate-pop"><IconCheck size={24} /></div>
            <p className="font-display font-semibold text-lg text-[var(--ink)]">Venta anulada</p>
            <p className="text-sm text-[var(--ink-muted)] mt-1">Stock liberado y distribuidor notificado.</p>
          </div>
        ) : (() => {
          const order = cancelModal.orders
          const refund = order ? calcRefund(order.price_paid, order.created_at, order.expires_at) : null
          return (
            <div className="space-y-4">
              {refund && (
                <div className="rounded-xl border border-[var(--surface-border)] overflow-hidden">
                  <div className="px-3.5 py-3 text-[13px] space-y-1.5">
                    {[['Pagó', `$${order.price_paid}`], ['Días totales', `${refund.totalDays}`], ['Días usados', `${refund.usedDays}`], ['Días restantes', `${refund.remainingDays}`]].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[var(--ink-muted)]"><span>{k}</span><span className="font-mono">{v}</span></div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-3 bg-[var(--a-soft)] border-t border-[var(--a-line)]">
                    <span className="font-semibold text-sm text-[var(--ink)]">Reembolso proporcional</span>
                    <span className="font-mono text-lg text-[var(--a)]">${refund.refundAmount}</span>
                  </div>
                </div>
              )}
              <div>
                <label className="label">Nota (opcional)</label>
                <textarea className="input" rows={2} placeholder="Motivo de la anulación..." value={cancelNote} onChange={e => setCancelNote(e.target.value)} />
              </div>
              {cancelError && <Alert type="error">{cancelError}</Alert>}
              <div className="space-y-2">
                <button onClick={() => executeCancel('platform')} disabled={cancelSaving} className="btn-accent w-full">
                  {cancelSaving ? <Spinner size={15} /> : <><IconDollar size={15} />Devolver ${refund?.refundAmount} a su saldo</>}
                </button>
                <button onClick={() => executeCancel('external')} disabled={cancelSaving} className="btn-secondary w-full !text-[var(--status-yellow)]">
                  {cancelSaving ? <Spinner size={15} /> : <><IconAlertCircle size={15} />Reembolso por fuera (${refund?.refundAmount})</>}
                </button>
                <button onClick={() => executeCancel('none')} disabled={cancelSaving} className="btn-danger w-full">
                  {cancelSaving ? <Spinner size={15} /> : <><IconX size={15} />Anular sin reembolso</>}
                </button>
                <button onClick={() => setCancelModal(null)} className="btn-ghost w-full justify-center">Cancelar</button>
              </div>
            </div>
          )
        })())}
      </Modal>
    </div>
  )
}
