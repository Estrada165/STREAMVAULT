import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, StatCard, PageLoader, Badge, EmptyState, CopyField } from '@/components/ui'
import { PlatformLogo } from '@/utils/platform'
import WeeklyReport from '@/components/shared/WeeklyReport'
import { IconBox, IconUsers, IconDollar, IconHeadphones, IconTrendingUp, IconPlus, IconDatabase, IconAlertCircle } from '@/assets/icons'
import { formatUSD, daysRemaining, getDaysColor, timeAgo, getStatusLabel } from '@/utils'

const STATUS_BADGE = { activo: 'green', pendiente_credenciales: 'violet', expirado: 'neutral', cancelado: 'red' }

export default function ProveedorDashboard() {
  const { provider, profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [orders, setOrders] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(false)

  useEffect(() => { if (provider) fetchStats() }, [provider])

  async function fetchStats() {
    const { data: products } = await supabase
      .from('products').select('id, name, delivery_mode, is_active, platforms(name, logo_filename)').eq('provider_id', provider.id)
    const pids = products?.map(p => p.id) || []

    if (!pids.length) {
      setStats({ products: 0, stockAvailable: 0, stockSold: 0, distributors: 0, revenue: 0, tickets: 0, activeOrders: 0 })
      setLoading(false)
      return
    }

    const [
      { data: counts },
      { count: stockSold },
      { count: distributors },
      { data: ordersData },
      { count: tickets },
    ] = await Promise.all([
      supabase.rpc('get_stock_counts', { p_product_ids: pids }),
      supabase.from('stock_items').select('*', { count: 'exact', head: true }).in('product_id', pids).eq('is_sold', true),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('role', 'distribuidor').eq('is_active', true),
      supabase.from('orders').select('price_paid, status, created_at, order_code, client_name, product_id, products(name, platforms(name, logo_filename))').in('product_id', pids).order('created_at', { ascending: false }),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('status', 'abierto'),
    ])

    const countMap = {}
    ;(counts || []).forEach(c => { countMap[c.product_id] = Number(c.available) || 0 })
    const stockAvailable = Object.values(countMap).reduce((a, b) => a + b, 0)
    setLowStock((products || [])
      .filter(p => p.is_active && p.delivery_mode === 'stock' && (countMap[p.id] || 0) < 3)
      .map(p => ({ ...p, available: countMap[p.id] || 0 }))
      .sort((a, b) => a.available - b.available)
      .slice(0, 5))

    const list = ordersData || []
    setStats({
      products: pids.length,
      stockAvailable,
      stockSold: stockSold || 0,
      distributors: distributors || 0,
      revenue: list.filter(o => o.status !== 'cancelado').reduce((s, o) => s + parseFloat(o.price_paid), 0),
      tickets: tickets || 0,
      activeOrders: list.filter(o => o.status === 'activo').length,
    })
    setOrders(list)
    setLoading(false)
  }

  // Ventas de los últimos 14 días
  const chart = useMemo(() => {
    const days = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      days.push({ date: d, total: 0, count: 0 })
    }
    orders.forEach(o => {
      if (o.status === 'cancelado') return
      const d = new Date(o.created_at); d.setHours(0, 0, 0, 0)
      const idx = Math.round((d - days[0].date) / 864e5)
      if (idx >= 0 && idx < 14) { days[idx].total += parseFloat(o.price_paid); days[idx].count++ }
    })
    const max = Math.max(1, ...days.map(d => d.total))
    const week = days.slice(7).reduce((s, d) => s + d.total, 0)
    const weekCount = days.slice(7).reduce((s, d) => s + d.count, 0)
    const prevWeek = days.slice(0, 7).reduce((s, d) => s + d.total, 0)
    return {
      days, max, week, weekCount,
      today: days[13],
      avg: weekCount ? week / weekCount : 0,
      delta: prevWeek ? ((week - prevWeek) / prevWeek) * 100 : null,
    }
  }, [orders])

  const topProducts = useMemo(() => {
    const m = {}
    orders.forEach(o => {
      if (o.status === 'cancelado') return
      const k = o.product_id
      m[k] = m[k] || { name: o.products?.name, platform: o.products?.platforms, count: 0, total: 0 }
      m[k].count++; m[k].total += parseFloat(o.price_paid)
    })
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [orders])

  const days = provider?.expires_at ? daysRemaining(provider.expires_at) : null
  const dColor = days !== null ? getDaysColor(days) : null

  if (loading) return <PageLoader />

  const firstName = provider?.display_name || (profile?.full_name || '').split(' ')[0]

  return (
    <div>
      <PageHeader
        eyebrow="Panel del proveedor"
        title="Hola,"
        accent={firstName || 'bienvenido'}
        subtitle="Así va tu tienda hoy"
        action={<>
          <button onClick={() => setReport(true)} className="btn-secondary"><IconTrendingUp size={16} />Reporte semanal</button>
          <Link to="/proveedor/stock" className="btn-secondary"><IconDatabase size={16} />Subir stock</Link>
          <Link to="/proveedor/productos" className="btn-primary"><IconPlus size={16} />Nuevo producto</Link>
        </>}
      />

      {days !== null && days <= 7 && (
        <div className={`mb-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium border animate-slide-up ${dColor === 'red' ? 'bg-[var(--status-red-bg)] text-[var(--status-red)] border-[var(--status-red-border)]' : 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)] border-[var(--status-yellow-border)]'}`}>
          <span className="dot dot-glow animate-pulse-soft" />
          {days <= 0 ? 'Tu acceso venció. Contacta al administrador para renovarlo.' : `Tu acceso vence en ${days} día${days !== 1 ? 's' : ''}. Renueva pronto para que tus distribuidores no se queden sin tienda.`}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger">
        <StatCard label="Ingresos" value={formatUSD(stats.revenue)} icon={IconDollar} color="green" highlight sub={`${orders.length} pedidos en total`} />
        <StatCard label="Pedidos activos" value={stats.activeOrders} icon={IconTrendingUp} color="green" />
        <StatCard label="Distribuidores" value={stats.distributors} icon={IconUsers} color="violet" sub="activos" />
        <StatCard label="Stock disponible" value={stats.stockAvailable} icon={IconBox} color={stats.stockAvailable < 3 ? 'yellow' : 'neutral'} sub={`${stats.stockSold} vendidos`} />
      </div>

      {!stats.products ? (
        <div className="card">
          <EmptyState
            icon={IconBox}
            title="Crea tu primer producto"
            description="Publica un producto, sube su stock y tus distribuidores podrán comprarlo al instante."
            action={<Link to="/proveedor/productos" className="btn-primary"><IconPlus size={16} />Crear producto</Link>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Gráfico de ventas */}
          <section className="card p-5 sm:p-6 xl:col-span-2 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <p className="eyebrow">Ventas · últimos 7 días</p>
                <p className="font-mono text-3xl text-[var(--ink)] mt-2 leading-none">{formatUSD(chart.week)}</p>
              </div>
              {chart.delta !== null && (
                <Badge color={chart.delta >= 0 ? 'green' : 'red'}>{chart.delta >= 0 ? '▲' : '▼'} {Math.abs(chart.delta).toFixed(0)}% vs semana anterior</Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                ['Hoy', formatUSD(chart.today.total), `${chart.today.count} pedido${chart.today.count !== 1 ? 's' : ''}`],
                ['Pedidos', chart.weekCount, 'esta semana'],
                ['Ticket promedio', formatUSD(chart.avg), 'por pedido'],
              ].map(([k, v, sub]) => (
                <div key={k} className="inset px-3 py-2.5 min-w-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-[var(--ink-faint)] truncate">{k}</p>
                  <p className="font-mono text-[15px] sm:text-base text-[var(--ink)] mt-1 truncate">{v}</p>
                  <p className="text-[10.5px] text-[var(--ink-faint)] truncate">{sub}</p>
                </div>
              ))}
            </div>
            <div className="relative">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3].map(i => <div key={i} className="border-t border-dashed border-[var(--surface-border)]" />)}
            </div>
            <div className="relative flex items-end gap-1.5 sm:gap-2.5 h-44" role="img" aria-label="Ventas por día de los últimos 14 días">
              {chart.days.map((d, i) => {
                const h = Math.max(4, (d.total / chart.max) * 100)
                const isToday = i === 13
                return (
                  <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group relative">
                    <span className="absolute -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-mono px-2 py-1 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] whitespace-nowrap pointer-events-none z-10">
                      {formatUSD(d.total)} · {d.count}
                    </span>
                    <div
                      className="w-full rounded-t-[10px] rounded-b-[3px] transition-all duration-700"
                      style={{
                        height: `${h}%`,
                        background: i >= 7 ? `linear-gradient(180deg, var(--a), color-mix(in srgb, var(--a) 55%, var(--b)))` : 'var(--surface-border)',
                        boxShadow: isToday ? '0 0 18px var(--a-glow)' : 'none',
                        opacity: d.total ? 1 : 0.5,
                      }}
                    />
                    <span className={`text-[10px] font-mono ${isToday ? 'text-[var(--ink)] font-semibold' : 'text-[var(--ink-faint)]'}`}>{d.date.getDate()}</span>
                  </div>
                )
              })}
            </div>
            </div>
          </section>

          {/* Lo más vendido */}
          <section className="card p-5 sm:p-6 animate-slide-up" style={{ animationDelay: '.06s' }}>
            <p className="eyebrow mb-4">Lo más vendido</p>
            {topProducts.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">Aún no hay ventas.</p> : (
              <ul className="space-y-3.5">
                {topProducts.map((p, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <PlatformLogo name={p.platform?.name} filename={p.platform?.logo_filename} size={34} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)] truncate">{p.name}</p>
                      <div className="h-1.5 rounded-full bg-[var(--surface-overlay)] mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--a)]" style={{ width: `${(p.count / topProducts[0].count) * 100}%` }} />
                      </div>
                    </div>
                    <span className="font-mono text-sm text-[var(--ink-muted)]">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Pedidos recientes */}
          <section className="card xl:col-span-2 overflow-hidden animate-slide-up" style={{ animationDelay: '.1s' }}>
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
              <p className="eyebrow">Pedidos recientes</p>
              <Link to="/proveedor/ventas" className="text-xs font-semibold text-[var(--a)] hover:underline">Ver todas →</Link>
            </div>
            <ul className="divide-y divide-[var(--surface-border)]">
              {orders.slice(0, 6).map(o => (
                <li key={o.order_code} className="flex items-center gap-3 px-5 sm:px-6 py-3 hover:bg-[var(--surface-side)] transition-colors">
                  <PlatformLogo name={o.products?.platforms?.name} filename={o.products?.platforms?.logo_filename} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{o.products?.name}</p>
                    <p className="text-xs text-[var(--ink-faint)] truncate">{o.client_name || 'Sin cliente'} · {timeAgo(o.created_at)}</p>
                  </div>
                  <Badge color={STATUS_BADGE[o.status] || 'neutral'} className="hidden sm:inline-flex">{getStatusLabel(o.status)}</Badge>
                  <span className="font-mono text-sm text-[var(--ink)] w-16 text-right">{formatUSD(o.price_paid)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Alertas */}
          <section className="space-y-5 animate-slide-up" style={{ animationDelay: '.14s' }}>
            <Link to="/proveedor/soporte" className={`card card-hover p-5 flex items-center gap-4 ${stats.tickets ? 'card-sig' : ''}`}>
              <span className={`w-11 h-11 rounded-xl grid place-items-center border ${stats.tickets ? 'bg-[var(--b-soft)] border-[var(--b-line)] text-[var(--b)]' : 'inset text-[var(--ink-faint)]'}`}><IconHeadphones size={19} /></span>
              <div className="flex-1">
                <p className="font-semibold text-[var(--ink)]">{stats.tickets ? `${stats.tickets} ticket${stats.tickets !== 1 ? 's' : ''} abierto${stats.tickets !== 1 ? 's' : ''}` : 'Sin tickets abiertos'}</p>
                <p className="text-xs text-[var(--ink-muted)]">{stats.tickets ? 'Tus distribuidores esperan respuesta' : 'Todo tranquilo por ahora'}</p>
              </div>
              <span className="text-[var(--ink-faint)]">→</span>
            </Link>

            {provider?.slug && (
              <div className="card p-5">
                <p className="eyebrow mb-1 flex items-center gap-1.5"><IconUsers size={13} />Suma distribuidores</p>
                <p className="text-[12.5px] text-[var(--ink-muted)] mb-3">Comparte este enlace: se registran directo en tu tienda.</p>
                <CopyField value={`${window.location.origin}/register?codigo=${provider.slug}`} />
              </div>
            )}

            <div className="card p-5">
              <p className="eyebrow mb-3 flex items-center gap-1.5"><IconAlertCircle size={13} />Stock bajo</p>
              {lowStock.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">Todos tus productos tienen stock suficiente.</p> : (
                <ul className="space-y-2.5">
                  {lowStock.map(p => (
                    <li key={p.id} className="flex items-center gap-3">
                      <PlatformLogo name={p.platforms?.name} filename={p.platforms?.logo_filename} size={30} />
                      <span className="flex-1 min-w-0 text-[13px] text-[var(--ink)] truncate">{p.name}</span>
                      <Badge color={p.available === 0 ? 'red' : 'yellow'}>{p.available === 0 ? 'Agotado' : `${p.available} disp.`}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {lowStock.length > 0 && <Link to="/proveedor/stock" className="btn-secondary btn-sm w-full mt-4">Reponer stock</Link>}
            </div>
          </section>
        </div>
      )}
      <WeeklyReport open={report} onClose={() => setReport(false)} />
    </div>
  )
}
