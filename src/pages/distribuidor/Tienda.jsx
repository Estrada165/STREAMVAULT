import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { EmptyState, Spinner, Modal } from '@/components/ui'
import ProductCard from '@/components/shared/ProductCard'
import { IconSearch, IconShoppingCart, IconStore, IconDollar, IconCopy } from '@/assets/icons'
import { formatUSD } from '@/utils'

const PAYMENT_METHODS_META = {
  yape:    { label: 'Yape',    logo: '/logos/logoYAPE.png'    },
  plin:    { label: 'Plin',    logo: '/logos/logoPLIN.png'    },
  bim:     { label: 'Bim',     logo: '/logos/LOGOBIM.webp'    },
  binance: { label: 'Binance', logo: '/logos/logoBINANCE.webp' },
  lemon:   { label: 'Lemon',   logo: '/logos/logoLEMON.webp'  },
  agora:   { label: 'Agora',   logo: '/logos/LOGOAGORA.webp'  },
}

function MethodLogo({ logo, label, size = 24 }) {
  const [err, setErr] = useState(false)
  if (err) return (
    <div style={{ width: size, height: size, borderRadius: size/4, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 700, color: 'var(--ink-muted)' }}>
      {label[0]}
    </div>
  )
  return <img src={logo} alt={label} width={size} height={size} style={{ borderRadius: size/4, objectFit: 'contain' }} onError={() => setErr(true)} />
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <button onClick={copy} className="btn-ghost" style={{ padding: '5px 8px', color: copied ? 'var(--status-green)' : 'var(--ink-faint)' }}>
      {copied
        ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <IconCopy size={14} />
      }
    </button>
  )
}

function ProviderLogo({ logoUrl, name, size = 44 }) {
  const [err, setErr] = useState(false)
  if (!logoUrl || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: size / 4, background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: size * 0.45, color: 'var(--ink-muted)' }}>
        {(name || 'T')[0].toUpperCase()}
      </div>
    )
  }
  return (
    <img src={logoUrl} alt={name}
      style={{ width: size, height: size, borderRadius: size / 4, objectFit: 'contain', border: '1px solid var(--surface-border)', background: 'var(--surface-overlay)', padding: 4 }}
      onError={() => setErr(true)} />
  )
}

