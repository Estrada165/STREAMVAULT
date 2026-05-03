import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Toggle } from '@/components/ui'
import { IconPlus, IconEdit, IconTrash, IconBox, IconRefreshCw } from '@/assets/icons'
import { formatUSD, getLogoPath, getDeliveryTypeLabel } from '@/utils'

const DELIVERY_TYPES = [
  { value: 'cuenta_completa', label: 'Cuenta Completa' },
  { value: 'perfil', label: 'Perfil' },
  { value: 'iptv', label: 'IPTV' },
  { value: 'activacion_tv', label: 'Activación TV' },
  { value: 'codigo', label: 'Código' },
  { value: 'otro', label: 'Otro (personalizado)' },
]

function getPlatformColor(name = '') {
  const n = name.toLowerCase()
  if (n.includes('netflix')) return '#e50914'
  if (n.includes('disney')) return '#006e99'
  if (n.includes('hbo') || n.includes('max')) return '#5822b4'
  if (n.includes('amazon') || n.includes('prime')) return '#ff9900'
  if (n.includes('spotify')) return '#1db954'
  if (n.includes('youtube')) return '#ff0000'
  if (n.includes('crunchyroll')) return '#f47521'
  if (n.includes('apple')) return '#555555'
  if (n.includes('paramount')) return '#0064ff'
  if (n.includes('movistar')) return '#019df4'
  if (n.includes('claro')) return '#da291c'
  if (n.includes('directv')) return '#00a8e0'
  if (n.includes('deezer')) return '#a238ff'
  return '#6b7280'
}

function getDisplayPlatformName(product) {
  return product.custom_platform_name || product.platforms?.name || ''
}

function getDisplayDeliveryType(product) {
  if (product.delivery_type === 'otro' && product.custom_delivery_type) return product.custom_delivery_type
  return getDeliveryTypeLabel(product.delivery_type)
}

