import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { EmptyState, Modal, SkeletonGrid, useToast } from '@/components/ui'
import ProductCard from '@/components/shared/ProductCard'
import { getMethodMeta, MethodLogo } from '@/lib/paymentMethods'
import { PlatformLogo } from '@/utils/platform'
import { IconSearch, IconShoppingCart, IconStore, IconCopy, IconCheck, IconX, IconChevronRight, IconDownload } from '@/assets/icons'
import { formatUSD } from '@/utils'
import { waLink } from '@/lib/whatsapp'
import { saveImage } from '@/lib/download'
import { AnnouncementsButton } from '@/components/shared/Announcements'

const WA_ICON = <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>

function CopyRow({ label, value, mono }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }
  return (
    <div>
      <p className="label">{label}</p>
      <div className="inset flex items-center justify-between gap-2 pl-3.5 pr-1.5 py-1.5">
        <span className={`text-[var(--ink)] truncate ${mono ? 'font-mono text-[15px] tracking-wide' : 'font-semibold text-sm'}`}>{value}</span>
        <button onClick={copy} className={`btn-secondary btn-sm btn-icon ${copied ? '!text-[var(--a)] !border-[var(--a-line)]' : ''}`} aria-label={`Copiar ${label}`}>
          {copied ? <IconCheck size={14} className="animate-pop" /> : <IconCopy size={14} />}
        </button>
      </div>
    </div>
  )
}