// ── Modal de recarga con flujo completo ──────────────────────────────────────
function RechargeModal({ method, provider, exchangeRate, onClose }) {
  const meta = PAYMENT_METHODS_META[method.method_key] || { label: method.method_key, logo: '' }
  const [step, setStep] = useState(1) // 1 = monto, 2 = datos pago
  const [usdAmount, setUsdAmount] = useState('')

  const penAmount = usdAmount && !isNaN(usdAmount)
    ? (parseFloat(usdAmount) * exchangeRate).toFixed(2)
    : ''

  function handleNext() {
    if (!usdAmount || isNaN(usdAmount) || parseFloat(usdAmount) <= 0) return
    setStep(2)
  }

  function sendWhatsApp() {
    const phone = (provider?.whatsapp_support || '').replace(/\D/g, '')
    if (!phone) { alert('El proveedor no tiene número de soporte configurado.'); return }
    const msg =
      `Hola! 👋 Soy distribuidor de *${provider?.display_name || 'tu tienda'}*.\n\n` +
      `He realizado una recarga por:\n` +
      `💵 *$${parseFloat(usdAmount).toFixed(2)} USD*\n` +
      `🪙 *S/ ${penAmount} PEN*\n\n` +
      `Método: *${meta.label}*\n` +
      `Titular: *${method.holder_name}*\n\n` +
      `Por favor me confirma cuando este listo. ¡Gracias! 🙏\n\n` +
      `_(Envio el comprobante de pago)_`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    onClose()
  }

  return (
    <Modal open={true} onClose={onClose} title={`Recargar con ${meta.label}`} maxWidth="max-w-sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Logo + nombre método */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-overlay)', borderRadius: 12 }}>
          <MethodLogo logo={meta.logo} label={meta.label} size={46} />
          <div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{meta.label}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              {step === 1 ? '¿Cuánto deseas recargar?' : 'Datos para transferir'}
            </p>
          </div>
        </div>

        {step === 1 && (
          <>
            {/* Monto en USD */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', display: 'block', marginBottom: 6 }}>
                Monto a recargar (USD)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink-faint)' }}>$</span>
                <input
                  type="number" min="0.01" step="0.01"
                  placeholder="0.00"
                  value={usdAmount}
                  onChange={e => setUsdAmount(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}
                  autoFocus
                />
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>USD</span>
              </div>
            </div>

            {/* Conversión automática */}
            {penAmount && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--status-green-bg)', border: '1px solid var(--status-green-border)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 13, color: 'var(--status-green)' }}>Equivale a transferir:</p>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--status-green)' }}>
                  S/ {penAmount}
                </p>
              </div>
            )}

            <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center' }}>
              TC: 1 USD = S/ {exchangeRate}
            </p>

            <button
              onClick={handleNext}
              disabled={!usdAmount || isNaN(usdAmount) || parseFloat(usdAmount) <= 0}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', opacity: (!usdAmount || parseFloat(usdAmount) <= 0) ? 0.5 : 1 }}
            >
              Siguiente →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            {/* Resumen del monto */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-overlay)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--surface-border)' }}>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Monto a transferir</p>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>S/ {penAmount}</p>
                <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>${parseFloat(usdAmount).toFixed(2)} USD</p>
              </div>
            </div>

            {/* Titular */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 6 }}>Titular</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>{method.holder_name}</span>
                <CopyBtn value={method.holder_name} />
              </div>
            </div>

            {/* Número / ID */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 6 }}>
                {method.method_key === 'binance' ? 'ID de Binance Pay' : 'Número'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--ink)', fontSize: 15, letterSpacing: '0.02em' }}>{method.account_number}</span>
                <CopyBtn value={method.account_number} />
              </div>
            </div>

            <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', lineHeight: 1.6 }}>
              Realiza la transferencia y luego notifica a tu proveedor adjuntando el comprobante.
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                ← Atrás
              </button>
              <button onClick={sendWhatsApp} className="btn-primary"
                style={{ flex: 2, justifyContent: 'center', background: '#25d366', borderColor: '#25d366' }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Notificar al proveedor
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Tienda() {
  const { provider, profile } = useAuth()
  const { addItem, count } = useCart()
  const { balance } = useBalance()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const exchangeRate = parseFloat(settings?.exchange_rate) || 3.5

  const [products, setProducts] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [stockCounts, setStockCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [added, setAdded] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedMethod, setSelectedMethod] = useState(null) // abre el modal de recarga

  useEffect(() => { if (provider) fetchProducts() }, [provider])

  useEffect(() => {
    const provId = provider?.id || profile?.provider_id
    if (provId) fetchPaymentMethods(provId)
  }, [provider?.id, profile?.provider_id])

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
    setPlatforms(Object.values(pMap))
    if (data?.length) {
      const ids = data.map(p => p.id)
      const { data: stock } = await supabase.from('stock_items').select('product_id').in('product_id', ids).eq('is_sold', false)
      const counts = {}
      stock?.forEach(s => { counts[s.product_id] = (counts[s.product_id] || 0) + 1 })
      setStockCounts(counts)
    }
    setLoading(false)
  }

  function handleBuy(product) {
    addItem(product)
    setAdded(product.id)
    setTimeout(() => setAdded(null), 2000)
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.platforms?.name || p.custom_platform_name || '').toLowerCase().includes(search.toLowerCase())
    const matchPlatform = filterPlatform === 'all' || p.platform_id === filterPlatform
    return matchSearch && matchPlatform
  })

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProviderLogo logoUrl={provider?.logo_url} name={provider?.display_name} size={44} />
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--ink)', lineHeight: 1.2 }}>
              {provider?.display_name || 'Tienda'}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Tu proveedor</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', padding: '8px 14px', borderRadius: 12 }}>
            <IconDollar size={14} style={{ color: 'var(--ink-faint)' }} />
            <div>
              <p style={{ fontSize: 10, color: 'var(--ink-faint)', lineHeight: 1 }}>Tu saldo</p>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{formatUSD(balance)}</p>
            </div>
          </div>
          <button onClick={() => navigate('/carrito')} className="btn-primary" style={{ position: 'relative' }}>
            <IconShoppingCart size={15} />Carrito
            {count > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--status-red)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
            )}
          </button>
        </div>
      </div>

      {/* MÉTODOS DE RECARGA — ahora abren el RechargeModal con flujo completo */}
      {paymentMethods.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', flexShrink: 0 }}>Recargar:</span>
          {paymentMethods.map(m => {
            const meta = PAYMENT_METHODS_META[m.method_key] || { label: m.method_key, logo: '' }
            return (
              <button key={m.id} onClick={() => setSelectedMethod(m)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, border: '1px solid var(--surface-border)', background: 'var(--surface-overlay)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--surface-border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-border)' }}
              >
                <MethodLogo logo={meta.logo} label={meta.label} size={18} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-muted)' }}>{meta.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* BUSCADOR */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {[{ id: 'all', name: 'Todas' }, ...platforms].map(p => (
          <button key={p.id} onClick={() => setFilterPlatform(p.id)}
            style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', border: '1px solid', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', background: filterPlatform === p.id ? 'var(--ink)' : 'transparent', color: filterPlatform === p.id ? 'var(--surface)' : 'var(--ink-muted)', borderColor: filterPlatform === p.id ? 'var(--ink)' : 'var(--surface-border)' }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* PRODUCTOS */}
      {loading ? <div className="flex justify-center py-20"><Spinner size={32} /></div> :
        filtered.length === 0 ? (
          <EmptyState icon={IconStore} title="Sin productos" description="Tu proveedor aún no ha publicado productos o no coincide con tu búsqueda." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
            {filtered.map(p => (
              <div key={p.id} className="relative">
                {added === p.id && (
                  <div className="absolute inset-0 z-10 rounded-[1.25rem] bg-[var(--status-green-bg)] border-2 border-[var(--status-green)] flex items-center justify-center animate-fade-in">
                    <div className="flex items-center gap-2 text-[var(--status-green)] font-semibold text-sm">
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Agregado
                    </div>
                  </div>
                )}
                <ProductCard product={p} exchangeRate={settings.exchange_rate} stockCount={stockCounts[p.id] || 0} onBuy={handleBuy} />
              </div>
            ))}
          </div>
        )
      }

      {/* MODAL DE RECARGA CON FLUJO COMPLETO */}
      {selectedMethod && (
        <RechargeModal
          method={selectedMethod}
          provider={provider}
          exchangeRate={exchangeRate}
          onClose={() => setSelectedMethod(null)}
        />
      )}
    </div>
  )
}