function ProductCardHeader({ imageUrl, logoFilename, platformName, accentColor }) {
  const [imgErr, setImgErr] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const logoPath = getLogoPath(logoFilename)
  const showImage = imageUrl && !imgErr
  return (
    <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', flexShrink: 0, background: showImage ? `${accentColor}18` : `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}08 100%)` }}>
      {showImage ? (
        <>
          <img src={imageUrl} alt={platformName} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={() => setImgErr(true)} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '3px 8px 3px 4px' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accentColor}40` }}>
              {logoPath && !logoErr ? <img src={logoPath} alt={platformName} style={{ width: 14, height: 14, objectFit: 'contain' }} onError={() => setLogoErr(true)} /> : <span style={{ fontSize: 8, fontWeight: 800, color: '#fff' }}>{(platformName || '?')[0]}</span>}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>{platformName}</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: '55%', height: '55%', borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)` }} />
            <div style={{ width: 46, height: 46, borderRadius: 14, background: `${accentColor}20`, border: `1.5px solid ${accentColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {logoPath && !logoErr ? <img src={logoPath} alt={platformName} style={{ width: 34, height: 34, objectFit: 'contain' }} onError={() => setLogoErr(true)} /> : <span style={{ fontSize: 19, fontWeight: 800, color: accentColor }}>{(platformName || '?')[0]}</span>}
            </div>
          </div>
          <p style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: `${accentColor}cc` }}>{platformName}</p>
        </>
      )}
    </div>
  )
}

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
    platform_id: '', custom_platform_name: '', name: '',
    delivery_type: 'perfil', custom_delivery_type: '',
    delivery_mode: 'stock', price_pen: '', duration_days: 30, stock_qty: '',
    terms: '', warranty: '', what_includes: '', image_url: '',
    is_renewable: false, renewal_price_pen: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isCustomPlatform = form.platform_id === '__custom__'
  const isCustomType = form.delivery_type === 'otro'
  const penToUsd = (pen) => pen > 0 ? (pen / rate).toFixed(2) : ''
  const usdFromForm = penToUsd(parseFloat(form.price_pen) || 0)
  const renewalUsdFromForm = penToUsd(parseFloat(form.renewal_price_pen) || 0)

  useEffect(() => { if (provider) { fetchProducts(); fetchPlatforms() } }, [provider])

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*, platforms(*)').eq('provider_id', provider.id).order('created_at', { ascending: false })
    setProducts(data || [])
    if (data?.length) {
      const ids = data.map(p => p.id)
      const { data: stock } = await supabase.from('stock_items').select('product_id').in('product_id', ids).eq('is_sold', false)
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

  function openCreate() {
    setForm({
      platform_id: platforms[0]?.id || '', custom_platform_name: '',
      name: '', delivery_type: 'perfil', custom_delivery_type: '',
      delivery_mode: 'stock', price_pen: '', duration_days: 30, stock_qty: '',
      terms: '', warranty: '', what_includes: '', image_url: '',
      is_renewable: false, renewal_price_pen: '',
    })
    setError(''); setModal({ type: 'form' })
  }

  function openEdit(p) {
    setForm({
      platform_id: p.custom_platform_name ? '__custom__' : (p.platform_id || ''),
      custom_platform_name: p.custom_platform_name || '',
      name: p.name, delivery_type: p.delivery_type,
      custom_delivery_type: p.custom_delivery_type || '',
      delivery_mode: p.delivery_mode,
      price_pen: (p.price_usd * rate).toFixed(2),
      duration_days: p.duration_days, stock_qty: p.stock_qty ?? '',
      terms: p.terms || '', warranty: p.warranty || '',
      what_includes: p.what_includes || '', image_url: p.image_url || '',
      is_renewable: p.is_renewable || false,
      renewal_price_pen: p.renewal_price_usd ? (p.renewal_price_usd * rate).toFixed(2) : '',
    })
    setError(''); setModal({ type: 'form', data: p })
  }

  async function save() {
    if (!isCustomPlatform && !form.platform_id) return setError('Selecciona una plataforma')
    if (isCustomPlatform && !form.custom_platform_name.trim()) return setError('Escribe el nombre de la plataforma')
    if (!form.name) return setError('El nombre del producto es requerido')
    if (isCustomType && !form.custom_delivery_type.trim()) return setError('Escribe el tipo personalizado')
    const penVal = parseFloat(form.price_pen)
    if (!penVal || penVal <= 0) return setError('Ingresa un precio en soles válido')
    const priceUsd = parseFloat(penToUsd(penVal))
    if (!priceUsd) return setError('Error al convertir el precio')

    let renewalPriceUsd = null
    if (form.is_renewable) {
      const rp = parseFloat(form.renewal_price_pen)
      renewalPriceUsd = rp > 0 ? parseFloat(penToUsd(rp)) : priceUsd
    }

    setSaving(true); setError('')
    try {
      const payload = {
        platform_id: isCustomPlatform ? null : (form.platform_id || null),
        custom_platform_name: isCustomPlatform ? form.custom_platform_name.trim() : null,
        name: form.name,
        delivery_type: form.delivery_type,
        custom_delivery_type: isCustomType ? form.custom_delivery_type.trim() : null,
        delivery_mode: form.delivery_mode,
        price_usd: priceUsd,
        duration_days: parseInt(form.duration_days),
        stock_qty: form.delivery_mode === 'pedido' && form.stock_qty !== '' ? parseInt(form.stock_qty) : null,
        terms: form.terms || null, warranty: form.warranty || null,
        what_includes: form.what_includes || null,
        provider_id: provider.id,
        image_url: form.image_url || null,
        is_renewable: form.is_renewable,
        renewal_price_usd: renewalPriceUsd,
      }
      if (modal?.data) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', modal.data.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('products').insert(payload)
        if (err) throw err
      }
      setModal(null); fetchProducts()
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
      <PageHeader title="Productos" subtitle="Gestiona tu catálogo de streaming"
        action={<button className="btn-primary" onClick={openCreate}><IconPlus size={15} />Nuevo producto</button>} />

      {products.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconBox} title="Sin productos" description="Crea tu primer producto."
            action={<button className="btn-primary" onClick={openCreate}><IconPlus size={15} />Crear</button>} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }} className="stagger">
          {products.map(p => {
            const stock = stockCounts[p.id] || 0
            const platformName = getDisplayPlatformName(p)
            const accentColor = getPlatformColor(platformName)
            return (
              <div key={p.id} style={{ borderRadius: 14, border: '1px solid var(--surface-border)', overflow: 'hidden', opacity: p.is_active ? 1 : 0.5, display: 'flex', flexDirection: 'column', background: 'var(--surface-raised)', boxShadow: `inset 3px 0 0 ${accentColor}`, transition: 'box-shadow 0.2s, transform 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentColor}, var(--shadow-elevated)`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentColor}`; e.currentTarget.style.transform = '' }}
              >
                <ProductCardHeader imageUrl={p.image_url || null} logoFilename={p.platforms?.logo_filename} platformName={platformName} accentColor={accentColor} />
                <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>{getDisplayDeliveryType(p)}</span>
                    <span className={`badge ${p.delivery_mode === 'stock' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>
                      {p.delivery_mode === 'stock' ? `Stock: ${stock}` : 'A pedido'}
                    </span>
                    {p.is_renewable && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99, background: 'var(--status-green-bg)', color: 'var(--status-green)', border: '1px solid var(--status-green-border)' }}>
                        <IconRefreshCw size={9} />Renovable
                      </span>
                    )}
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>{formatUSD(p.price_usd)}</p>
                    <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>≈ S/ {(p.price_usd * rate).toFixed(2)} · {p.duration_days}d</p>
                    {p.is_renewable && p.renewal_price_usd && parseFloat(p.renewal_price_usd) !== parseFloat(p.price_usd) && (
                      <p style={{ fontSize: 11, color: 'var(--status-green)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IconRefreshCw size={9} />Renov. {formatUSD(p.renewal_price_usd)} ≈ S/ {(p.renewal_price_usd * rate).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div style={{ height: 1, background: 'var(--surface-border)', margin: '0 -14px' }} />
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
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal?.type === 'form'} onClose={() => setModal(null)} title={modal?.data ? 'Editar producto' : 'Nuevo producto'} maxWidth="max-w-lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4, paddingBottom: 4 }}>

          {/* Plataforma */}
          <div>
            <label className="label">Plataforma *</label>
            <select className="input" value={form.platform_id} onChange={e => setForm(f => ({ ...f, platform_id: e.target.value, custom_platform_name: '' }))}>
              <option value="">Seleccionar...</option>
              {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__custom__">✏️ Escribir manualmente...</option>
            </select>
            {isCustomPlatform && (
              <input className="input" style={{ marginTop: 8 }} placeholder="Ej: Windows, Autodesk, Canva Pro..."
                value={form.custom_platform_name} onChange={e => setForm(f => ({ ...f, custom_platform_name: e.target.value }))} autoFocus />
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="label">Tipo *</label>
            <select className="input" value={form.delivery_type} onChange={e => setForm(f => ({ ...f, delivery_type: e.target.value, custom_delivery_type: '' }))}>
              {DELIVERY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {isCustomType && (
              <input className="input" style={{ marginTop: 8 }} placeholder="Ej: Licencia, Membresía, Acceso..."
                value={form.custom_delivery_type} onChange={e => setForm(f => ({ ...f, custom_delivery_type: e.target.value }))} autoFocus />
            )}
          </div>

          <div>
            <label className="label">Nombre del producto *</label>
            <input className="input" placeholder="Ej: Netflix Perfil HD 30 días" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div>
            <label className="label">Imagen <span style={{ fontWeight: 400, color: 'var(--ink-faint)', textTransform: 'none', letterSpacing: 0 }}>URL opcional</span></label>
            <input className="input" placeholder="https://i.postimg.cc/tu-imagen.png" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Si no pones URL se usa el logo de la plataforma</p>
            {form.image_url && (
              <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--surface-border)', aspectRatio: '16/9', background: 'var(--surface-overlay)' }}>
                <img src={form.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.parentElement.style.display = 'none' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Precio en S/ Soles *</label>
              <input type="number" step="0.10" min="0" className="input" placeholder="0.00" value={form.price_pen} onChange={e => setForm(f => ({ ...f, price_pen: e.target.value }))} />
              {form.price_pen > 0 && <p style={{ fontSize: 11, color: 'var(--status-green)', marginTop: 4 }}>= {formatUSD(usdFromForm)} (TC: S/{rate})</p>}
            </div>
            <div>
              <label className="label">Duración (días)</label>
              <input type="number" min="1" className="input" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="label">Modo de entrega</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ value: 'stock', label: 'En Stock', sub: 'Entrega automática' }, { value: 'pedido', label: 'A Pedido', sub: 'Entrega manual' }].map(m => (
                <button key={m.value} type="button" onClick={() => setForm(f => ({ ...f, delivery_mode: m.value }))}
                  style={{ padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', border: form.delivery_mode === m.value ? '2px solid var(--ink)' : '1px solid var(--surface-border)', background: form.delivery_mode === m.value ? 'var(--surface-overlay)' : 'var(--surface-raised)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{m.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {form.delivery_mode === 'pedido' && (
            <div>
              <label className="label">Disponibilidad (opcional)</label>
              <input type="number" min="0" className="input" placeholder="Ej: 5 — dejar vacío para sin límite" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))} />
              <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4, lineHeight: 1.5 }}>Vacío = sin límite · <strong>0</strong> = agotado · <strong>N</strong> = muestra "Pedido: N"</p>
            </div>
          )}

          <div>
            <label className="label">Términos y condiciones</label>
            <textarea className="input" rows={2} placeholder="Condiciones del producto..." value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="label">Garantía</label>
            <textarea className="input" rows={2} placeholder="Descripción de la garantía..." value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="label">¿Qué incluye?</label>
            <textarea className="input" rows={2} placeholder="Descripción del contenido..." value={form.what_includes} onChange={e => setForm(f => ({ ...f, what_includes: e.target.value }))} style={{ resize: 'none' }} />
          </div>

          {/* ── RENOVACIÓN — al final para no bloquear el scroll ── */}
          <div style={{ borderRadius: 12, border: `2px solid ${form.is_renewable ? 'var(--status-green-border)' : 'var(--surface-border)'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: form.is_renewable ? 'var(--status-green-bg)' : 'var(--surface-overlay)', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setForm(f => ({ ...f, is_renewable: !f.is_renewable, renewal_price_pen: !f.is_renewable ? f.price_pen : '' }))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: form.is_renewable ? 'var(--status-green)' : 'var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', flexShrink: 0 }}>
                  <IconRefreshCw size={15} style={{ color: form.is_renewable ? '#fff' : 'var(--ink-faint)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: form.is_renewable ? 'var(--status-green)' : 'var(--ink)' }}>Producto renovable</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Activa para configurar precio de renovación</p>
                </div>
              </div>
              <div style={{ width: 42, height: 24, borderRadius: 99, background: form.is_renewable ? 'var(--status-green)' : 'var(--surface-border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 4, left: form.is_renewable ? 22 : 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </div>
            </div>
            {form.is_renewable && (
              <div style={{ padding: '12px 14px', borderTop: `1px solid var(--status-green-border)`, background: 'var(--surface-raised)' }}>
                <label className="label">Precio de renovación en S/ Soles</label>
                <input type="number" step="0.10" min="0" className="input"
                  placeholder={`Dejar vacío = mismo precio (S/ ${form.price_pen || '0.00'})`}
                  value={form.renewal_price_pen}
                  onChange={e => setForm(f => ({ ...f, renewal_price_pen: e.target.value }))} />
                {form.renewal_price_pen > 0
                  ? <p style={{ fontSize: 11, color: 'var(--status-green)', marginTop: 4 }}>= {formatUSD(renewalUsdFromForm)} (TC: S/{rate})</p>
                  : <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Si lo dejas vacío, el precio de renovación será igual al precio base</p>
                }
              </div>
            )}
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