import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, Badge, EmptyState } from '@/components/ui'
import { IconUsers, IconSearch, IconEdit, IconTrash } from '@/assets/icons'
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
      // If result is in the past (restando demasiado), usar hoy
      const finalDate = base < new Date() ? new Date() : base
      await supabase.from('providers').update({ expires_at: finalDate.toISOString(), is_active: parseInt(extendDays) > 0 ? true : modal.data.is_active }).eq('id', modal.data.id)
      await supabase.from('users').update({ is_active: parseInt(extendDays) > 0 ? true : modal.data.is_active }).eq('id', modal.data.user_id)
      setModal(null); fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  function openDelete(provider) {
    setModal({ type: 'delete', data: provider })
    setDeleteConfirmText('')
    setError('')
  }

  async function confirmDeleteProvider() {
    if (deleteConfirmText !== 'ELIMINAR') return
    const provider = modal.data
    setSaving(true); setError('')
    try {
      const { data: products } = await supabase.from('products').select('id').eq('provider_id', provider.id)
      const productIds = products?.map(p => p.id) || []

      if (productIds.length) {
        // Unlink stock items from orders so orders can be deleted
        await supabase.from('orders').update({ stock_item_id: null }).in('product_id', productIds)
        // Delete orders
        await supabase.from('orders').delete().in('product_id', productIds)
        // Delete stock items
        await supabase.from('stock_items').delete().in('product_id', productIds)
        // Delete support tickets
        await supabase.from('support_tickets').delete().eq('provider_id', provider.id)
        // Delete products
        await supabase.from('products').delete().eq('provider_id', provider.id)
      }

      // Deactivate distributors
      await supabase.from('users').update({ is_active: false, provider_id: null }).eq('provider_id', provider.id)
      // Delete provider
      await supabase.from('providers').delete().eq('id', provider.id)
      // Deactivate user
      await supabase.from('users').update({ is_active: false }).eq('id', provider.user_id)
      

      setModal(null)
      fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const filtered = providers.filter(p =>
    (p.display_name || p.users?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.users?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || '').includes(search.toLowerCase())
  )

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
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Teléfono</th>
                <th>Código</th>
                <th>Estado</th>
                <th>Días rest.</th>
                <th>Vence</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const days = p.expires_at ? daysRemaining(p.expires_at) : null
                const dColor = days !== null ? getDaysColor(days) : null
                return (
                  <tr key={p.id}>
                    <td>
                      <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{p.display_name || p.users?.full_name || '—'}</p>
                      <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{p.users?.email}</p>
                    </td>
                    <td>
                      {p.users?.phone
                        ? <a href={`https://wa.me/${p.users.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: 'var(--status-green)', textDecoration: 'none', fontWeight: 500 }}>
                            {p.users.phone}
                          </a>
                        : <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>—</span>
                      }
                    </td>
                    <td>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, background: 'var(--surface-overlay)', padding: '2px 8px', borderRadius: 6 }}>{p.slug}</span>
                    </td>
                    <td><Badge color={p.is_active ? 'green' : 'red'} dot>{p.is_active ? 'Activo' : 'Inactivo'}</Badge></td>
                    <td>
                      {days !== null
                        ? <span className={`days-pill ${dColor}`}>{days <= 0 ? 'Vencido' : `${days}d`}</span>
                        : <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{formatDate(p.expires_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => { setModal({ type: 'extend', data: p }); setExtendDays(30); setError('') }}
                          className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                          <IconEdit size={13} />Días
                        </button>
                        <button onClick={() => toggleActive(p)}
                          className="btn-ghost" style={{ fontSize: 12, color: p.is_active ? 'var(--status-red)' : 'var(--status-green)' }}>
                          {p.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => openDelete(p)} className="btn-ghost" style={{ padding: '6px 8px', color: 'var(--status-red)' }}>
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Extend/Subtract days modal */}
      <Modal open={modal?.type === 'extend'} onClose={() => setModal(null)} title="Ajustar días de acceso">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--ink-muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>{modal?.data?.display_name || modal?.data?.users?.full_name || modal?.data?.users?.email}</strong>
            <br />
            <span style={{ fontSize: 12 }}>Vence actualmente: {formatDate(modal?.data?.expires_at) || 'Sin fecha'}</span>
          </div>
          <div>
            <label className="label">Días a sumar o restar</label>
            <input
              type="number"
              className="input"
              value={extendDays}
              onChange={e => setExtendDays(e.target.value)}
              placeholder="Ej: 30 para sumar, -15 para restar"
            />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
              Usa números negativos para restar días (ej: -15)
            </p>
            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {[-30, -15, -7, 7, 15, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setExtendDays(d)}
                  style={{
                    padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                    background: extendDays === d ? 'var(--ink)' : 'var(--surface-overlay)',
                    color: extendDays === d ? 'var(--surface)' : d < 0 ? 'var(--status-red)' : 'var(--ink-muted)',
                    border: `1px solid ${extendDays === d ? 'var(--ink)' : 'var(--surface-border)'}`,
                  }}>
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

      {/* Info modal */}
      <Modal open={modal?.type === 'info'} onClose={() => setModal(null)} title="Agregar proveedor">
        <Alert type="info">
          El proveedor debe registrarse en <strong>/register</strong> con rol "Proveedor". Luego aparece aquí para que actives su acceso y le des días.
        </Alert>
        <button onClick={() => setModal(null)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>Entendido</button>
      </Modal>

      {/* Delete confirmation modal — pure React state, no DOM manipulation */}
      <Modal open={modal?.type === 'delete'} onClose={() => setModal(null)} title="Eliminar proveedor">
        {modal?.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--status-red-bg)', border: '1px solid var(--status-red-border)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
              <p style={{ fontWeight: 700, color: 'var(--status-red)', marginBottom: 8 }}>⚠ Esta acción es irreversible</p>
              <p style={{ color: 'var(--status-red)', marginBottom: 8 }}>
                Al eliminar a <strong>{modal.data.display_name || modal.data.users?.email}</strong> se borrará permanentemente:
              </p>
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
              <label className="label">
                Escribe <span style={{ color: 'var(--status-red)', fontWeight: 700 }}>ELIMINAR</span> para confirmar
              </label>
              <input
                className="input"
                placeholder="ELIMINAR"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button
                onClick={confirmDeleteProvider}
                disabled={saving || deleteConfirmText !== 'ELIMINAR'}
                className="btn-danger"
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
