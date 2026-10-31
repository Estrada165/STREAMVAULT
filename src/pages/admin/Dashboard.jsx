import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard, PageLoader, Badge } from '@/components/ui'
import { IconUsers, IconBox, IconDollar, IconTrendingUp, IconClock, IconAlertCircle, IconCheck } from '@/assets/icons'
import { formatUSD, daysRemaining, timeAgo } from '@/utils'

function ProviderRow({ p, right }) {
  const name = p.display_name || p.users?.full_name || p.users?.email || '—'
  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-side)] transition-colors">
      <span className="w-9 h-9 rounded-xl inset grid place-items-center font-semibold text-sm text-[var(--ink-muted)] uppercase flex-shrink-0">{name[0]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--ink)] truncate">{name}</p>
        <p className="text-xs text-[var(--ink-faint)] truncate">{p.users?.email} · <span className="font-mono">{p.slug}</span></p>
      </div>
      {right}
    </li>
  )
}

function flagsOf(h) {
  const f = []
  const d = h.expires_at ? daysRemaining(h.expires_at) : null
  if (!h.is_active) return [['Inactivo', 'neutral']]
  if (d !== null && d <= 0) f.push(['Acceso vencido', 'red'])
  else if (d !== null && d <= 7) f.push([`Vence en ${d} d`, 'yellow'])
  if (Number(h.pending_orders) > 0) f.push([`${h.pending_orders} por entregar`, 'violet'])
  if (Number(h.active_products) > 0 && Number(h.available_stock) === 0) f.push(['Sin stock', 'red'])
  if (Number(h.sales_7d) === 0) f.push(['Sin ventas en 7 días', 'yellow'])
  if (Number(h.active_distributors) === 0) f.push(['Sin distribuidores activos', 'yellow'])
  return f
}

