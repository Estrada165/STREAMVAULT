import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader, EmptyState, Spinner, Modal } from '@/components/ui'
import ProductCard from '@/components/shared/ProductCard'
import { IconSearch, IconShoppingCart, IconStore, IconDollar, IconCopy } from '@/assets/icons'
import { formatUSD } from '@/utils'

// ── Métodos de pago (mismas keys que en Configuracion) ──
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
    <div style={{
      width: size, height: size, borderRadius: size / 4,
      background: 'var(--surface-overlay)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700, color: 'var(--ink-muted)'
    }}>
      {label[0]}
    </div>
  )
  return (
    <img src={logo} alt={label} width={size} height={size}
      style={{ borderRadius: size / 4, objectFit: 'contain' }}
      onError={() => setErr(true)} />
  )
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy} className="btn-ghost"
      style={{ padding: '5px 8px', color: copied ? 'var(--status-green)' : 'var(--ink-faint)' }}>
      {copied
        ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <IconCopy size={14} />
      }
    </button>
  )
}

export default function Tienda() {
  const { provider, profile } = useAuth()
  const { addItem, count } = useCart()
  const { balance } = useBalance()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [stockCounts, setStockCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [added, setAdded] = useState(null)

  // ── Métodos de pago ──
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedMethod, setSelectedMethod] = useState(null)

  useEffect(() => { if (provider) fetchProducts() }, [provider])

  // ── Cargar métodos de pago usando provider_id del profile como respaldo ──
  useEffect(() => {
    const provId = provider?.id || profile?.provider_id
    if (provId) fetchPaymentMethods(provId)
  }, [provider?.id, profile?.provider_id])

  async function fetchPaymentMethods(provId) {
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('provider_id', provId)
      .eq('is_active', true)
    setPaymentMethods(data || [])
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*, platforms(*)')
      .eq('provider_id', provider.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setProducts(data || [])

    const pMap = {}
    data?.forEach(p => { if (p.platforms) pMap[p.platforms.id] = p.platforms })
    setPlatforms(Object.values(pMap))

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

  function handleBuy(product) {
    addItem(product)
    setAdded(product.id)
    setTimeout(() => setAdded(null), 2000)
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.platforms?.name.toLowerCase().includes(search.toLowerCase())
    const matchPlatform = filterPlatform === 'all' || p.platform_id === filterPlatform
    return matchSearch && matchPlatform
  })

  return (
    <div>
      {/* ── HEADER: Balance + carrito ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>Tienda</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{provider?.display_name || 'Tu proveedor'}</p>
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
            <IconShoppingCart size={15} />
            Carrito
            {count > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--status-red)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── BARRA DE MÉTODOS DE RECARGA ── */}
      {paymentMethods.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', flexShrink: 0 }}>
            Recargar:
          </span>
          {paymentMethods.map(m => {
            const meta = PAYMENT_METHODS_META[m.method_key] || { label: m.method_key, logo: '' }
            return (
              <button key={m.id} onClick={() => setSelectedMethod(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                  borderRadius: 99, border: '1px solid var(--surface-border)',
                  background: 'var(--surface-overlay)', cursor: 'pointer',
                  transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
                }}
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

      {/* ── BUSCADOR ── */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar producto..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── FILTROS DE PLATAFORMA ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {[{ id: 'all', name: 'Todas' }, ...platforms].map(p => (
          <button key={p.id} onClick={() => setFilterPlatform(p.id)}
            style={{
              padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
              fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
              background: filterPlatform === p.id ? 'var(--ink)' : 'transparent',
              color: filterPlatform === p.id ? 'var(--surface)' : 'var(--ink-muted)',
              borderColor: filterPlatform === p.id ? 'var(--ink)' : 'var(--surface-border)',
            }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* ── PRODUCTOS ── */}
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
                <ProductCard
                  product={p}
                  exchangeRate={settings.exchange_rate}
                  stockCount={stockCounts[p.id] || 0}
                  onBuy={handleBuy}
                />
              </div>
            ))}
          </div>
        )
      }

      {/* ── MODAL MÉTODO DE PAGO ── */}
      {selectedMethod && (() => {
        const meta = PAYMENT_METHODS_META[selectedMethod.method_key] || { label: selectedMethod.method_key, logo: '' }
        return (
          <Modal open={true} onClose={() => setSelectedMethod(null)}
            title={`Recargar con ${meta.label}`} maxWidth="max-w-sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Logo + nombre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-overlay)', borderRadius: 12 }}>
                <MethodLogo logo={meta.logo} label={meta.label} size={46} />
                <div>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{meta.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Datos para recargar</p>
                </div>
              </div>

              {/* Titular */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 6 }}>Titular</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 12px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>{selectedMethod.holder_name}</span>
                  <CopyBtn value={selectedMethod.holder_name} />
                </div>
              </div>

              {/* Número / ID */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 6 }}>
                  {selectedMethod.method_key === 'binance' ? 'ID de Binance Pay'
                    : selectedMethod.method_key === 'bcp' ? 'N° de cuenta / CCI'
                    : 'Número'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '10px 12px' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--ink)', fontSize: 15, letterSpacing: '0.02em' }}>
                    {selectedMethod.account_number}
                  </span>
                  <CopyBtn value={selectedMethod.account_number} />
                </div>
              </div>

              <p style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', lineHeight: 1.5 }}>
                Realiza la transferencia y notifica a tu proveedor para que recargue tu saldo.
              </p>

              <button onClick={() => setSelectedMethod(null)} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}>
                Entendido
              </button>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}