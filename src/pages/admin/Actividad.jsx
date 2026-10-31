import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { PageHeader, Tabs, EmptyState, SkeletonList, Spinner, Alert } from '@/components/ui'
import BalanceHistory from '@/components/shared/BalanceHistory'
import { IconUsers, IconUser, IconBox, IconShoppingCart, IconWallet, IconDollar, IconSearch, IconX, IconLayers, IconDatabase } from '@/assets/icons'

const PAGE = 60
const ENTITY = {
  proveedor: { label: 'Proveedores', icon: IconUsers, tone: 'text-[var(--b)] bg-[var(--b-soft)] border-[var(--b-line)]' },
  distribuidor: { label: 'Distribuidores', icon: IconUser, tone: 'text-[var(--a)] bg-[var(--a-soft)] border-[var(--a-line)]' },
  usuario: { label: 'Usuarios', icon: IconUser, tone: 'text-[var(--ink-muted)] bg-[var(--surface-overlay)] border-[var(--surface-border)]' },
  pedido: { label: 'Pedidos', icon: IconShoppingCart, tone: 'text-[var(--ink-muted)] bg-[var(--surface-overlay)] border-[var(--surface-border)]' },
  producto: { label: 'Productos', icon: IconBox, tone: 'text-[var(--ink-muted)] bg-[var(--surface-overlay)] border-[var(--surface-border)]' },
  saldo: { label: 'Saldos', icon: IconWallet, tone: 'text-[var(--status-yellow)] bg-[var(--status-yellow-bg)] border-[var(--status-yellow-border)]' },
}
const ACTION_ICON = { cobro: IconDollar, stock: IconDatabase }
const ROLE = { admin: 'Admin', proveedor: 'Proveedor', distribuidor: 'Distribuidor', sistema: 'Sistema' }

function dayLabel(d) {
  const date = new Date(d)
  if (isToday(date)) return 'Hoy'
  if (isYesterday(date)) return 'Ayer'
  return format(date, "EEEE d 'de' MMMM", { locale: es })
}

function ActivityLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [entity, setEntity] = useState('all')
  const [prov, setProv] = useState('all')
  const [providers, setProviders] = useState([])
  const [actors, setActors] = useState({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('providers').select('id, display_name, slug').then(({ data }) => setProviders((data || []).sort((a, b) => (a.display_name || a.slug).localeCompare(b.display_name || b.slug))))
  }, [])

  const query = useCallback(from => {
    let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    if (entity !== 'all') q = q.eq('entity', entity)
    if (prov !== 'all') q = q.eq('provider_id', prov)
    if (search.trim()) q = q.ilike('summary', `%${search.trim()}%`)
    return q
  }, [entity, prov, search])

  async function withActors(data) {
    const ids = [...new Set((data || []).map(r => r.actor_id).filter(id => id && !actors[id]))]
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, full_name, email').in('id', ids.slice(0, 100))
      setActors(a => ({ ...a, ...Object.fromEntries((us || []).map(u => [u.id, u.full_name || u.email])) }))
    }
    return data || []
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      const { data, error: err } = await query(0)
      if (!alive) return
      if (err) setError(err.message?.includes('activity_log') ? 'Falta ejecutar el SQL 008 en Supabase.' : err.message)
      setRows(await withActors(data)); setMore((data || []).length === PAGE); setLoading(false)
    }, search ? 300 : 0)
    return () => { alive = false; clearTimeout(t) }
  }, [query])

  async function loadMore() {
    setLoadingMore(true)
    const { data } = await query(rows.length)
    const extra = await withActors(data)
    setRows(r => r.concat(extra)); setMore(extra.length === PAGE); setLoadingMore(false)
  }

  const groups = useMemo(() => {
    const g = []
    rows.forEach(r => {
      const k = new Date(r.created_at).toDateString()
      if (!g.length || g[g.length - 1].k !== k) g.push({ k, label: dayLabel(r.created_at), items: [] })
      g[g.length - 1].items.push(r)
    })
    return g
  }, [rows])

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-2.5 mb-4">
        <label className="relative flex-1">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
          <input className="input input-icon" placeholder="Buscar: nombre, código de pedido, producto…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar en la actividad" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1.5" aria-label="Limpiar"><IconX size={14} /></button>}
        </label>
        <select className="input lg:!w-64" value={prov} onChange={e => setProv(e.target.value)} aria-label="Filtrar por proveedor">
          <option value="all">Todos los proveedores</option>
          {providers.map(p => <option key={p.id} value={p.id}>{p.display_name || p.slug}</option>)}
        </select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-4">
        <button onClick={() => setEntity('all')} className={`btn-secondary btn-sm flex-shrink-0 ${entity === 'all' ? 'is-down !text-[var(--a)]' : ''}`}>Todo</button>
        {Object.entries(ENTITY).map(([k, v]) => (
          <button key={k} onClick={() => setEntity(k)} className={`btn-secondary btn-sm flex-shrink-0 ${entity === k ? 'is-down !text-[var(--a)]' : ''}`}><v.icon size={13} />{v.label}</button>
        ))}
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {loading ? <SkeletonList rows={8} /> : rows.length === 0 ? (
        <div className="card"><EmptyState icon={IconLayers} title="Sin actividad" description={search || entity !== 'all' || prov !== 'all' ? 'Nada coincide con los filtros.' : 'Aquí verás registros, activaciones, compras, recargas, cambios de precio y cobros.'} /></div>
      ) : (
        <div className="card overflow-hidden">
          {groups.map(g => (
            <div key={g.k}>
              <p className="px-4 sm:px-5 py-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--ink-faint)] bg-[var(--surface-side)] border-b border-[var(--surface-border)]">{g.label}</p>
              <ul className="divide-y divide-[var(--surface-border)]">
                {g.items.map(r => {
                  const e = ENTITY[r.entity] || ENTITY.usuario
                  const Icon = ACTION_ICON[r.action] || e.icon
                  return (
                    <li key={r.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                      <span className={`w-9 h-9 rounded-xl border grid place-items-center flex-shrink-0 ${r.action === 'cobro' ? ENTITY.distribuidor.tone : e.tone}`}><Icon size={15} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-[var(--ink)] leading-snug break-words">{r.summary}</p>
                        <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                          {format(new Date(r.created_at), 'HH:mm')} · {r.actor_id ? <>{actors[r.actor_id] || 'Usuario'} <span className="opacity-70">({ROLE[r.actor_role] || r.actor_role})</span></> : 'Sistema'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {more && <div className="p-3 border-t border-[var(--surface-border)]"><button onClick={loadMore} disabled={loadingMore} className="btn-ghost btn-sm w-full justify-center">{loadingMore ? <Spinner size={14} /> : 'Ver más'}</button></div>}
        </div>
      )}
    </div>
  )
}

export default function AdminActividad() {
  const [tab, setTab] = useState('log')
  return (
    <div>
      <PageHeader eyebrow="Administración" title="Registro de" accent="actividad" subtitle="Quién hizo qué y cuándo, en toda la plataforma" />
      <Tabs className="mb-5" tabs={[{ label: 'Actividad', value: 'log' }, { label: 'Movimientos de saldo', value: 'saldo' }]} active={tab} onChange={setTab} />
      {tab === 'log' ? <ActivityLog /> : <BalanceHistory mode="admin" />}
    </div>
  )
}