function HealthSection({ health }) {
  const [showOk, setShowOk] = useState(false)
  const rows = health.map(h => ({ ...h, flags: flagsOf(h) }))
    .sort((a, b) => (b.is_active - a.is_active) || (b.flags.length - a.flags.length) || (Number(b.revenue_7d) - Number(a.revenue_7d)))
  const atRisk = rows.filter(r => r.is_active && r.flags.length)
  const list = showOk ? rows : rows.filter(r => !r.is_active ? false : r.flags.length)
  return (
    <section className="card overflow-hidden xl:col-span-2 animate-slide-up" style={{ animationDelay: '.08s' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><IconTrendingUp size={13} />Salud de la plataforma</p>
          <p className="text-xs text-[var(--ink-muted)] mt-1">{atRisk.length ? `${atRisk.length} proveedor${atRisk.length === 1 ? '' : 'es'} necesita${atRisk.length === 1 ? '' : 'n'} atención` : 'Todos los proveedores activos están bien'}</p>
        </div>
        <button onClick={() => setShowOk(v => !v)} className="btn-ghost btn-sm">{showOk ? 'Solo con alertas' : `Ver todos (${rows.length})`}</button>
      </div>
      {list.length === 0 ? <p className="px-5 pb-5 text-sm text-[var(--ink-muted)] flex items-center gap-2"><IconCheck size={14} className="text-[var(--a)]" />Sin alertas por ahora.</p> : (
        <ul className="divide-y divide-[var(--surface-border)]">
          {list.map(h => (
            <li key={h.provider_id} className="px-5 py-3.5 grid gap-2 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,.6fr))_minmax(0,1.5fr)] md:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--ink)] truncate">{h.display_name || h.slug}</p>
                <p className="text-[11.5px] text-[var(--ink-faint)] truncate">{h.last_sale_at ? `Última venta ${timeAgo(h.last_sale_at)}` : 'Sin ventas aún'}</p>
              </div>
              <div className="flex md:block gap-1.5 text-[12px]"><span className="md:block font-mono text-[var(--ink)]">{formatUSD(h.revenue_7d)}</span><span className="text-[var(--ink-faint)]">{h.sales_7d} ventas 7d</span></div>
              <div className="flex md:block gap-1.5 text-[12px]"><span className="md:block font-mono text-[var(--ink)]">{h.active_distributors}/{h.total_distributors}</span><span className="text-[var(--ink-faint)]">distrib.</span></div>
              <div className="flex md:block gap-1.5 text-[12px]"><span className="md:block font-mono text-[var(--ink)]">{h.available_stock}</span><span className="text-[var(--ink-faint)]">en stock</span></div>
              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {h.flags.length ? h.flags.map(([t, c]) => <Badge key={t} color={c}>{t}</Badge>) : <Badge color="green" dot>Saludable</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ providers: 0, distributors: 0, orders: 0, revenue: 0 })
  const [providers, setProviders] = useState([])
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const [{ count: distributors }, { count: orders }, { data: rev }, { data: prov }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'distribuidor'),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('price_paid').neq('status', 'cancelado'),
      supabase.from('providers').select('*, users(email, full_name)').order('created_at', { ascending: false }),
    ])
    let revenue = rev?.reduce((s, o) => s + parseFloat(o.price_paid), 0) || 0
    // Cifras exactas desde la base de datos (sin el límite de 1000 filas), si el SQL 008 está aplicado
    const { data: h, error: hErr } = await supabase.rpc('admin_platform_health')
    if (!hErr && h) { setHealth(h); revenue = h.reduce((s, x) => s + parseFloat(x.revenue_total || 0), 0) }
    setStats({ providers: prov?.length || 0, distributors: distributors || 0, orders: orders || 0, revenue })
    setProviders(prov || [])
    setLoading(false)
  }

  if (loading) return <PageLoader />

  const pending = providers.filter(p => !p.is_active && !p.expires_at)
  const expiring = providers
    .filter(p => p.is_active && p.expires_at && daysRemaining(p.expires_at) <= 7)
    .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
  const active = providers.filter(p => p.is_active && p.expires_at && daysRemaining(p.expires_at) > 0).length

  return (
    <div>
      <PageHeader eyebrow="Administración" title="Vista" accent="general" subtitle="Cómo va la plataforma hoy" action={<Link to="/admin/proveedores" className="btn-primary"><IconUsers size={16} />Proveedores</Link>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger">
        <StatCard label="Proveedores" value={stats.providers} icon={IconUsers} color="violet" sub={`${active} con acceso vigente`} />
        <StatCard label="Distribuidores" value={stats.distributors} icon={IconBox} color="neutral" />
        <StatCard label="Pedidos" value={stats.orders} icon={IconTrendingUp} color="green" />
        <StatCard label="Volumen vendido" value={formatUSD(stats.revenue)} icon={IconDollar} color="green" highlight />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="card overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="eyebrow flex items-center gap-1.5"><IconAlertCircle size={13} />Por activar</p>
            <Badge color={pending.length ? 'violet' : 'neutral'}>{pending.length}</Badge>
          </div>
          {pending.length === 0 ? <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">No hay proveedores esperando activación.</p> : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {pending.slice(0, 6).map(p => (
                <ProviderRow key={p.id} p={p} right={<span className="text-xs text-[var(--ink-faint)] whitespace-nowrap">{timeAgo(p.created_at)}</span>} />
              ))}
            </ul>
          )}
          {pending.length > 0 && <div className="p-4 pt-2"><Link to="/admin/proveedores" className="btn-secondary btn-sm w-full">Revisar y activar</Link></div>}
        </section>

        <section className="card overflow-hidden animate-slide-up" style={{ animationDelay: '.06s' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="eyebrow flex items-center gap-1.5"><IconClock size={13} />Vencen esta semana</p>
            <Badge color={expiring.length ? 'yellow' : 'neutral'}>{expiring.length}</Badge>
          </div>
          {expiring.length === 0 ? <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">Ningún acceso vence en los próximos 7 días.</p> : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {expiring.slice(0, 6).map(p => {
                const d = daysRemaining(p.expires_at)
                return <ProviderRow key={p.id} p={p} right={<span className={`days-pill ${d <= 0 ? 'red' : d <= 3 ? 'red' : 'yellow'}`}>{d <= 0 ? 'Vencido' : `${d} d`}</span>} />
              })}
            </ul>
          )}
        </section>

        {health && <HealthSection health={health} />}

        <section className="card overflow-hidden xl:col-span-2 animate-slide-up" style={{ animationDelay: '.1s' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="eyebrow">Proveedores recientes</p>
            <Link to="/admin/proveedores" className="text-xs font-semibold text-[var(--a)] hover:underline">Ver todos →</Link>
          </div>
          {providers.length === 0 ? <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">Sin proveedores aún.</p> : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {providers.slice(0, 6).map(p => (
                <ProviderRow key={p.id} p={p} right={
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--ink-faint)] hidden sm:inline">{p.expires_at ? `Vence ${new Date(p.expires_at).toLocaleDateString('es-PE')}` : 'Sin fecha'}</span>
                    <Badge color={p.is_active ? 'green' : 'red'} dot>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                } />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
