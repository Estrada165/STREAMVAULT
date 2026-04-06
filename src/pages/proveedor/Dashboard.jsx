import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, StatCard, Spinner } from '@/components/ui'
import { IconBox, IconUsers, IconDollar, IconHeadphones, IconTrendingUp, IconClock } from '@/assets/icons'
import { formatUSD, daysRemaining, getDaysColor } from '@/utils'

export default function ProveedorDashboard() {
  const { provider } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (provider) fetchStats() }, [provider])

  async function fetchStats() {
    // Get all product IDs for this provider
    const { data: products } = await supabase
      .from('products').select('id').eq('provider_id', provider.id)
    const pids = products?.map(p => p.id) || []

    if (!pids.length) {
      setStats({ products: 0, stockAvailable: 0, stockSold: 0, distributors: 0, revenue: 0, tickets: 0, activeOrders: 0 })
      setLoading(false)
      return
    }

    const [
      { count: stockAvailable },
      { count: stockSold },
      { count: distributors },
      { data: orders },
      { count: tickets },
    ] = await Promise.all([
      supabase.from('stock_items').select('*', { count: 'exact', head: true }).in('product_id', pids).eq('is_sold', false),
      supabase.from('stock_items').select('*', { count: 'exact', head: true }).in('product_id', pids).eq('is_sold', true),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('role', 'distribuidor').eq('is_active', true),
      supabase.from('orders').select('price_paid, status, created_at, order_code, client_name, products(name, platforms(name))').in('product_id', pids).order('created_at', { ascending: false }),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'abierto'),
    ])

    const revenue = (orders || []).filter(o => o.status !== 'cancelado').reduce((s, o) => s + parseFloat(o.price_paid), 0)
    const activeOrders = (orders || []).filter(o => o.status === 'activo').length

    setStats({
      products: pids.length,
      stockAvailable: stockAvailable || 0,
      stockSold: stockSold || 0,
      distributors: distributors || 0,
      revenue,
      tickets: tickets || 0,
      activeOrders,
    })
    setRecentOrders((orders || []).slice(0, 6))
    setLoading(false)
  }

  const days = provider?.expires_at ? daysRemaining(provider.expires_at) : null
  const dColor = days !== null ? getDaysColor(days) : null

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={provider?.display_name ? `Resumen de ${provider.display_name}` : 'Resumen de tu tienda'}
      />

      {/* Expiry warning */}
      {days !== null && days <= 7 && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500,
          background: dColor === 'red' ? 'var(--status-red-bg)' : 'var(--status-yellow-bg)',
          color: dColor === 'red' ? 'var(--status-red)' : 'var(--status-yellow)',
          border: `1px solid ${dColor === 'red' ? 'var(--status-red-border)' : 'var(--status-yellow-border)'}`,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: 'pulse 2s infinite', flexShrink: 0 }} />
          {days <= 0 ? 'Tu acceso ha vencido. Contacta al administrador.' : `Tu acceso vence en ${days} día${days !== 1 ? 's' : ''}. Renueva pronto.`}
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }} className="stagger">
        <StatCard label="Ingresos totales" value={formatUSD(stats.revenue)} icon={IconDollar} color="green" />
        <StatCard label="Pedidos activos" value={stats.activeOrders} icon={IconTrendingUp} color={stats.activeOrders > 0 ? 'green' : 'neutral'} />
        <StatCard label="Distribuidores" value={stats.distributors} icon={IconUsers} color="neutral" />
        <StatCard label="Stock disponible" value={stats.stockAvailable} icon={IconBox} color={stats.stockAvailable < 3 ? 'yellow' : 'neutral'} sub={`${stats.stockSold} vendidos`} />
        <StatCard label="Tickets abiertos" value={stats.tickets} icon={IconHeadphones} color={stats.tickets > 0 ? 'red' : 'neutral'} />
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 12 }}>
            Pedidos recientes
          </h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Producto</th>
                  <th>Cliente</th>
                  <th>Precio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.order_code}>
                    <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--ink-muted)' }}>#{o.order_code}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--ink)' }}>{o.products?.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{o.client_name || '—'}</td>
                    <td style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, color: 'var(--ink)' }}>{formatUSD(o.price_paid)}</td>
                    <td>
                      <span className={`badge ${o.status === 'activo' ? 'badge-green' : o.status === 'pendiente_credenciales' ? 'badge-yellow' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                        {o.status === 'activo' ? 'Activo' : o.status === 'pendiente_credenciales' ? 'Pendiente' : o.status === 'expirado' ? 'Expirado' : 'Cancelado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!stats.products && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-muted)' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>¡Bienvenido a tu panel!</p>
          <p style={{ fontSize: 13 }}>Comienza creando tus primeros productos en la sección <strong>Productos</strong>.</p>
        </div>
      )}
    </div>
  )
}