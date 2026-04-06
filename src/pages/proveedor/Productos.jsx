import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Badge, Toggle } from '@/components/ui'
import { IconPlus, IconEdit, IconTrash, IconBox } from '@/assets/icons'
import { formatUSD, getLogoPath, getDeliveryTypeLabel } from '@/utils'

const DELIVERY_TYPES = [
  { value: 'cuenta_completa', label: 'Cuenta Completa' },
  { value: 'perfil', label: 'Perfil' },
  { value: 'iptv', label: 'IPTV' },
  { value: 'activacion_tv', label: 'Activación TV' },
  { value: 'codigo', label: 'Código' },
]

export default function ProveedorProductos() {
  const { provider } = useAuth()
  const { settings } = useSettings()
  const rate = parseFloat(settings.exchange_rate) || 3.5

  const [products, setProducts] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [stockCounts, setStockCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({
    platform_id: '', name: '', delivery_type: 'perfil',
    delivery_mode: 'stock', price_pen: '', duration_days: 30,
    terms: '', warranty: '', what_includes: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (provider) { fetchProducts(); fetchPlatforms() } }, [provider])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products').select('*, platforms(*)')
      .eq('provider_id', provider.id).order('created_at', { ascending: false })
    setProducts(data || [])

    if (data?.length) {
      const ids = data.map(p => p.id)
      const { data: stock } = await supabase
        .from('stock_items').select('product_id').in('product_id', ids).eq('is_sold', false)
      const counts = {}
      stock?.forEach(s => { counts[s.product_id] = (counts[s.product_id] || 0) + 1 })
      setStockCounts(counts)
    }
    setLoading(false)
  }

  async function fetchPlatforms() {
    const { data } = await supabase.from('platforms').select('*').eq('is_active', true).order('name')
    setPlatforms(data || [])
  }

  const penToUsd = (pen) => pen > 0 ? (pen / rate).toFixed(2) : ''
  const usdFromForm = penToUsd(parseFloat(form.price_pen) || 0)

  function openCreate() {
    setForm({ platform_id: platforms[0]?.id || '', name: '', delivery_type: 'perfil', delivery_mode: 'stock', price_pen: '', duration_days: 30, terms: '', warranty: '', what_includes: '' })
    setError('')
    setModal({ type: 'form' })
  }

  function openEdit(p) {
    setForm({
      platform_id: p.platform_id, name: p.name, delivery_type: p.delivery_type,
      delivery_mode: p.delivery_mode, price_pen: (p.price_usd * rate).toFixed(2),
      duration_days: p.duration_days, terms: p.terms || '',
      warranty: p.warranty || '', what_includes: p.what_includes || '',
    })
    setError('')
    setModal({ type: 'form', data: p })
  }

  async function save() {
    if (!form.platform_id || !form.name) return setError('Plataforma y nombre son requeridos')
    const penVal = parseFloat(form.price_pen)
    if (!penVal || penVal <= 0) return setError('Ingresa un precio en soles válido')
    const priceUsd = parseFloat(penToUsd(penVal))
    if (!priceUsd) return setError('Error al convertir el precio')

    setSaving(true); setError('')
    try {
      const payload = {
        platform_id: form.platform_id, name: form.name,
        delivery_type: form.delivery_type, delivery_mode: form.delivery_mode,
        price_usd: priceUsd, duration_days: parseInt(form.duration_days),
        terms: form.terms || null, warranty: form.warranty || null,
        what_includes: form.what_includes || null, provider_id: provider.id,
      }
      if (modal?.data) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', modal.data.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('products').insert(payload)
        if (err) throw err
      }
      setModal(null)
      fetchProducts()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function toggleProduct(p) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    fetchProducts()
  }

  async function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchProducts()
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Gestiona tu catálogo de streaming"
        action={<button className="btn-primary" onClick={openCreate}><IconPlus size={15} />Nuevo producto</button>}
      />

      {products.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconBox} title="Sin productos" description="Crea tu primer producto."
            action={<button className="btn-primary" onClick={openCreate}><IconPlus size={15} />Crear</button>} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }} className="stagger">
          {products.map(p => {
            const stock = stockCounts[p.id] || 0
            return (
              <div key={p.id} className="card" style={{ padding: 16, opacity: p.is_active ? 1 : 0.5, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={getLogoPath(p.platforms?.logo_filename)} alt={p.platforms?.name}
                      style={{ width: 32, height: 32, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{p.platforms?.name}</p>
                    <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{getDeliveryTypeLabel(p.delivery_type)}</span>
                  <span className={`badge ${p.delivery_mode === 'stock' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>
                    {p.delivery_mode === 'stock' ? `Stock: ${stock}` : 'A pedido'}
                  </span>
                </div>

                <div>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{formatUSD(p.price_usd)}</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>≈ S/ {(p.price_usd * rate).toFixed(2)} · {p.duration_days}d</p>
                </div>

                <div style={{ height: 1, background: 'var(--surface-border)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => openEdit(p)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px 10px' }}>
                    <IconEdit size={13} />Editar
                  </button>
                  <Toggle checked={p.is_active} onChange={() => toggleProduct(p)} />
                  <button onClick={() => deleteProduct(p.id)} className="btn-ghost" style={{ padding: '7px 9px', color: 'var(--status-red)' }}>
                    <IconTrash size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modal?.type === 'form'} onClose={() => setModal(null)}
        title={modal?.data ? 'Editar producto' : 'Nuevo producto'} maxWidth="max-w-lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '72vh', overflowY: 'auto', paddingRight: 2 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Plataforma *</label>
              <select className="input" value={form.platform_id} onChange={e => setForm(f => ({ ...f, platform_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="input" value={form.delivery_type} onChange={e => setForm(f => ({ ...f, delivery_type: e.target.value }))}>
                {DELIVERY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Nombre del producto *</label>
            <input className="input" placeholder="Ej: Netflix Perfil HD 30 días" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {/* PEN price with USD conversion */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Precio en S/ Soles *</label>
              <input type="number" step="0.10" min="0" className="input" placeholder="0.00"
                value={form.price_pen} onChange={e => setForm(f => ({ ...f, price_pen: e.target.value }))} />
              {form.price_pen > 0 && (
                <p style={{ fontSize: 11, color: 'var(--status-green)', marginTop: 4 }}>
                  = {formatUSD(usdFromForm)} (TC: S/{rate})
                </p>
              )}
            </div>
            <div>
              <label className="label">Duración (días)</label>
              <input type="number" min="1" className="input" value={form.duration_days}
                onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) }))} />
            </div>
          </div>

          {/* Delivery mode */}
          <div>
            <label className="label">Modo de entrega</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ value: 'stock', label: 'En Stock', sub: 'Entrega automática' }, { value: 'pedido', label: 'A Pedido', sub: 'Entrega manual' }].map(m => (
                <button key={m.value} type="button" onClick={() => setForm(f => ({ ...f, delivery_mode: m.value }))}
                  style={{
                    padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: form.delivery_mode === m.value ? '2px solid var(--ink)' : '1px solid var(--surface-border)',
                    background: form.delivery_mode === m.value ? 'var(--surface-overlay)' : 'var(--surface-raised)',
                  }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{m.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Términos y condiciones</label>
            <textarea className="input" rows={2} placeholder="Condiciones del producto..." value={form.terms}
              onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="label">Garantía</label>
            <textarea className="input" rows={2} placeholder="Descripción de la garantía..." value={form.warranty}
              onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="label">¿Qué incluye?</label>
            <textarea className="input" rows={2} placeholder="Descripción del contenido..." value={form.what_includes}
              onChange={e => setForm(f => ({ ...f, what_includes: e.target.value }))} style={{ resize: 'none' }} />
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
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