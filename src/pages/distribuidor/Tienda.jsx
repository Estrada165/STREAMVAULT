import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader, EmptyState, Spinner } from '@/components/ui'
import ProductCard from '@/components/shared/ProductCard'
import { IconSearch, IconShoppingCart, IconStore, IconDollar } from '@/assets/icons'
import { formatUSD } from '@/utils'

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

  useEffect(() => { if (provider) fetchProducts() }, [provider])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*, platforms(*)')
      .eq('provider_id', provider.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setProducts(data || [])

    // Unique platforms
    const pMap = {}
    data?.forEach(p => { if (p.platforms) pMap[p.platforms.id] = p.platforms })
    setPlatforms(Object.values(pMap))

    // Stock counts
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
      {/* Balance + cart header */}
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

      {/* Search bar - full width */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Platform filters - full width, wraps naturally */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {[{ id: 'all', name: 'Todas' }, ...platforms].map(p => (
          <button
            key={p.id}
            onClick={() => setFilterPlatform(p.id)}
            style={{
              padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
              fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
              background: filterPlatform === p.id ? 'var(--ink)' : 'transparent',
              color: filterPlatform === p.id ? 'var(--surface)' : 'var(--ink-muted)',
              borderColor: filterPlatform === p.id ? 'var(--ink)' : 'var(--surface-border)',
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

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
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
    </div>
  )
}