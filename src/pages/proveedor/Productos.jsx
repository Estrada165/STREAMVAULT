import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { Link } from 'react-router-dom'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Toggle, Tabs, Badge, PageLoader, useToast, useConfirm } from '@/components/ui'
import { getPlatformColor } from '@/utils/platform'
import { ProductCover, normalizeCardStyle, CARD_FIT, CARD_POS, CARD_COLOR_USES } from '@/components/shared/ProductCard'
import { IconPlus, IconEdit, IconTrash, IconBox, IconRefreshCw, IconSearch, IconDatabase } from '@/assets/icons'
import { formatUSD, getDeliveryTypeLabel } from '@/utils'

const DELIVERY_TYPES = [
  { value: 'cuenta_completa', label: 'Cuenta Completa' },
  { value: 'perfil', label: 'Perfil' },
  { value: 'iptv', label: 'IPTV' },
  { value: 'activacion_tv', label: 'Activación TV' },
  { value: 'codigo', label: 'Código' },
  { value: 'otro', label: 'Otro (personalizado)' },
]

const CARD_SWATCHES = ['#E50914', '#0063E5', '#1DB954', '#F47521', '#7C3AED', '#0D9488', '#DB2777', '#111827']

/** Personalización de la tarjeta: ajuste de imagen, encuadre y color, con vista previa en vivo */
function CardStyleEditor({ style, onChange, imageUrl, platformName, logoFilename, productName }) {
  const st = normalizeCardStyle(style)
  const set = patch => onChange({ ...st, ...patch })
  const tint = getPlatformColor(platformName)
  return (
    <fieldset className="pt-5 border-t border-[var(--surface-border)]">
      <legend className="eyebrow mb-3">Tarjeta en la tienda</legend>
      <div className="grid sm:grid-cols-[1fr_200px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div>
            <p className="label">Imagen</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CARD_FIT).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set({ fit: k })} aria-pressed={st.fit === k} disabled={!imageUrl}
                  className={`btn-secondary btn-sm !h-auto !py-2 !justify-start text-left !whitespace-normal ${st.fit === k ? 'is-down !border-[var(--a-line)]' : ''}`}>
                  <span><span className="block text-[12.5px]">{v.label}</span><span className="block text-[10.5px] font-medium text-[var(--ink-faint)] leading-tight mt-0.5">{v.hint}</span></span>
                </button>
              ))}
            </div>
            {!imageUrl && <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Agrega una imagen para elegir cómo se muestra.</p>}
          </div>

          {imageUrl && st.fit === 'cover' && (
            <div className="animate-fade-in">
              <p className="label">Parte de la imagen que se conserva</p>
              <div className="inset flex p-1 gap-1 w-fit">
                {Object.entries(CARD_POS).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => set({ pos: k })} aria-pressed={st.pos === k}
                    className={`px-3 h-8 rounded-[.55rem] text-xs font-semibold border transition-all ${st.pos === k ? 'bg-[var(--key)] text-[var(--ink)] border-[var(--surface-border-strong)] shadow-[inset_0_1px_0_var(--hl),0_2px_0_var(--key-edge)]' : 'border-transparent text-[var(--ink-faint)] hover:text-[var(--ink)]'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="label">Color de la tarjeta</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => set({ color: null })} aria-pressed={!st.color}
                className={`btn-secondary btn-sm ${!st.color ? 'is-down !border-[var(--a-line)]' : ''}`}>
                <span className="w-4 h-4 rounded-full border border-[var(--surface-border-strong)]" style={{ background: tint }} />Automático
              </button>
              {CARD_SWATCHES.map(c => (
                <button key={c} type="button" onClick={() => set({ color: c })} aria-label={`Color ${c}`} aria-pressed={st.color === c}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${st.color === c ? 'border-[var(--ink)] scale-110' : 'border-[var(--surface-raised)]'}`}
                  style={{ background: c, boxShadow: '0 2px 6px var(--shadow)' }} />
              ))}
              <label className="relative w-8 h-8 rounded-full cursor-pointer border-2 border-[var(--surface-raised)] overflow-hidden" title="Otro color" style={{ background: 'conic-gradient(from 90deg, #F43F5E, #F59E0B, #22C55E, #06B6D4, #6366F1, #D946EF, #F43F5E)', boxShadow: '0 2px 6px var(--shadow)' }}>
                <input type="color" value={st.color || tint} onChange={e => set({ color: e.target.value.toUpperCase() })} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Elegir otro color" />
              </label>
            </div>
            <p className="text-[11px] text-[var(--ink-faint)] mt-2 leading-relaxed">
              {st.color ? <>Se usa en: {CARD_COLOR_USES.join(' · ').toLowerCase()}.</> : 'Automático usa el color de la plataforma (rojo para Netflix, azul para Disney+…).'}
            </p>
          </div>
        </div>

        {/* Vista previa en vivo */}
        <div className="sm:sticky sm:top-0">
          <div className={`product-card ${st.color ? 'has-color' : ''} pointer-events-none`} style={st.color ? { '--card-c': st.color } : undefined}>
            <div className="relative">
              <ProductCover key={imageUrl + st.fit} imageUrl={imageUrl} platformName={platformName} logoFilename={logoFilename} tint={tint} style={st} />
              {platformName && <span className="absolute top-2 left-2 badge !h-5 !text-[10px] !bg-[var(--surface-raised)] !text-[var(--ink)]"><span className="dot" style={{ color: st.color || tint }} />{platformName}</span>}
            </div>
            <div className="p-3">
              <p className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{productName || 'Nombre del producto'}</p>
              <div className="h-7 mt-2 rounded-lg bg-[var(--a-soft)] border border-[var(--a-line)]" />
            </div>
          </div>
          <p className="text-[11px] text-[var(--ink-faint)] text-center mt-2">Así la verán tus distribuidores</p>
        </div>
      </div>
    </fieldset>
  )
}

