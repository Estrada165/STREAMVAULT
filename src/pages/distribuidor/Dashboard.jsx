import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { PageHeader, EmptyState, Spinner, Tabs, StatCard } from '@/components/ui'
import OrderCard from '@/components/shared/OrderCard'
import { IconBox, IconDollar, IconCheck, IconClock } from '@/assets/icons'
import { formatUSD } from '@/utils'

export default function DistDashboard() {
  const { profile } = useAuth()
  const { balance } = useBalance()
  const [orders, setOrders] = useState([])
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('activo')

  useEffect(() => {
    if (profile) { fetchOrders(); fetchTemplate() }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    const channel = supabase.channel('orders-rt-' + profile.id)
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

    const [{ data: products }, { data: stocks }] = await Promise.all([
      // ← image_url añadido aquí para que OrderCard pueda mostrarlo
      supabase.from('products').select('id, name, duration_days, delivery_type, provider_id, image_url, platforms(name, logo_filename), providers:provider_id(whatsapp_support)').in('id', productIds),
      stockIds.length ? supabase.from('stock_items').select('id, email, password, url, profile_name, profile_pin, activation_code, extra_notes').in('id', stockIds) : { data: [] }
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

  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab)
  const stats = {
    active: orders.filter(o => o.status === 'activo').length,
    pending: orders.filter(o => o.status === 'pendiente_credenciales').length,
    expired: orders.filter(o => o.status === 'expirado').length,
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader title="Mis pedidos" subtitle="Gestiona tus suscripciones y credenciales" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }} className="stagger">
        <StatCard label="Saldo" value={formatUSD(balance)} icon={IconDollar} color="green" />
        <StatCard label="Activos" value={stats.active} icon={IconCheck} color={stats.active > 0 ? 'green' : 'neutral'} />
        <StatCard label="Pendientes" value={stats.pending} icon={IconClock} color={stats.pending > 0 ? 'yellow' : 'neutral'} />
        <StatCard label="Expirados" value={stats.expired} icon={IconBox} color="neutral" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          tabs={[
            { label: 'Activos', value: 'activo', count: stats.active },
            { label: 'Pendientes', value: 'pendiente_credenciales', count: stats.pending },
            { label: 'Expirados', value: 'expirado' },
            { label: 'Todos', value: 'all' },
          ]}
          active={tab} onChange={setTab}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={IconBox} title="Sin pedidos"
          description={tab === 'activo' ? 'No tienes suscripciones activas. Ve a la tienda para comprar.' : 'No hay pedidos en esta categoría.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger">
          {filtered.map(order => (
            <OrderCard key={order.id} order={order} template={template} onCredentialsUpdated={fetchOrders} />
          ))}
        </div>
      )}
    </div>
  )
}