import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { Link } from 'react-router-dom'
import { PageHeader, EmptyState, PageLoader, Tabs, StatCard } from '@/components/ui'
import OrderCard from '@/components/shared/OrderCard'
import ExpiringSoon from '@/components/shared/ExpiringSoon'
import { IconBox, IconDollar, IconCheck, IconClock, IconSearch, IconStore, IconX } from '@/assets/icons'
import { formatUSD } from '@/utils'

export default function DistDashboard() {
  const { profile } = useAuth()
  const { balance } = useBalance()
  const { settings } = useSettings()
  const [orders, setOrders] = useState([])
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('activo')
  const [search, setSearch] = useState('')

  const exchangeRate = parseFloat(settings?.exchange_rate) || 3.5

  useEffect(() => {
    if (profile) { fetchOrders(); fetchTemplate() }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    const channel = supabase.channel(`orders-rt-${profile.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_items' }, fetchOrders)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `distributor_id=eq.${profile.id}` }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  async function fetchOrders() {
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('id, order_code, status, price_paid, expires_at, created_at, client_name, client_whatsapp, product_id, stock_item_id, distributor_id')
      .eq('distributor_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) { console.error('Orders error:', error); setLoading(false); return }
    if (!ordersData?.length) { setOrders([]); setLoading(false); return }

    const productIds = [...new Set(ordersData.map(o => o.product_id).filter(Boolean))]
    const stockIds = [...new Set(ordersData.map(o => o.stock_item_id).filter(Boolean))]

    // En lotes de 100: con cientos de IDs la URL supera el límite y Supabase responde 400
    const fetchStocks = async () => {
      let all = []
      for (let i = 0; i < stockIds.length; i += 100) {
        const { data } = await supabase.from('stock_items')
          .select('id, email, password, url, profile_name, profile_pin, activation_code, extra_notes')
          .in('id', stockIds.slice(i, i + 100))
        if (data) all = all.concat(data)
      }
      return { data: all }
    }

    const [{ data: products }, { data: stocks }] = await Promise.all([
      supabase.from('products').select('id, name, duration_days, delivery_type, provider_id, image_url, renewal_price_usd, platforms(name, logo_filename), providers:provider_id(whatsapp_support)').in('id', productIds),
      fetchStocks(),
    ])

    const productsMap = {}
    products?.forEach(p => { productsMap[p.id] = p })
    const stockMap = {}
    stocks?.forEach(s => { stockMap[s.id] = s })

    setOrders(ordersData.map(o => ({
      ...o,
      products: productsMap[o.product_id] || null,
      stock_items: stockMap[o.stock_item_id] || null,
    })))
    setLoading(false)
  }

  async function fetchTemplate() {
    const { data } = await supabase.from('whatsapp_templates').select('template_text').eq('distributor_id', profile.id).maybeSingle()
    setTemplate(data?.template_text || null)
  }

  const stats = {
    active: orders.filter(o => o.status === 'activo').length,
    pending: orders.filter(o => o.status === 'pendiente_credenciales').length,
    expired: orders.filter(o => o.status === 'expirado').length,
  }

  const byTab = tab === 'all' ? orders : orders.filter(o => o.status === tab)

  const filtered = search.trim()
    ? byTab.filter(o => {
        const q = search.toLowerCase()
        return (
          (o.client_name || '').toLowerCase().includes(q) ||
          (o.client_whatsapp || '').includes(q) ||
          (o.order_code || '').toLowerCase().includes(q) ||
          (o.products?.name || '').toLowerCase().includes(q) ||
          (o.products?.platforms?.name || '').toLowerCase().includes(q) ||
          (o.stock_items?.email || '').toLowerCase().includes(q)
        )
      })
    : byTab

  if (loading) return <PageLoader />

  const soon = orders.filter(o => o.status === 'activo' && o.expires_at && (new Date(o.expires_at) - new Date()) / 86400000 <= 3).length

  return (
    <div>
      <PageHeader
        title="Mis"
        accent="pedidos"
        subtitle="Credenciales, vencimientos y avisos a tus clientes"
        action={<Link to="/tienda" className="btn-primary"><IconStore size={16} />Ir a la tienda</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger">
        <StatCard label="Activos" value={stats.active} icon={IconCheck} color="green" />
        <StatCard label="Por vencer" value={soon} icon={IconClock} color={soon > 0 ? 'yellow' : 'neutral'} highlight={soon > 0} sub={soon > 0 ? 'Avisa a tus clientes hoy' : 'Todo al día'} />
        <StatCard label="Pendientes" value={stats.pending} icon={IconBox} color={stats.pending > 0 ? 'violet' : 'neutral'} />
        <StatCard label="Expirados" value={stats.expired} icon={IconX} color="neutral" sub="renuévalos para no perder al cliente" />
      </div>

      <ExpiringSoon orders={orders} exchangeRate={exchangeRate} />

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <Tabs
          tabs={[
            { label: 'Activos', value: 'activo', count: stats.active },
            { label: 'Pendientes', value: 'pendiente_credenciales', count: stats.pending },
            { label: 'Expirados', value: 'expirado', count: stats.expired },
            { label: 'Todos', value: 'all', count: orders.length },
          ]}
          active={tab} onChange={v => { setTab(v); setSearch('') }}
        />
        <label className="relative flex-1">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
          <input className="input input-icon" placeholder="Buscar cliente, plataforma, correo o código" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar pedidos" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1.5" aria-label="Limpiar búsqueda"><IconX size={14} /></button>}
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={IconBox}
            title={search ? 'Sin resultados' : tab === 'activo' ? 'Aún no tienes pedidos activos' : 'Nada por aquí'}
            description={search ? `No hay pedidos que coincidan con "${search}".` : tab === 'activo' ? 'Cuando compres en la tienda, tus credenciales aparecerán aquí.' : 'No hay pedidos en esta categoría.'}
            action={!search && tab === 'activo' ? <Link to="/tienda" className="btn-primary">Ir a la tienda</Link> : null}
          />
        </div>
      ) : (
        <>
          {search && <p className="text-xs text-[var(--ink-faint)] mb-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{search}"</p>}
          <div className="flex flex-col gap-3 stagger">
            {filtered.map(order => (
              <OrderCard key={order.id} order={order} template={template} exchangeRate={exchangeRate} onCredentialsUpdated={fetchOrders} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