// ── Recarga: elegir método → monto → datos y aviso por WhatsApp ─────────────
function RechargeModal({ methods, initial, provider, profile, exchangeRate, onClose }) {
  const toast = useToast()
  const [method, setMethod] = useState(initial || (methods.length === 1 ? methods[0] : null))
  const [step, setStep] = useState(initial || methods.length === 1 ? 1 : 0)
  const [usdAmount, setUsdAmount] = useState('')
  const meta = method ? getMethodMeta(method.method_key) : null

  const valid = usdAmount && !isNaN(usdAmount) && parseFloat(usdAmount) > 0
  const penAmount = valid ? (parseFloat(usdAmount) * exchangeRate).toFixed(2) : ''
  const distributorName = profile?.full_name || profile?.email?.split('@')[0] || 'Distribuidor'

  function sendWhatsApp() {
    const phone = (provider?.whatsapp_support || '').replace(/\D/g, '')
    if (!phone) { toast.error('Tu proveedor aún no configuró su número de WhatsApp.'); return }
    const msg =
      `Hola! 👋 Soy *${distributorName}*, distribuidor de *${provider?.display_name || 'tu tienda'}*.\n\n` +
      `He realizado una recarga por:\n` +
      `💵 *$${parseFloat(usdAmount).toFixed(2)} USD*\n` +
      `🪙 *S/ ${penAmount} PEN*\n\n` +
      `Método: *${meta.label}*\n` +
      `Titular: *${method.holder_name}*\n\n` +
      `Por favor me confirma cuando esté listo. ¡Gracias! 🙏\n\n` +
      `_(Envío el comprobante de pago)_`
    window.open(waLink(phone, msg), '_blank')
    onClose()
  }

  const steps = ['Método', 'Monto', 'Pagar']

  return (
    <Modal open onClose={onClose} title="Recargar saldo" subtitle={`1 USD = S/ ${exchangeRate}`} maxWidth="max-w-md">
      <div className="flex items-center gap-2 mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-[var(--a)]' : 'bg-[var(--surface-border)]'}`} />
            <p className={`text-[11px] mt-1.5 font-semibold ${i === step ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}>{s}</p>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid grid-cols-2 gap-2.5 stagger">
          {methods.map(m => {
            const mm = getMethodMeta(m.method_key)
            return (
              <button key={m.id} onClick={() => { setMethod(m); setStep(1) }} className="btn-secondary !justify-start !h-auto !py-3 !px-3.5">
                <MethodLogo logo={mm.logo} label={mm.label} size={32} />
                <span className="text-left">
                  <span className="block text-sm">{mm.label}</span>
                  <span className="block text-[11px] font-medium text-[var(--ink-faint)] truncate max-w-[110px]">{m.holder_name}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {step === 1 && meta && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <MethodLogo logo={meta.logo} label={meta.label} size={40} />
            <div className="min-w-0">
              <p className="font-semibold text-[var(--ink)]">{meta.label}</p>
              <p className="text-xs text-[var(--ink-muted)]">¿Cuánto deseas recargar?</p>
            </div>
            {methods.length > 1 && <button className="btn-ghost text-xs ml-auto" onClick={() => setStep(0)}>Cambiar</button>}
          </div>
          <label className="inset flex items-center gap-2 px-4 py-3 focus-within:border-[var(--a)]">
            <span className="font-mono text-xl text-[var(--ink-faint)]">$</span>
            <input
              type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" autoFocus
              value={usdAmount} onChange={e => setUsdAmount(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none font-mono text-2xl text-[var(--ink)]"
              aria-label="Monto en dólares"
            />
            <span className="text-xs font-semibold text-[var(--ink-faint)]">USD</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 50].map(v => (
              <button key={v} className={`btn-secondary btn-sm ${parseFloat(usdAmount) === v ? 'is-down' : ''}`} onClick={() => setUsdAmount(String(v))}>${v}</button>
            ))}
          </div>
          {valid && (
            <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-[var(--a-soft)] border border-[var(--a-line)] animate-fade-in">
              <span className="text-[13px] text-[var(--ink-muted)]">Transfieres</span>
              <span className="font-mono text-lg text-[var(--a)]">S/ {penAmount}</span>
            </div>
          )}
          <button onClick={() => valid && setStep(2)} disabled={!valid} className="btn-primary w-full">
            Siguiente <IconChevronRight size={15} />
          </button>
        </div>
      )}

      {step === 2 && meta && (
        <div className="space-y-4 animate-fade-in">
          <div className="card card-sig p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MethodLogo logo={meta.logo} label={meta.label} size={36} />
              <span className="text-sm text-[var(--ink-muted)]">Transfiere por {meta.label}</span>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl grad leading-none">S/ {penAmount}</p>
              <p className="text-[11px] text-[var(--ink-faint)] mt-1">${parseFloat(usdAmount).toFixed(2)} USD</p>
            </div>
          </div>
          {method.qr_url && (
            <div className="flex flex-col items-center gap-2.5">
              <img src={method.qr_url} alt={`QR de ${meta.label}`} className="w-48 h-48 object-contain rounded-2xl bg-white p-2 border border-[var(--surface-border)] shadow-[0_6px_18px_var(--shadow-soft)]" onError={e => { e.currentTarget.style.display = 'none' }} />
              <button onClick={async () => { const r = await saveImage(method.qr_url, `QR-${meta.label}`); if (r === 'downloaded') toast.success('QR descargado'); if (r === 'opened') toast('Mantén presionada la imagen para guardarla') }} className="btn-secondary btn-sm"><IconDownload size={14} />Guardar QR</button>
              <p className="text-[11px] text-[var(--ink-faint)] text-center">Guárdalo y ábrelo desde tu app de pagos para escanearlo.</p>
            </div>
          )}
          <CopyRow label="Titular" value={method.holder_name} />
          <CopyRow label={method.method_key === 'binance' ? 'ID de Binance Pay' : 'Número'} value={method.account_number} mono />
          <p className="text-xs text-[var(--ink-muted)] text-center leading-relaxed">
            Haz la transferencia y avisa a tu proveedor con el comprobante. Tu saldo se carga cuando lo confirme.
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">Atrás</button>
            <button onClick={sendWhatsApp} className="btn-primary flex-[2]">{WA_ICON}Avisar al proveedor</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function Tienda() {
  const { provider, profile } = useAuth()
  const { addItem, count, total } = useCart()
  const { balance } = useBalance()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const exchangeRate = parseFloat(settings?.exchange_rate) || 3.5

  const [products, setProducts] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [stockCounts, setStockCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [recharge, setRecharge] = useState(null) // null | { method }

  useEffect(() => { if (provider) fetchProducts() }, [provider])

  useEffect(() => {
    const provId = provider?.id || profile?.provider_id
    if (provId) fetchPaymentMethods(provId)
  }, [provider?.id, profile?.provider_id])

  // Abrir recarga desde el menú lateral (/tienda?recargar=1)
  useEffect(() => {
    if (params.get('recargar') && paymentMethods.length) {
      setRecharge({ method: null })
      params.delete('recargar'); setParams(params, { replace: true })
    }
  }, [params, paymentMethods.length])

  async function fetchPaymentMethods(provId) {
    const { data } = await supabase.from('payment_methods').select('*').eq('provider_id', provId).eq('is_active', true)
    setPaymentMethods(data || [])
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products').select('*, platforms(*)')
      .eq('provider_id', provider.id).eq('is_active', true)
      .order('created_at', { ascending: false })
    setProducts(data || [])
    const pMap = {}
    data?.forEach(p => { if (p.platforms) pMap[p.platforms.id] = p.platforms })
    setPlatforms(Object.values(pMap).sort((a, b) => a.name.localeCompare(b.name)))
    if (data?.length) {
      const ids = data.map(p => p.id)
      // Solo cantidades: el stock sin vender no es legible desde el navegador
      const { data: stock } = await supabase.rpc('get_stock_counts', { p_product_ids: ids })
      const counts = {}
      stock?.forEach(s => { counts[s.product_id] = Number(s.available) || 0 })
      setStockCounts(counts)
    }
    setLoading(false)
  }

  function handleBuy(product) {
    addItem(product)
    toast.success(`${product.name} agregado al carrito`)
  }

  const isAvailable = p => p.delivery_mode === 'stock' ? (stockCounts[p.id] || 0) > 0 : p.stock_qty !== 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter(p => {
        const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.platforms?.name || p.custom_platform_name || '').toLowerCase().includes(q)
        const matchPlatform = filterPlatform === 'all' || p.platform_id === filterPlatform
        return matchSearch && matchPlatform && (!onlyAvailable || isAvailable(p))
      })
      // Disponibles primero
      .sort((a, b) => Number(isAvailable(b)) - Number(isAvailable(a)))
  }, [products, search, filterPlatform, onlyAvailable, stockCounts])

  const firstName = (profile?.full_name || profile?.email || '').split(/[ @]/)[0]

  return (
    <div className="pb-24 lg:pb-0">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6 animate-slide-up">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Tienda de {provider?.display_name || 'tu proveedor'}</p>
          <h1 className="font-display text-[1.9rem] md:text-[2.4rem] leading-[1.02] text-[var(--ink)]">
            Hola, <span className="ser grad">{firstName || 'bienvenido'}</span>
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1.5">{products.length ? `${products.length} productos disponibles para vender hoy` : 'Elige lo que quieres vender hoy'}</p>
        </div>
        {/* En escritorio el saldo ya está en el menú lateral; aquí solo se muestra en móvil */}
        <div className="lg:hidden w-full sm:w-auto flex items-center gap-3 rounded-2xl pl-4 pr-2 py-2 bg-[var(--a-soft)] border border-[var(--a-line)]">
          <div className="flex-1 min-w-0 flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--ink-muted)]">Saldo</span>
            <span className="font-mono text-lg text-[var(--ink)] truncate">{formatUSD(balance)}</span>
          </div>
          {paymentMethods.length > 0 && (
            <button onClick={() => setRecharge({ method: null })} className="btn-primary btn-sm !px-3.5">Recargar</button>
          )}
        </div>
      </div>

      {/* Métodos de recarga */}
      {paymentMethods.length > 0 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 animate-slide-up" style={{ animationDelay: '.05s' }}>
          <span className="eyebrow flex-shrink-0 mr-1">Recarga con</span>
          {paymentMethods.map(m => {
            const meta = getMethodMeta(m.method_key)
            return (
              <button key={m.id} onClick={() => setRecharge({ method: m })} className="btn-secondary btn-sm flex-shrink-0 !pl-1.5">
                <MethodLogo logo={meta.logo} label={meta.label} size={22} />{meta.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Buscador y filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-3 animate-slide-up" style={{ animationDelay: '.08s' }}>
        <label className="relative flex-1">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
          <input className="input input-icon" placeholder="Buscar Netflix, Disney, perfil..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar producto" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1.5" aria-label="Limpiar"><IconX size={14} /></button>}
        </label>
        <div className="flex gap-2.5">
          <button onClick={() => setOnlyAvailable(v => !v)} className={`btn-secondary flex-1 sm:flex-none ${onlyAvailable ? 'is-down !text-[var(--a)]' : ''}`} aria-pressed={onlyAvailable}>
            <span className="dot" style={{ color: onlyAvailable ? 'var(--a)' : 'var(--ink-faint)' }} />Solo disponibles
          </button>
          <AnnouncementsButton className="flex-1 sm:flex-none" />
        </div>
      </div>

      {platforms.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button onClick={() => setFilterPlatform('all')} className={`btn-secondary btn-sm flex-shrink-0 ${filterPlatform === 'all' ? 'is-down' : ''}`}>Todas</button>
          {platforms.map(p => (
            <button key={p.id} onClick={() => setFilterPlatform(f => f === p.id ? 'all' : p.id)} className={`btn-secondary btn-sm flex-shrink-0 !pl-1.5 ${filterPlatform === p.id ? 'is-down' : ''}`}>
              <PlatformLogo name={p.name} filename={p.logo_filename} size={22} radius={6} />{p.name}
            </button>
          ))}
        </div>
      )}

      {/* Productos */}
      {loading ? <SkeletonGrid /> :
        filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={IconStore}
              title={products.length ? 'No encontramos ese producto' : 'Aún no hay productos'}
              description={products.length ? 'Prueba con otro nombre o quita los filtros.' : 'Tu proveedor todavía no publicó productos. Vuelve pronto.'}
              action={products.length ? <button className="btn-secondary" onClick={() => { setSearch(''); setFilterPlatform('all'); setOnlyAvailable(false) }}>Quitar filtros</button> : null}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 stagger">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} exchangeRate={exchangeRate} stockCount={stockCounts[p.id] || 0} onBuy={handleBuy} />
            ))}
          </div>
        )
      }

      {/* Barra del carrito (móvil) */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 lg:hidden animate-slide-up" style={{ paddingBottom: 'calc(.75rem + env(safe-area-inset-bottom))' }}>
          <Link to="/carrito" className="btn-primary w-full !h-14 !justify-between !px-5 !rounded-2xl">
            <span className="inline-flex items-center gap-2"><IconShoppingCart size={18} />{count} en el carrito</span>
            <span className="font-mono">{formatUSD(total)} →</span>
          </Link>
        </div>
      )}
      {count > 0 && (
        <button onClick={() => navigate('/carrito')} className="hidden lg:inline-flex btn-primary fixed bottom-6 right-6 z-30 !rounded-2xl !h-14 !px-5 animate-slide-up">
          <IconShoppingCart size={18} />Ver carrito · {count}<span className="font-mono opacity-80 ml-1">{formatUSD(total)}</span>
        </button>
      )}

      {recharge && (
        <RechargeModal
          methods={paymentMethods}
          initial={recharge.method}
          provider={provider}
          profile={profile}
          exchangeRate={exchangeRate}
          onClose={() => setRecharge(null)}
        />
      )}
    </div>
  )
}
