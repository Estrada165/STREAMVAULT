import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, Badge, EmptyState } from '@/components/ui'
import { IconPlus, IconPower, IconEdit, IconSearch, IconTrash } from '@/assets/icons'
import { daysRemaining, getDaysColor, formatDate } from '@/utils'

export default function AdminProveedores() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [extendDays, setExtendDays] = useState(30)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { fetchProviders() }, [])

  async function fetchProviders() {
    const { data: provs } = await supabase
      .from('providers')
      .select('*')
      .order('created_at', { ascending: false })

    if (!provs?.length) { setLoading(false); return }

    const userIds = provs.map(p => p.user_id)
    const { data: usersData } = await supabase
      .from('users').select('id, email, full_name, is_active').in('id', userIds)

    const usersMap = {}
    usersData?.forEach(u => { usersMap[u.id] = u })
    setProviders(provs.map(p => ({ ...p, users: usersMap[p.user_id] || {} })))
    setLoading(false)
  }

  async function toggleActive(provider) {
    await supabase.from('providers').update({ is_active: !provider.is_active }).eq('id', provider.id)
    await supabase.from('users').update({ is_active: !provider.is_active }).eq('id', provider.users?.id)
    fetchProviders()
  }

  async function extendAccess() {
    setSaving(true); setError('')
    try {
      const current = modal.data.expires_at ? new Date(modal.data.expires_at) : new Date()
      const base = current > new Date() ? current : new Date()
      base.setDate(base.getDate() + parseInt(extendDays))
      await supabase.from('providers').update({ expires_at: base.toISOString(), is_active: true }).eq('id', modal.data.id)
      await supabase.from('users').update({ is_active: true }).eq('id', modal.data.users?.id)
      setModal(null); fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function deleteProvider() {
    if (deleteConfirmText !== 'eliminar') return
    setDeleting(true); setDeleteError('')
    try {
      const p = deleteModal

      // 1. Obtener todos los productos del proveedor
      const { data: products } = await supabase
        .from('products').select('id').eq('provider_id', p.id)
      const productIds = (products || []).map(x => x.id)

      if (productIds.length) {
        // 2. Obtener todos los stock_items de esos productos
        const { data: stocks } = await supabase
          .from('stock_items').select('id').in('product_id', productIds)
        const stockIds = (stocks || []).map(x => x.id)

        if (stockIds.length) {
          // 3. Borrar órdenes vinculadas al stock
          await supabase.from('orders').delete().in('stock_item_id', stockIds)
          // 4. Borrar stock_items
          await supabase.from('stock_items').delete().in('product_id', productIds)
        }

        // 5. Borrar productos
        await supabase.from('products').delete().in('id', productIds)
      }

      // 6. Borrar support_tickets del proveedor
      await supabase.from('support_tickets').delete().eq('provider_id', p.id)

      // 7. Borrar notificaciones relacionadas (si la tabla las tiene por user_id)
      if (p.user_id) {
        await supabase.from('notifications').delete().eq('user_id', p.user_id)
      }

      // 8. Desactivar y borrar el registro de proveedor
      await supabase.from('users').update({ is_active: false }).eq('id', p.user_id)
      const { error: err } = await supabase.from('providers').delete().eq('id', p.id)
      if (err) throw err

      setDeleteModal(null)
      setDeleteConfirmText('')
      fetchProviders()
    } catch (e) { setDeleteError(e.message) }
    setDeleting(false)
  }

  const filtered = providers.filter(p =>
    (p.display_name || p.users?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.users?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Gestiona el acceso de proveedores a la plataforma"
        action={
          <button className="btn-primary" onClick={() => setModal({ type: 'info' })}>
            <IconPlus size={16} />Nuevo proveedor
          </button>
        }
      />

      <div className="relative mb-5">
        <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
        <input className="input pl-9" placeholder="Buscar por nombre, email o código..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="flex justify-center py-20"><Spinner size={32} /></div> : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Días restantes</th>
                  <th>Vence</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const days = p.expires_at ? daysRemaining(p.expires_at) : null
                  const dColor = days !== null ? getDaysColor(days) : 'neutral'
                  return (
                    <tr key={p.id}>
                      <td>
                        <div>
                          <p className="font-medium text-[var(--ink)]">{p.display_name || p.users?.full_name || '—'}</p>
                          <p className="text-xs text-[var(--ink-faint)]">{p.users?.email}</p>
                        </div>
                      </td>
                      <td><span className="font-mono text-xs bg-[var(--surface-overlay)] px-2 py-0.5 rounded-md">{p.slug}</span></td>
                      <td><Badge color={p.is_active ? 'green' : 'red'} dot>{p.is_active ? 'Activo' : 'Inactivo'}</Badge></td>
                      <td>
                        {days !== null ? (
                          <span className={`text-xs font-mono font-semibold
                            ${dColor === 'green' ? 'text-[var(--status-green)]' : ''}
                            ${dColor === 'yellow' ? 'text-[var(--status-yellow)]' : ''}
                            ${dColor === 'red' ? 'text-[var(--status-red)]' : ''}
                          `}>
                            {days <= 0 ? 'Vencido' : `${days}d`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-xs text-[var(--ink-muted)]">{formatDate(p.expires_at)}</td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => { setModal({ type: 'extend', data: p }); setExtendDays(30) }}
                            className="btn-secondary text-xs py-1.5 px-2.5">
                            <IconEdit size={13} />Extender
                          </button>
                          <button onClick={() => toggleActive(p)}
                            className={`btn-ghost text-xs py-1.5 px-2.5 ${p.is_active ? 'text-[var(--status-red)]' : 'text-[var(--status-green)]'}`}>
                            <IconPower size={13} />
                            {p.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => { setDeleteModal(p); setDeleteConfirmText(''); setDeleteError('') }}
                            className="btn-ghost text-xs py-1.5 px-2.5 text-[var(--status-red)]">
                            <IconTrash size={13} />Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-[var(--ink-faint)] py-10">Sin proveedores</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Extender acceso */}
      <Modal open={modal?.type === 'extend'} onClose={() => setModal(null)} title="Extender acceso">
        <div className="space-y-4">
          <div className="bg-[var(--surface-overlay)] rounded-xl p-3 text-sm text-[var(--ink-muted)]">
            <strong className="text-[var(--ink)]">{modal?.data?.display_name || modal?.data?.users?.full_name}</strong>
            <br /><span className="text-xs font-mono">{modal?.data?.slug}</span>
          </div>
          <div>
            <label className="label">Días a agregar</label>
            <select className="input" value={extendDays} onChange={e => setExtendDays(e.target.value)}>
              {[7, 15, 30, 60, 90, 180, 365].map(d => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={extendAccess} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Spinner size={16} /> : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Info nuevo proveedor */}
      <Modal open={modal?.type === 'info'} onClose={() => setModal(null)} title="Agregar proveedor">
        <Alert type="info">
          El proveedor debe registrarse en <strong>/register</strong> con rol "Proveedor". Una vez registrado, aparecerá aquí y podrás activarlo y extender su acceso.
        </Alert>
        <button onClick={() => setModal(null)} className="btn-primary w-full justify-center mt-4">Entendido</button>
      </Modal>

      {/* Modal: Confirmar eliminación */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar proveedor" maxWidth="max-w-sm">
        {deleteModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--status-red-bg)', border: '1px solid var(--status-red)', borderRadius: 10, padding: '12px 14px', fontSize: 12 }}>
              <p style={{ fontWeight: 700, color: 'var(--status-red)', marginBottom: 6 }}>⚠ Esta acción es irreversible</p>
              <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
                Al eliminar a <strong>{deleteModal.display_name || deleteModal.users?.full_name}</strong> se borrará permanentemente:
              </p>
              <ul style={{ marginTop: 8, paddingLeft: 16, color: 'var(--ink-muted)', lineHeight: 1.9, fontSize: 12 }}>
                <li>Su cuenta y acceso a la plataforma</li>
                <li>Todos sus productos y stock</li>
                <li>Todos los pedidos vinculados a sus productos</li>
                <li>Todos sus tickets de soporte</li>
                <li>Sus distribuidores no serán eliminados, pero perderán acceso a sus productos</li>
              </ul>
              <p style={{ marginTop: 8, color: 'var(--status-red)', fontWeight: 600 }}>
                No hay forma de recuperar esta información.
              </p>
            </div>

            <div>
              <label className="label">
                Escribe <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--status-red)' }}>eliminar</span> para confirmar
              </label>
              <input
                className="input"
                placeholder="eliminar"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value.toLowerCase())}
                style={{ borderColor: deleteConfirmText === 'eliminar' ? 'var(--status-red)' : undefined }}
              />
            </div>

            {deleteError && <Alert type="error">{deleteError}</Alert>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                Cancelar
              </button>
              <button
                onClick={deleteProvider}
                disabled={deleting || deleteConfirmText !== 'eliminar'}
                className="btn-danger"
                style={{ flex: 1, justifyContent: 'center', opacity: deleteConfirmText !== 'eliminar' ? 0.4 : 1 }}
              >
                {deleting ? <Spinner size={15} /> : 'Eliminar todo'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}