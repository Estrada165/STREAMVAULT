import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Badge, Tabs } from '@/components/ui'
import { IconPlus, IconEdit, IconTrash, IconDatabase } from '@/assets/icons'

export default function ProveedorStock() {
  const { provider } = useAuth()
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [stockItems, setStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingStock, setLoadingStock] = useState(false)
  const [modal, setModal] = useState(null)
  const [tab, setTab] = useState('available')
  const [form, setForm] = useState({ email: '', password: '', url: '', profile_name: '', profile_pin: '', activation_code: '', extra_notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (provider) fetchProducts() }, [provider])
  useEffect(() => { if (selectedProduct) fetchStock() }, [selectedProduct, tab])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, delivery_type, platforms(name, logo_filename)')
      .eq('provider_id', provider.id)
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
    if (data?.length) setSelectedProduct(data[0])
    setLoading(false)
  }

  async function fetchStock() {
    setLoadingStock(true)
    const isSold = tab === 'sold'
    const { data, error: err } = await supabase
      .from('stock_items')
      .select('id, email, password, url, profile_name, profile_pin, activation_code, extra_notes, is_sold, created_at, order_id')
      .eq('product_id', selectedProduct.id)
      .eq('is_sold', isSold)
      .order('created_at', { ascending: false })

    if (err) { console.error('Stock fetch error:', err); setLoadingStock(false); return }

    // If sold, fetch order info separately
    let ordersMap = {}
    if (isSold && data?.length) {
      const orderIds = data.map(s => s.order_id).filter(Boolean)
      if (orderIds.length) {
        const { data: ords } = await supabase
          .from('orders').select('id, order_code, client_name').in('id', orderIds)
        ords?.forEach(o => { ordersMap[o.id] = o })
      }
    }

    setStockItems((data || []).map(s => ({ ...s, order: ordersMap[s.order_id] || null })))
    setLoadingStock(false)
  }

  function openAdd() {
    setForm({ email: '', password: '', url: '', profile_name: '', profile_pin: '', activation_code: '', extra_notes: '' })
    setError('')
    setModal({ type: 'form' })
  }

  function openEdit(item) {
    setForm({
      email: item.email || '', password: item.password || '', url: item.url || '',
      profile_name: item.profile_name || '', profile_pin: item.profile_pin || '',
      activation_code: item.activation_code || '', extra_notes: item.extra_notes || ''
    })
    setError('')
    setModal({ type: 'form', data: item })
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const payload = {
        email: form.email || null, password: form.password || null,
        url: form.url || null, profile_name: form.profile_name || null,
        profile_pin: form.profile_pin || null, activation_code: form.activation_code || null,
        extra_notes: form.extra_notes || null,
      }
      if (modal?.data) {
        const { error: err } = await supabase.from('stock_items').update(payload).eq('id', modal.data.id)
        if (err) throw err

        // If this item is linked to an order, notify distributor
        if (modal.data.order_id) {
          const { data: ord } = await supabase.from('orders').select('distributor_id, order_code').eq('id', modal.data.order_id).maybeSingle()
          if (ord) {
            await supabase.from('notifications').insert({
              user_id: ord.distributor_id,
              title: 'Credenciales actualizadas',
              message: `Las credenciales de tu pedido ${ord.order_code} fueron actualizadas por el proveedor.`,
              type: 'info', ref_id: modal.data.order_id,
            })
          }
        }
      } else {
        const { error: err } = await supabase.from('stock_items').insert({ ...payload, product_id: selectedProduct.id, is_sold: false })
        if (err) throw err
      }
      setModal(null)
      fetchStock()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function deleteItem(id) {
    if (!confirm('¿Eliminar este item de stock?')) return
    await supabase.from('stock_items').delete().eq('id', id).eq('is_sold', false)
    fetchStock()
  }

  const dt = selectedProduct?.delivery_type
  const showEmail = ['cuenta_completa', 'perfil', 'iptv'].includes(dt)
  const showPassword = ['cuenta_completa', 'perfil', 'iptv'].includes(dt)
  const showUrl = dt === 'iptv'
  const showProfile = dt === 'perfil'
  const showCode = dt === 'codigo'

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  if (!products.length) return (
    <div>
      <PageHeader title="Stock" subtitle="Gestiona las credenciales de tus productos" />
      <div className="card"><EmptyState icon={IconDatabase} title="Sin productos" description="Crea productos primero para poder agregar stock." /></div>
    </div>
  )

  return (
    <div>
      <PageHeader title="Stock" subtitle="Gestiona las credenciales de tus productos" />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Product selector */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 8 }}>Productos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {products.map(p => (
              <button key={p.id} onClick={() => setSelectedProduct(p)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                  background: selectedProduct?.id === p.id ? 'var(--surface-overlay)' : 'transparent',
                  borderColor: selectedProduct?.id === p.id ? 'var(--surface-border-strong)' : 'transparent',
                  color: selectedProduct?.id === p.id ? 'var(--ink)' : 'var(--ink-muted)',
                }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 1 }}>{p.platforms?.name} · {p.delivery_type}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Stock list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <Tabs
              tabs={[{ label: 'Disponible', value: 'available' }, { label: 'Vendido', value: 'sold' }]}
              active={tab} onChange={t => setTab(t)}
            />
            {tab === 'available' && (
              <button className="btn-primary" style={{ fontSize: 12 }} onClick={openAdd}>
                <IconPlus size={14} />Agregar
              </button>
            )}
          </div>

          {loadingStock ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size={24} /></div>
          ) : stockItems.length === 0 ? (
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
              {tab === 'available' ? 'Sin stock disponible. Agrega credenciales con el botón "Agregar".' : 'Sin items vendidos aún.'}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Credenciales</th>
                    {tab === 'sold' && <th>Vendido a</th>}
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                          {item.email && <p style={{ fontFamily: 'DM Mono, monospace', color: 'var(--ink)' }}>{item.email}</p>}
                          {item.url && <p style={{ fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)', fontSize: 11 }}>{item.url.slice(0, 40)}...</p>}
                          {item.profile_name && <p style={{ color: 'var(--ink-muted)' }}>Perfil: {item.profile_name}</p>}
                          {item.activation_code && <p style={{ fontFamily: 'DM Mono, monospace', color: 'var(--ink)' }}>{item.activation_code}</p>}
                          {item.extra_notes && <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 11 }}>{item.extra_notes.slice(0, 50)}</p>}
                        </div>
                      </td>
                      {tab === 'sold' && (
                        <td>
                          <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{item.order?.client_name || '—'}</p>
                          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--ink-faint)' }}>#{item.order?.order_code}</p>
                        </td>
                      )}
                      <td>
                        <Badge color={item.is_sold ? 'red' : 'green'} dot>
                          {item.is_sold ? 'Vendido' : 'Disponible'}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(item)} className="btn-ghost" style={{ padding: '5px 8px' }}>
                            <IconEdit size={13} />
                          </button>
                          {!item.is_sold && (
                            <button onClick={() => deleteItem(item.id)} className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--status-red)' }}>
                              <IconTrash size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal?.type === 'form'} onClose={() => setModal(null)}
        title={modal?.data ? 'Editar credenciales' : `Agregar stock — ${selectedProduct?.name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showEmail && (
            <div>
              <label className="label">Correo</label>
              <input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="correo@ejemplo.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          )}
          {showPassword && (
            <div>
              <label className="label">Contraseña</label>
              <input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="contraseña"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          )}
          {showUrl && (
            <div>
              <label className="label">URL</label>
              <input className="input" style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }} placeholder="http://..."
                value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </div>
          )}
          {showProfile && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="label">Nombre del perfil</label>
                <input className="input" placeholder="Mi Perfil"
                  value={form.profile_name} onChange={e => setForm(f => ({ ...f, profile_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">PIN del perfil</label>
                <input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="1234"
                  value={form.profile_pin} onChange={e => setForm(f => ({ ...f, profile_pin: e.target.value }))} />
              </div>
            </div>
          )}
          {showCode && (
            <div>
              <label className="label">Código único</label>
              <input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="XXXX-XXXX"
                value={form.activation_code} onChange={e => setForm(f => ({ ...f, activation_code: e.target.value }))} />
            </div>
          )}
          {dt === 'activacion_tv' && (
            <div style={{ background: 'var(--status-blue-bg)', border: '1px solid var(--status-blue-border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--status-blue)' }}>
              Para activación TV: usa las instrucciones para guiar al cliente sobre cómo darte su código.
            </div>
          )}
          <div>
            <label className="label">{dt === 'activacion_tv' ? 'Instrucciones para el cliente' : 'Notas adicionales'}</label>
            <textarea className="input" rows={3} style={{ resize: 'none' }}
              placeholder={dt === 'activacion_tv' ? 'Ej: Enciende tu TV, ve a Configuración > Activar y envíame el código que aparece.' : 'Instrucciones adicionales...'}
              value={form.extra_notes} onChange={e => setForm(f => ({ ...f, extra_notes: e.target.value }))} />
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <Spinner size={15} /> : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}