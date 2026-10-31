import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Tabs, PageLoader, SkeletonList, useToast, useConfirm } from '@/components/ui'
import { PlatformLogo } from '@/utils/platform'
import { IconPlus, IconEdit, IconTrash, IconDatabase, IconUpload, IconSearch } from '@/assets/icons'

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
  const [counts, setCounts] = useState({})
  const [bulkText, setBulkText] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [revealed, setRevealed] = useState({})
  const toast = useToast()
  const confirm = useConfirm()
  const location = useLocation()

  useEffect(() => { if (provider) fetchProducts() }, [provider])
  useEffect(() => { if (selectedProduct) fetchStock() }, [selectedProduct, tab])

  async function fetchProducts() {
    let { data } = await supabase
      .from('products')
      .select('id, name, delivery_type, delivery_mode, platforms(name, logo_filename)')
      .eq('provider_id', provider.id)
      .eq('is_active', true)
      .order('name')
    // Solo productos con entrega inmediata (los "a pedido" no usan stock)
    data = (data || []).filter(p => p.delivery_mode !== 'pedido')
    setProducts(data)
    // Only set selectedProduct on first load, not on every refresh
    if (data?.length && !selectedProduct) setSelectedProduct(data.find(p => p.id === location.state?.productId) || data[0])
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
      // En lotes de 100 (con cientos de IDs la URL es demasiado larga)
      for (let i = 0; i < orderIds.length; i += 100) {
        const { data: ords } = await supabase
          .from('orders').select('id, order_code, client_name').in('id', orderIds.slice(i, i + 100))
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
      fetchStock(); refreshCounts()
      toast.success(modal?.data ? 'Credenciales actualizadas' : 'Stock agregado')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function deleteItem(id) {
    const ok = await confirm({ title: '¿Eliminar este ítem?', message: 'Las credenciales se borran del stock.', danger: true, confirmText: 'Eliminar' })
    if (!ok) return
    // No filtramos por is_sold para permitir borrar items de órdenes canceladas
    const { error: delErr } = await supabase.from('stock_items').delete().eq('id', id)
    if (delErr) { toast.error('Error al eliminar: ' + delErr.message); return }
    setStockItems(prev => prev.filter(x => x.id !== id))
    refreshCounts()
    toast('Ítem eliminado')
  }

  // ── Carga en lote: una cuenta por línea ──
  const BULK_FIELDS = {
    perfil: ['email', 'password', 'profile_name', 'profile_pin'],
    cuenta_completa: ['email', 'password'],
    iptv: ['email', 'password', 'url'],
    codigo: ['activation_code'],
    activacion_tv: ['extra_notes'],
  }
  const FIELD_LABEL = { email: 'correo', password: 'contraseña', profile_name: 'perfil', profile_pin: 'pin', url: 'url', activation_code: 'código', extra_notes: 'nota' }
  const bulkFields = BULK_FIELDS[selectedProduct?.delivery_type] || ['email', 'password']
  const bulkRows = bulkText.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    // Si la línea usa | ; o tabulación se separa solo por eso (así las URL con : no se rompen)
    const parts = (/[|;\t]/.test(line) ? line.split(/[|;\t]/) : line.split(':')).map(x => x.trim())
    const row = {}
    bulkFields.forEach((f, i) => { row[f] = parts[i] || null })
    return row
  }).filter(r => Object.values(r).some(Boolean))

  async function saveBulk() {
    if (!bulkRows.length) return setError('Pega al menos una línea')
    setSaving(true); setError('')
    const { error: err } = await supabase.from('stock_items').insert(bulkRows.map(r => ({ ...r, product_id: selectedProduct.id, is_sold: false })))
    setSaving(false)
    if (err) return setError(err.message)
    setModal(null); setBulkText('')
    setTab('available'); fetchStock(); refreshCounts()
    toast.success(`${bulkRows.length} cuenta${bulkRows.length !== 1 ? 's' : ''} agregada${bulkRows.length !== 1 ? 's' : ''} al stock`)
  }

  async function refreshCounts() {
    if (!products.length) return
    const { data } = await supabase.rpc('get_stock_counts', { p_product_ids: products.map(p => p.id) })
    const m = Object.fromEntries(products.map(p => [p.id, 0])); (data || []).forEach(c => { m[c.product_id] = Number(c.available) || 0 })
    setCounts(m)
  }
  useEffect(() => { refreshCounts() }, [products.length])

  const dt = selectedProduct?.delivery_type
  const showEmail = ['cuenta_completa', 'perfil', 'iptv'].includes(dt)
  const showPassword = ['cuenta_completa', 'perfil', 'iptv'].includes(dt)
  const showUrl = dt === 'iptv'
  const showProfile = dt === 'perfil'
  const showCode = dt === 'codigo'

  if (loading) return <PageLoader />

  if (!products.length) return (
    <div>
      <PageHeader title="Stock" subtitle="Las credenciales que vendes" />
      <div className="card"><EmptyState icon={IconDatabase} title="Primero crea un producto" description="El stock se agrega a productos activos de entrega inmediata." action={<Link to="/proveedor/productos" className="btn-primary">Ir a productos</Link>} /></div>
    </div>
  )

  const q = itemSearch.trim().toLowerCase()
  const items = q ? stockItems.filter(i => [i.email, i.profile_name, i.activation_code, i.order?.client_name, i.order?.order_code].some(v => (v || '').toLowerCase().includes(q))) : stockItems

  return (
    <div>
      <PageHeader title="Stock" subtitle="Las credenciales que vendes, por producto" />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
        {/* Selector de producto */}
        <div className="lg:sticky lg:top-6">
          <p className="eyebrow mb-2.5 hidden lg:block">Productos</p>
          <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 pb-1">
            {products.map(p => {
              const on = selectedProduct?.id === p.id
              const c = counts[p.id] ?? null
              return (
                <button key={p.id} onClick={() => { setSelectedProduct(p); setItemSearch('') }}
                  className={`flex-shrink-0 lg:w-full flex items-center gap-3 text-left rounded-xl border px-3 py-2.5 transition-all ${on ? 'bg-[var(--key)] border-[var(--surface-border-strong)] shadow-[inset_0_1px_0_var(--hl),0_3px_0_var(--a-edge),0_6px_14px_var(--shadow)]' : 'border-transparent hover:bg-[var(--surface-overlay)]'}`}>
                  <PlatformLogo name={p.platforms?.name} filename={p.platforms?.logo_filename} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-semibold truncate max-w-[180px] ${on ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}>{p.name}</span>
                    <span className="block text-[11px] text-[var(--ink-faint)]">{p.platforms?.name}</span>
                  </span>
                  {c !== null && <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${c === 0 ? 'text-[var(--status-red)] bg-[var(--status-red-bg)]' : c < 3 ? 'text-[var(--status-yellow)] bg-[var(--status-yellow-bg)]' : 'text-[var(--a)] bg-[var(--a-soft)]'}`}>{c}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista */}
        <section className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--surface-border)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PlatformLogo name={selectedProduct?.platforms?.name} filename={selectedProduct?.platforms?.logo_filename} size={40} />
                <div className="min-w-0">
                  <h2 className="font-display font-semibold text-[var(--ink)] truncate">{selectedProduct?.name}</h2>
                  <p className="text-xs text-[var(--ink-muted)]">{counts[selectedProduct?.id] ?? 0} disponibles</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" onClick={() => { setBulkText(''); setError(''); setModal({ type: 'bulk' }) }}><IconUpload size={14} />En lote</button>
                <button className="btn-primary btn-sm" onClick={openAdd}><IconPlus size={14} />Agregar</button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Tabs tabs={[{ label: 'Disponible', value: 'available' }, { label: 'Vendido', value: 'sold' }]} active={tab} onChange={t => setTab(t)} />
              <label className="relative flex-1">
                <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
                <input className="input input-icon !min-h-[2.5rem]" placeholder={tab === 'sold' ? 'Buscar correo, cliente o pedido' : 'Buscar correo o perfil'} value={itemSearch} onChange={e => setItemSearch(e.target.value)} aria-label="Buscar en stock" />
              </label>
            </div>
          </div>

          {loadingStock ? <div className="p-2"><SkeletonList rows={4} avatar={false} /></div> : items.length === 0 ? (
            <EmptyState
              icon={IconDatabase}
              title={tab === 'available' ? 'Sin stock disponible' : 'Nada vendido todavía'}
              description={tab === 'available' ? 'Agrega cuentas una por una o pega varias de golpe con "En lote".' : 'Aquí verás a quién se entregó cada cuenta.'}
            />
          ) : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {items.map(item => (
                <li key={item.id} className="flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-[var(--surface-side)] transition-colors">
                  <span className="dot mt-2" style={{ color: item.is_sold ? 'var(--ink-faint)' : 'var(--a)' }} />
                  <div className="flex-1 min-w-0 text-[13px] leading-relaxed">
                    {item.email && <p className="font-mono text-[var(--ink)] truncate">{item.email}</p>}
                    {item.password && <p className="font-mono text-[var(--ink-muted)]">{revealed[item.id] ? item.password : '••••••••'} <button className="text-[11px] text-[var(--a)] font-sans font-semibold ml-1" onClick={() => setRevealed(r => ({ ...r, [item.id]: !r[item.id] }))}>{revealed[item.id] ? 'ocultar' : 'ver'}</button></p>}
                    {item.profile_name && <p className="text-[var(--ink-muted)]">Perfil: {item.profile_name}{item.profile_pin ? ` · PIN ${revealed[item.id] ? item.profile_pin : '••••'}` : ''}</p>}
                    {item.url && <p className="font-mono text-[11px] text-[var(--ink-muted)] truncate">{item.url}</p>}
                    {item.activation_code && <p className="font-mono text-[var(--ink)]">{item.activation_code}</p>}
                    {item.extra_notes && <p className="text-xs text-[var(--ink-faint)] italic truncate">{item.extra_notes}</p>}
                    {tab === 'sold' && <p className="text-xs text-[var(--ink-faint)] mt-0.5">→ {item.order?.client_name || 'Sin cliente'} <span className="font-mono">#{item.order?.order_code}</span></p>}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="btn-secondary btn-sm btn-icon" aria-label="Editar"><IconEdit size={14} /></button>
                    {tab === 'available' && <button onClick={() => deleteItem(item.id)} className="btn-secondary btn-sm btn-icon hover:!text-[var(--status-red)]" aria-label="Eliminar"><IconTrash size={14} /></button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Agregar / editar uno */}
      <Modal
        open={modal?.type === 'form'}
        onClose={() => setModal(null)}
        title={modal?.data ? 'Editar credenciales' : 'Agregar al stock'}
        subtitle={selectedProduct?.name}
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary min-w-[120px]">{saving ? <Spinner size={15} /> : 'Guardar'}</button>
        </>}
      >
        <div className="space-y-4">
          {modal?.data?.order_id && <Alert type="info">Esta cuenta ya se vendió. Al guardar, el distribuidor recibe un aviso de credenciales actualizadas.</Alert>}
          {showEmail && <div><label className="label">Correo</label><input className="input font-mono" placeholder="correo@ejemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>}
          {showPassword && <div><label className="label">Contraseña</label><input className="input font-mono" placeholder="contraseña" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>}
          {showUrl && <div><label className="label">URL</label><input className="input font-mono !text-[13px]" placeholder="http://..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} /></div>}
          {showProfile && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nombre del perfil</label><input className="input" placeholder="Perfil 1" value={form.profile_name} onChange={e => setForm(f => ({ ...f, profile_name: e.target.value }))} /></div>
              <div><label className="label">PIN</label><input className="input font-mono" placeholder="1234" value={form.profile_pin} onChange={e => setForm(f => ({ ...f, profile_pin: e.target.value }))} /></div>
            </div>
          )}
          {showCode && <div><label className="label">Código</label><input className="input font-mono" placeholder="XXXX-XXXX" value={form.activation_code} onChange={e => setForm(f => ({ ...f, activation_code: e.target.value }))} /></div>}
          {dt === 'activacion_tv' && <Alert type="info">Activación TV: escribe las instrucciones para que el cliente te envíe el código de su televisor.</Alert>}
          <div>
            <label className="label">{dt === 'activacion_tv' ? 'Instrucciones para el cliente' : 'Notas (opcional)'}</label>
            <textarea className="input" rows={3} placeholder={dt === 'activacion_tv' ? 'Enciende tu TV, ve a Configuración > Activar y envíame el código.' : 'Instrucciones adicionales...'} value={form.extra_notes} onChange={e => setForm(f => ({ ...f, extra_notes: e.target.value }))} />
          </div>
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>

      {/* Carga en lote */}
      <Modal
        open={modal?.type === 'bulk'}
        onClose={() => setModal(null)}
        title="Agregar en lote"
        subtitle={selectedProduct?.name}
        maxWidth="max-w-xl"
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={saveBulk} disabled={saving || !bulkRows.length} className="btn-primary min-w-[160px]">{saving ? <Spinner size={15} /> : `Agregar ${bulkRows.length || ''} cuenta${bulkRows.length === 1 ? '' : 's'}`}</button>
        </>}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed">
            Una cuenta por línea, en este orden: <span className="font-mono text-[var(--ink)]">{bulkFields.map(f => FIELD_LABEL[f]).join(' | ')}</span>. Puedes separar con <span className="font-mono">|</span>, <span className="font-mono">;</span>, tabulación o <span className="font-mono">:</span>
          </p>
          <textarea
            className="input font-mono !text-[12.5px]"
            rows={9}
            autoFocus
            placeholder={bulkFields.map(f => ({ email: 'cuenta1@correo.com', password: 'Clave123', profile_name: 'Perfil 1', profile_pin: '1234', url: 'http://servidor.tv', activation_code: 'ABCD-1234', extra_notes: 'Instrucciones' })[f]).join(' | ') + '\n' + bulkFields.map(f => ({ email: 'cuenta2@correo.com', password: 'Clave456', profile_name: 'Perfil 2', profile_pin: '5678', url: 'http://servidor.tv', activation_code: 'EFGH-5678', extra_notes: 'Instrucciones' })[f]).join(' | ')}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
          />
          {bulkRows.length > 0 && (
            <div className="inset p-3 max-h-48 overflow-auto">
              <p className="eyebrow mb-2">Vista previa · {bulkRows.length}</p>
              <table className="!text-xs">
                <tbody>
                  {bulkRows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="!border-0">{bulkFields.map((f, fi) => <td key={f} className="!py-1 !px-2 font-mono truncate max-w-[160px]">{r[f] || (fi === 0 ? <span className="text-[var(--status-red)]">falta</span> : <span className="text-[var(--ink-faint)]">—</span>)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {bulkRows.length > 8 && <p className="text-[11px] text-[var(--ink-faint)] mt-1">…y {bulkRows.length - 8} más</p>}
            </div>
          )}
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
