import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard, Section, Spinner } from '@/components/ui'
import { IconUsers, IconBox, IconDollar, IconTrendingUp } from '@/assets/icons'
import { formatUSD } from '@/utils'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ providers: 0, distributors: 0, orders: 0, revenue: 0 })
  const [recentProviders, setRecentProviders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const [{ count: providers }, { count: distributors }, { count: orders }, { data: rev }] = await Promise.all([
      supabase.from('providers').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'distribuidor'),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('price_paid').neq('status', 'cancelado'),
    ])
    const revenue = rev?.reduce((s, o) => s + parseFloat(o.price_paid), 0) || 0
    setStats({ providers: providers || 0, distributors: distributors || 0, orders: orders || 0, revenue })

    const { data: prov } = await supabase
      .from('providers')
      .select('*, users(email, full_name)')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentProviders(prov || [])
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Vista general de la plataforma" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <StatCard label="Proveedores" value={stats.providers} icon={IconUsers} color="neutral" />
        <StatCard label="Distribuidores" value={stats.distributors} icon={IconBox} color="neutral" />
        <StatCard label="Total pedidos" value={stats.orders} icon={IconTrendingUp} color="green" />
        <StatCard label="Ingresos totales" value={formatUSD(stats.revenue)} icon={IconDollar} color="green" />
      </div>

      <Section title="Proveedores recientes">
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Slug</th>
                  <th>Estado</th>
                  <th>Vence</th>
                </tr>
              </thead>
              <tbody>
                {recentProviders.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <p className="font-medium text-[var(--ink)]">{p.display_name || p.users?.full_name || '—'}</p>
                        <p className="text-xs text-[var(--ink-faint)]">{p.users?.email}</p>
                      </div>
                    </td>
                    <td><span className="font-mono text-xs text-[var(--ink-muted)]">{p.slug}</span></td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                        {p.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--ink-muted)]">
                      {p.expires_at ? new Date(p.expires_at).toLocaleDateString('es-PE') : '—'}
                    </td>
                  </tr>
                ))}
                {recentProviders.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-[var(--ink-faint)] py-8">Sin proveedores aún</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  )
}
