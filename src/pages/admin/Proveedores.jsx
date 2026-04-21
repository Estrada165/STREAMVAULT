import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, Badge, EmptyState } from '@/components/ui'
import { IconUsers, IconSearch, IconEdit, IconTrash, IconWhatsApp } from '@/assets/icons'
import { daysRemaining, getDaysColor, formatDate } from '@/utils'

export default function AdminProveedores() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [extendDays, setExtendDays] = useState(30)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCost, setEditCost] = useState('')

  useEffect(() => { fetchProviders() }, [])

  async function fetchProviders() {
    const { data: provs } = await supabase.from('providers').select('*').order('created_at', { ascending: false })
    if (!provs?.length) { setProviders([]); setLoading(false); return }
    const userIds = provs.map(p => p.user_id)
    const { data: usersData } = await supabase.from('users').select('id, email, full_name, phone, is_active').in('id', userIds)
    const usersMap = {}
    usersData?.forEach(u => { usersMap[u.id] = u })
    setProviders(provs.map(p => ({ ...p, users: usersMap[p.user_id] || {} })))
    setLoading(false)
  }

  async function toggleActive(provider) {
    const newActive = !provider.is_active
    await supabase.from('providers').update({ is_active: newActive }).eq('id', provider.id)
    await supabase.from('users').update({ is_active: newActive }).eq('id', provider.user_id)
    if (!newActive) {
      await supabase.from('users').update({ is_active: false }).eq('provider_id', provider.id).eq('role', 'distribuidor')
    }
    fetchProviders()
  }

  async function extendAccess() {
    if (!extendDays || extendDays === 0) return setError('Ingresa un número de días distinto de 0')
    setSaving(true); setError('')
    try {
      const current = modal.data.expires_at ? new Date(modal.data.expires_at) : new Date()
      const base = current > new Date() ? current : new Date()
      base.setDate(base.getDate() + parseInt(extendDays))
      const finalDate = base < new Date() ? new Date() : base
      await supabase.from('providers').update({
        expires_at: finalDate.toISOString(),
        is_active: parseInt(extendDays) > 0 ? true : modal.data.is_active
      }).eq('id', modal.data.id)
      await supabase.from('users').update({
        is_active: parseInt(extendDays) > 0 ? true : modal.data.is_active
      }).eq('id', modal.data.user_id)
      setModal(null); fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  function openEdit(provider) {
    setEditPhone(provider.users?.phone || '')
    setEditCost(provider.renewal_cost || '')
    setError('')
    setModal({ type: 'edit', data: provider })
  }

  async function saveEdit() {
    setSaving(true); setError('')
    try {
      await supabase.from('users').update({ phone: editPhone.trim() || null }).eq('id', modal.data.user_id)
      await supabase.from('providers').update({ renewal_cost: editCost.trim() || null }).eq('id', modal.data.id)
      setModal(null); fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  function sendRenewalMessage(provider) {
    const phone = (provider.users?.phone || '').replace(/\D/g, '')
    if (!phone) return alert('Este proveedor no tiene número de teléfono configurado.')
    const name = provider.display_name || provider.users?.full_name || 'Proveedor'
    const days = provider.expires_at ? daysRemaining(provider.expires_at) : null
    const daysText = days !== null && days <= 0 ? 'ya ha vencido' : days !== null ? `vence en ${days} día${days === 1 ? '' : 's'}` : 'está próximo a vencer'
    const costText = provider.renewal_cost ? `El costo de renovación es *${provider.renewal_cost}*.` : ''
    const msg = `Hola ${name}! 👋\n\nTu acceso a *StreamVault* ${daysText}.\n${costText}\n\nPara continuar disfrutando del servicio, por favor coordina tu renovación. ¡Gracias!`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function openDelete(provider) {
    setModal({ type: 'delete', data: provider })
    setDeleteConfirmText(''); setError('')
  }

  async function confirmDeleteProvider() {
    if (deleteConfirmText !== 'ELIMINAR') return
    const provider = modal.data
    setSaving(true); setError('')
    try {
      const { data: products } = await supabase.from('products').select('id').eq('provider_id', provider.id)
      const productIds = products?.map(p => p.id) || []
      if (productIds.length) {
        await supabase.from('orders').update({ stock_item_id: null }).in('product_id', productIds)
        await supabase.from('orders').delete().in('product_id', productIds)
        await supabase.from('stock_items').delete().in('product_id', productIds)
        await supabase.from('support_tickets').delete().eq('provider_id', provider.id)
        await supabase.from('products').delete().eq('provider_id', provider.id)
      }
      await supabase.from('users').update({ is_active: false, provider_id: null }).eq('provider_id', provider.id)
      await supabase.from('providers').delete().eq('id', provider.id)
      await supabase.from('users').update({ is_active: false }).eq('id', provider.user_id)
      setModal(null); fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const filtered = providers.filter(p =>
    (p.display_name || p.users?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.users?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || '').includes(search.toLowerCase())
  )

  // Botón de acción compacto
  const Btn = ({ onClick, title, children, variant = 'ghost', color }) => {
    const base = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: 32, height: 32, borderRadius: 8, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 12, transition: 'opacity 0.15s', flexShrink: 0 }
    const styles = {
      ghost: { ...base, background: 'var(--surface-overlay)', color: color || 'var(--ink-faint)', border: '1px solid var(--surface-border)' },
      green: { ...base, background: '#25d366', color: '#fff' },
      red:   { ...base, background: 'var(--status-red-bg)', color: 'var(--status-red)', border: '1px solid var(--status-red-border)' },
    }
    return <button onClick={onClick} title={title} style={styles[variant]}>{children}</button>
  }

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Gestiona el acceso de proveedores a la plataforma"
        action={
          <button className="btn-secondary" onClick={() => setModal({ type: 'info' })}>
            <IconUsers size={15} />¿Cómo agregar?
          </button>
        }
      />

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar por nombre, email o código..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={IconUsers} title="Sin proveedores" description="Los proveedores aparecen aquí cuando se registran en la app." /></div>
      ) : (
        /* Cards en lugar de tabla — más adaptables y estéticas */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => {
            const days = p.expires_at ? daysRemaining(p.expires_at) : null
            const dColor = days !== null ? getDaysColor(days) : null
            const isExpiringSoon = days !== null && days <= 7
            const hasPhone = !!p.users?.phone

            return (
              <div key={p.id} style={{
                background: 'var(--surface-raised)',
                border: `1px solid ${isExpiringSoon && p.is_active ? 'var(--status-yellow-border)' : 'var(--surface-border)'}`,
                borderLeft: `3px solid ${p.is_active ? 'var(--status-green)' : 'var(--ink-faint)'}`,
                borderRadius: '0 12px 12px 0',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>

                {/* ── Identidad ── */}
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>
                    {p.display_name || p.users?.full_name || '—'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {p.users?.email}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, background: 'var(--surface-overlay)', padding: '2px 7px', borderRadius: 6, color: 'var(--ink-muted)', border: '1px solid var(--surface-border)' }}>
                      {p.slug}
                    </span>
                    <Badge color={p.is_active ? 'green' : 'red'} dot>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                </div>

                {/* ── Teléfono ── */}
                <div style={{ flex: '0 0 130px', minWidth: 100 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 3 }}>Teléfono</p>
                  {hasPhone
                    ? <a href={`https://wa.me/${p.users.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: 'var(--status-green)', textDecoration: 'none', fontWeight: 500 }}>
                        {p.users.phone}
                      </a>
                    : <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Sin teléfono</span>
                  }
                </div>

                {/* ── Costo renovación ── */}
                <div style={{ flex: '0 0 90px', minWidth: 70 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 3 }}>Costo</p>
                  {p.renewal_cost
                    ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Syne, sans-serif' }}>{p.renewal_cost}</span>
                    : <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>—</span>
                  }
                </div>

                {/* ── Días / Vence ── */}
                <div style={{ flex: '0 0 90px', minWidth: 70 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 3 }}>Vence</p>
                  {days !== null
                    ? <>
                        <span className={`days-pill ${dColor}`} style={{ fontSize: 11 }}>
                          {days <= 0 ? 'Vencido' : `${days}d`}
                        </span>
                        <p style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 3 }}>{formatDate(p.expires_at)}</p>
                      </>
                    : <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>
                  }
                </div>

                {/* ── Acciones ── */}
                <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                  {/* Días */}
                  <Btn onClick={() => { setModal({ type: 'extend', data: p }); setExtendDays(30); setError('') }} title="Ajustar días">
                    <IconEdit size={13} />
                  </Btn>
                  {/* Editar info */}
                  <Btn onClick={() => openEdit(p)} title="Editar teléfono y costo">
                    <IconUsers size={13} />
                  </Btn>
                  {/* WhatsApp renovación */}
                  {hasPhone && (
                    <Btn onClick={() => sendRenewalMessage(p)} title="Enviar aviso de renovación"
                      variant={isExpiringSoon ? 'green' : 'ghost'}
                      color={!isExpiringSoon ? '#25d366' : undefined}>
                      <IconWhatsApp size={13} />
                    </Btn>
                  )}
                  {/* Activar / Desactivar */}
                  <Btn onClick={() => toggleActive(p)} title={p.is_active ? 'Desactivar' : 'Activar'}
                    color={p.is_active ? 'var(--status-red)' : 'var(--status-green)'}>
                    {p.is_active
                      ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                      : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    }
                  </Btn>
                  {/* Eliminar */}
                  <Btn onClick={() => openDelete(p)} title="Eliminar proveedor" variant="red">
                    <IconTrash size={13} />
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal editar teléfono + costo ── */}
      <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Editar información del proveedor">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--ink-muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>{modal?.data?.display_name || modal?.data?.users?.full_name || modal?.data?.users?.email}</strong>
          </div>
          <div>
            <label className="label">Número de WhatsApp / Teléfono</label>
            <input className="input" placeholder="+51 999 999 999" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Se guardará en la base de datos.</p>
          </div>
          <div>
            <label className="label">Costo de renovación</label>
            <input className="input" placeholder="Ej: S/ 30, $8, S/ 50/mes" value={editCost} onChange={e => setEditCost(e.target.value)} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Se incluirá en el mensaje de WhatsApp de renovación.</p>
          </div>
          {(editPhone || editCost) && (
            <div style={{ background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 6 }}>Preview del mensaje</p>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {`Hola ${modal?.data?.display_name || modal?.data?.users?.full_name || 'Proveedor'}! 👋\n\nTu acceso a *StreamVault* vence en X días.\n${editCost ? `El costo de renovación es *${editCost}*.` : ''}\n\nPara continuar disfrutando del servicio, por favor coordina tu renovación. ¡Gracias!`}
              </p>
            </div>
          )}
          {error && <Alert type="error">{error}</Alert>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <Spinner size={15} /> : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal ajustar días ── */}
      <Modal open={modal?.type === 'extend'} onClose={() => setModal(null)} title="Ajustar días de acceso">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--ink-muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>{modal?.data?.display_name || modal?.data?.users?.full_name || modal?.data?.users?.email}</strong>
            <br /><span style={{ fontSize: 12 }}>Vence actualmente: {formatDate(modal?.data?.expires_at) || 'Sin fecha'}</span>
          </div>
          <div>
            <label className="label">Días a sumar o restar</label>
            <input type="number" className="input" value={extendDays} onChange={e => setExtendDays(e.target.value)} placeholder="Ej: 30 para sumar, -15 para restar" />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Usa números negativos para restar días</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {[-30, -15, -7, 7, 15, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setExtendDays(d)}
                  style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, background: extendDays === d ? 'var(--ink)' : 'var(--surface-overlay)', color: extendDays === d ? 'var(--surface)' : d < 0 ? 'var(--status-red)' : 'var(--ink-muted)', border: `1px solid ${extendDays === d ? 'var(--ink)' : 'var(--surface-border)'}` }}>
                  {d > 0 ? `+${d}d` : `${d}d`}
                </button>
              ))}
            </div>
            {modal?.data?.expires_at && extendDays !== '' && extendDays !== 0 && (
              <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8 }}>
                Nueva fecha: <strong style={{ color: 'var(--ink)' }}>
                  {(() => {
                    const base = new Date(modal.data.expires_at) > new Date() ? new Date(modal.data.expires_at) : new Date()
                    base.setDate(base.getDate() + parseInt(extendDays))
                    return base > new Date() ? base.toLocaleDateString('es-PE') : 'Hoy (mínimo)'
                  })()}
                </strong>
              </p>
            )}
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={extendAccess} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <Spinner size={15} /> : parseInt(extendDays) >= 0 ? `+${extendDays} días` : `${extendDays} días`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal info ── */}
      <Modal open={modal?.type === 'info'} onClose={() => setModal(null)} title="Agregar proveedor">
        <Alert type="info">
          El proveedor debe registrarse en <strong>/register</strong> con rol "Proveedor". Luego aparece aquí para que actives su acceso y le des días.
        </Alert>
        <button onClick={() => setModal(null)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>Entendido</button>
      </Modal>

      {/* ── Modal eliminar ── */}
      <Modal open={modal?.type === 'delete'} onClose={() => setModal(null)} title="Eliminar proveedor">
        {modal?.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--status-red-bg)', border: '1px solid var(--status-red-border)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
              <p style={{ fontWeight: 700, color: 'var(--status-red)', marginBottom: 8 }}>⚠ Esta acción es irreversible</p>
              <p style={{ color: 'var(--status-red)', marginBottom: 8 }}>Al eliminar a <strong>{modal.data.display_name || modal.data.users?.email}</strong> se borrará permanentemente:</p>
              <ul style={{ color: 'var(--status-red)', fontSize: 12, paddingLeft: 16, lineHeight: 2 }}>
                <li>Su cuenta y acceso a la plataforma</li>
                <li>Todos sus productos y stock</li>
                <li>Todos los pedidos vinculados a sus productos</li>
                <li>Todos sus tickets de soporte</li>
                <li>Sus distribuidores no serán eliminados, pero perderán acceso a sus productos</li>
              </ul>
              <p style={{ color: 'var(--status-red)', fontWeight: 600, marginTop: 8 }}>No hay forma de recuperar esta información.</p>
            </div>
            <div>
              <label className="label">Escribe <span style={{ color: 'var(--status-red)', fontWeight: 700 }}>ELIMINAR</span> para confirmar</label>
              <input className="input" placeholder="ELIMINAR" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} autoComplete="off" />
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={confirmDeleteProvider} disabled={saving || deleteConfirmText !== 'ELIMINAR'} className="btn-danger"
                style={{ flex: 1, justifyContent: 'center', opacity: deleteConfirmText !== 'ELIMINAR' ? 0.4 : 1 }}>
                {saving ? <Spinner size={15} /> : 'Eliminar todo'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}