function getDisplayPlatformName(product) {
  return product.custom_platform_name || product.platforms?.name || ''
}

function getDisplayDeliveryType(product) {
  if (product.delivery_type === 'otro' && product.custom_delivery_type) return product.custom_delivery_type
  return getDeliveryTypeLabel(product.delivery_type)
}

export default function ProveedorProductos() {
  const { provider } = useAuth()
  const { settings } = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all')
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
    is_renewable: false, renewal_price_pen: '', card_style: {},
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
      // Solo cantidades: el stock sin vender ya no es legible desde el navegador
      const { data: stock } = await supabase.rpc('get_stock_counts', { p_product_ids: ids })
      const counts = {}
      stock?.forEach(s => { counts[s.product_id] = Number(s.available) || 0 })
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
      is_renewable: false, renewal_price_pen: '', card_style: {},
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
      card_style: normalizeCardStyle(p.card_style),
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
      // El estilo de tarjeta solo se envía si se personalizó (requiere el SQL 007)
      const cs = normalizeCardStyle(form.card_style)
      const before = normalizeCardStyle(modal?.data?.card_style)
      if (JSON.stringify(cs) !== JSON.stringify(before)) payload.card_style = cs
      if (modal?.data) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', modal.data.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('products').insert(payload)
        if (err) throw err
      }
      setModal(null); fetchProducts()
      toast.success(modal?.data ? 'Producto actualizado' : 'Producto creado')
    } catch (e) { setError(e.message?.includes('card_style') ? 'Falta ejecutar el SQL 007 (estilo de tarjeta) en Supabase.' : e.message) }
    setSaving(false)
  }

  async function toggleProduct(p) {
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x))
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    toast(p.is_active ? `${p.name} oculto de la tienda` : `${p.name} visible en la tienda`)
  }

  async function deleteProduct(p) {
    const ok = await confirm({ title: '¿Eliminar este producto?', message: `"${p.name}" se borrará junto con su stock y pedidos asociados. No se puede deshacer.`, danger: true, confirmText: 'Eliminar' })
    if (!ok) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) toast.error('Error: ' + error.message)
    else { toast.success('Producto eliminado'); fetchProducts() }
  }

  if (loading) return <PageLoader variant="grid" />

  const q = search.trim().toLowerCase()
  const visibleProducts = products
    .filter(p => view === 'all' || (view === 'on' ? p.is_active : !p.is_active))
    .filter(p => !q || p.name.toLowerCase().includes(q) || getDisplayPlatformName(p).toLowerCase().includes(q))
  const activeCount = products.filter(p => p.is_active).length
  const DURATIONS = [7, 15, 30, 45, 60, 90]

  return (
    <div>
      <PageHeader title="Productos" subtitle={`${products.length} en tu catálogo · ${activeCount} visibles en la tienda`}
        action={<button className="btn-primary" onClick={openCreate}><IconPlus size={16} />Nuevo producto</button>} />

      {products.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconBox} title="Crea tu primer producto" description="Define plataforma, precio y duración. Después sube su stock para venderlo."
            action={<button className="btn-primary" onClick={openCreate}><IconPlus size={16} />Crear producto</button>} />
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <label className="relative flex-1">
              <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
              <input className="input input-icon" placeholder="Buscar producto o plataforma" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar productos" />
            </label>
            <Tabs tabs={[
              { label: 'Todos', value: 'all', count: products.length },
              { label: 'Visibles', value: 'on', count: activeCount },
              { label: 'Ocultos', value: 'off', count: products.length - activeCount },
            ]} active={view} onChange={setView} />
          </div>

          <div className="grid gap-4 grid-cols-1 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 stagger">
            {visibleProducts.map(p => {
              const stock = stockCounts[p.id] || 0
              const platformName = getDisplayPlatformName(p)
              const isStock = p.delivery_mode === 'stock'
              const renewDiff = p.is_renewable && p.renewal_price_usd && parseFloat(p.renewal_price_usd) !== parseFloat(p.price_usd)
              return (
                <article key={p.id} className={`product-card group flex flex-col ${p.is_active ? '' : 'opacity-60'}`}>
                  <div className="relative">
                    <ProductCover className="!aspect-[2/1]" style={p.card_style} imageUrl={p.image_url} platformName={platformName} logoFilename={p.custom_platform_name ? null : p.platforms?.logo_filename} tint={getPlatformColor(platformName)} />
                    {!p.is_active && <span className="absolute top-3 left-3 badge !bg-[var(--surface-raised)]">Oculto</span>}
                  </div>
                  <div className="p-4 flex flex-col gap-4 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[14.5px] text-[var(--ink)] leading-snug line-clamp-2">{p.name}</h3>
                      <p className="text-xs text-[var(--ink-muted)] mt-0.5">{platformName} · {getDisplayDeliveryType(p)} · {p.duration_days} días</p>
                    </div>
                    <Toggle checked={p.is_active} onChange={() => toggleProduct(p)} />
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-xl text-[var(--ink)] leading-none">{formatUSD(p.price_usd)}</p>
                      <p className="text-[11px] text-[var(--ink-faint)] mt-1">S/ {(p.price_usd * rate).toFixed(2)}{renewDiff ? ` · renueva ${formatUSD(p.renewal_price_usd)}` : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {isStock
                        ? <Badge color={stock === 0 ? 'red' : stock < 3 ? 'yellow' : 'green'} dot>{stock === 0 ? 'Sin stock' : `${stock} en stock`}</Badge>
                        : <Badge color="violet">A pedido{p.stock_qty > 0 ? ` · ${p.stock_qty}` : p.stock_qty === 0 ? ' · agotado' : ''}</Badge>}
                      {p.is_renewable && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--b)]"><IconRefreshCw size={11} />Renovable</span>}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-[var(--surface-border)]">
                    <button onClick={() => openEdit(p)} className="btn-secondary btn-sm flex-1"><IconEdit size={13} />Editar</button>
                    {isStock && <Link to="/proveedor/stock" state={{ productId: p.id }} className="btn-secondary btn-sm flex-1"><IconDatabase size={13} />Stock</Link>}
                    <button onClick={() => deleteProduct(p)} className="btn-secondary btn-sm btn-icon hover:!text-[var(--status-red)]" aria-label="Eliminar producto"><IconTrash size={14} /></button>
                  </div>
                  </div>
                </article>
              )
            })}
          </div>
          {visibleProducts.length === 0 && <div className="card mt-2"><EmptyState icon={IconBox} title="Sin resultados" description="Prueba con otro nombre o filtro." /></div>}
        </>
      )}

      <Modal
        open={modal?.type === 'form'}
        onClose={() => setModal(null)}
        title={modal?.data ? 'Editar producto' : 'Nuevo producto'}
        maxWidth="max-w-xl"
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary min-w-[130px]">{saving ? <Spinner size={15} /> : 'Guardar'}</button>
        </>}
      >
        <div className="space-y-5">
          <fieldset className="space-y-4">
            <legend className="eyebrow mb-3">Qué vendes</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Plataforma</label>
                <select className="input" value={form.platform_id} onChange={e => setForm(f => ({ ...f, platform_id: e.target.value, custom_platform_name: '' }))}>
                  <option value="">Seleccionar...</option>
                  {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="__custom__">Otra (escribir)...</option>
                </select>
                {isCustomPlatform && (
                  <input className="input mt-2" placeholder="Ej: Windows, Autodesk..." value={form.custom_platform_name} onChange={e => setForm(f => ({ ...f, custom_platform_name: e.target.value }))} autoFocus />
                )}
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={form.delivery_type} onChange={e => setForm(f => ({ ...f, delivery_type: e.target.value, custom_delivery_type: '' }))}>
                  {DELIVERY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {isCustomType && (
                  <input className="input mt-2" placeholder="Ej: Licencia, Membresía..." value={form.custom_delivery_type} onChange={e => setForm(f => ({ ...f, custom_delivery_type: e.target.value }))} autoFocus />
                )}
              </div>
            </div>
            <div>
              <label className="label">Nombre del producto</label>
              <input className="input" placeholder="Netflix perfil HD 30 días" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Imagen (URL opcional)</label>
              <input className="input" placeholder="https://i.postimg.cc/tu-imagen.png" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value.trim() }))} />
              <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Usa el enlace directo (termina en .png, .jpg o .webp). Si la dejas vacía se usa el logo de la plataforma.</p>
            </div>
          </fieldset>

          <CardStyleEditor
            style={form.card_style}
            onChange={card_style => setForm(f => ({ ...f, card_style }))}
            imageUrl={form.image_url}
            platformName={form.custom_platform_name || platforms.find(x => x.id === form.platform_id)?.name || ''}
            logoFilename={isCustomPlatform ? null : platforms.find(x => x.id === form.platform_id)?.logo_filename}
            productName={form.name}
          />

          <fieldset className="space-y-4 pt-5 border-t border-[var(--surface-border)]">
            <legend className="eyebrow mb-3">Precio y duración</legend>
            <div>
              <label className="label">Precio en soles</label>
              <label className="inset flex items-center gap-2 px-3.5 focus-within:border-[var(--a)]">
                <span className="font-mono text-[var(--ink-faint)]">S/</span>
                <input type="number" inputMode="decimal" step="0.10" min="0" className="flex-1 min-w-0 bg-transparent outline-none font-mono text-lg py-2.5 text-[var(--ink)]" placeholder="0.00" value={form.price_pen} onChange={e => setForm(f => ({ ...f, price_pen: e.target.value }))} aria-label="Precio en soles" />
                {form.price_pen > 0 && <span className="text-xs font-mono text-[var(--a)]">= {formatUSD(usdFromForm)}</span>}
              </label>
              <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Tipo de cambio: S/ {rate}</p>
            </div>
            <div>
              <label className="label">Duración</label>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map(d => (
                  <button key={d} type="button" onClick={() => setForm(f => ({ ...f, duration_days: d }))} className={`btn-secondary btn-sm min-w-[56px] ${form.duration_days === d ? 'is-down !text-[var(--a)]' : ''}`}>{d} d</button>
                ))}
                <label className={`inset flex items-center gap-1.5 px-3 h-9 ${!DURATIONS.includes(form.duration_days) ? '!border-[var(--a)]' : ''}`}>
                  <input type="number" min="1" className="w-14 bg-transparent outline-none font-mono text-sm text-[var(--ink)]" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) || 30 }))} aria-label="Duración personalizada" />
                  <span className="text-xs text-[var(--ink-faint)]">días</span>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 pt-5 border-t border-[var(--surface-border)]">
            <legend className="eyebrow mb-3">Entrega</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {[{ value: 'stock', label: 'En stock', sub: 'Se entrega al instante' }, { value: 'pedido', label: 'A pedido', sub: 'Cargas las credenciales después' }].map(m => (
                <button key={m.value} type="button" onClick={() => setForm(f => ({ ...f, delivery_mode: m.value }))}
                  className={`btn-secondary !h-auto !py-3 !justify-start text-left !whitespace-normal ${form.delivery_mode === m.value ? 'is-down !border-[var(--a-line)]' : ''}`}>
                  <span className="dot flex-shrink-0" style={{ color: form.delivery_mode === m.value ? 'var(--a)' : 'var(--surface-border-strong)' }} />
                  <span><span className="block text-sm">{m.label}</span><span className="block text-[11px] font-medium text-[var(--ink-faint)]">{m.sub}</span></span>
                </button>
              ))}
            </div>
            {form.delivery_mode === 'pedido' && (
              <div className="animate-fade-in">
                <label className="label">Cupos disponibles (opcional)</label>
                <input type="number" min="0" className="input" placeholder="Vacío = sin límite" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))} />
                <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Vacío = sin límite · 0 = agotado · un número = cupos que verá el distribuidor.</p>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3 pt-5 border-t border-[var(--surface-border)]">
            <div className={`rounded-2xl border transition-colors ${form.is_renewable ? 'border-[var(--b-line)] bg-[var(--b-soft)]' : 'border-[var(--surface-border)]'}`}>
              <div className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-xl grid place-items-center ${form.is_renewable ? 'bg-[var(--b)] text-white' : 'inset text-[var(--ink-faint)]'}`}><IconRefreshCw size={16} /></span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">Producto renovable</p>
                    <p className="text-[11px] text-[var(--ink-muted)]">El distribuidor puede pedir renovarlo</p>
                  </div>
                </div>
                <Toggle checked={form.is_renewable} onChange={v => setForm(f => ({ ...f, is_renewable: v, renewal_price_pen: v ? f.price_pen : '' }))} />
              </div>
              {form.is_renewable && (
                <div className="px-3.5 pb-3.5 animate-fade-in">
                  <label className="label">Precio de renovación en soles</label>
                  <input type="number" step="0.10" min="0" className="input" placeholder={`Vacío = mismo precio (S/ ${form.price_pen || '0.00'})`} value={form.renewal_price_pen} onChange={e => setForm(f => ({ ...f, renewal_price_pen: e.target.value }))} />
                  {form.renewal_price_pen > 0 && <p className="text-[11px] font-mono text-[var(--b)] mt-1.5">= {formatUSD(renewalUsdFromForm)}</p>}
                </div>
              )}
            </div>
          </fieldset>

          <details className="group pt-5 border-t border-[var(--surface-border)]" open={!!(form.terms || form.warranty || form.what_includes)}>
            <summary className="eyebrow cursor-pointer list-none flex items-center justify-between">
              Detalles para el distribuidor <span className="transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-3 mt-4">
              <div>
                <label className="label">¿Qué incluye?</label>
                <textarea className="input" rows={2} placeholder="1 perfil personal · HD" value={form.what_includes} onChange={e => setForm(f => ({ ...f, what_includes: e.target.value }))} />
              </div>
              <div>
                <label className="label">Términos y condiciones</label>
                <textarea className="input" rows={2} placeholder="No cambiar la contraseña..." value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} />
              </div>
              <div>
                <label className="label">Garantía</label>
                <textarea className="input" rows={2} placeholder="Garantía por todo el periodo..." value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} />
              </div>
            </div>
          </details>

          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
