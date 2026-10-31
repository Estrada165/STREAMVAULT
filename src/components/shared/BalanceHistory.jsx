import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Tabs, EmptyState, SkeletonList, Spinner } from '@/components/ui'
import { formatUSD } from '@/utils'
import { IconWallet, IconShoppingCart, IconRefreshCw, IconEdit, IconDownload, IconSearch } from '@/assets/icons'

const PAGE = 50
const TYPES = {
  recarga: { label: 'Recarga', icon: IconWallet, tone: 'text-[var(--a)] bg-[var(--a-soft)] border-[var(--a-line)]' },
  compra: { label: 'Compra', icon: IconShoppingCart, tone: 'text-[var(--ink-muted)] bg-[var(--surface-overlay)] border-[var(--surface-border)]' },
  devolucion: { label: 'Devolución', icon: IconRefreshCw, tone: 'text-[var(--b)] bg-[var(--b-soft)] border-[var(--b-line)]' },
}
const OTHER = { label: 'Ajuste', icon: IconEdit, tone: 'text-[var(--status-yellow)] bg-[var(--status-yellow-bg)] border-[var(--status-yellow-border)]' }

function dayLabel(d) {
  const date = new Date(d)
  if (isToday(date)) return 'Hoy'
  if (isYesterday(date)) return 'Ayer'
  return format(date, "EEEE d 'de' MMMM", { locale: es })
}

/**
 * Historial de movimientos de saldo (tabla transactions).
 *  mode="self"     → el distribuidor ve los suyos (con saldo resultante)
 *  mode="provider" → el proveedor ve los de sus distribuidores
 *  mode="admin"    → el admin ve todos
 * La base de datos ya limita qué filas puede ver cada uno.
 */
export default function BalanceHistory({ mode = 'self', userId = null, currentBalance = null, providerId = null }) {
  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [people, setPeople] = useState([])
  const [type, setType] = useState('all')
  const [who, setWho] = useState(userId || 'all')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [summary, setSummary] = useState(null)

  const showPeople = mode !== 'self' && !userId

  // Nombres de los distribuidores (para proveedor y admin)
  useEffect(() => {
    if (mode === 'self') return
    let q = supabase.from('users').select('id, full_name, email').eq('role', 'distribuidor').order('full_name')
    if (mode === 'provider' && providerId) q = q.eq('provider_id', providerId)
    q.then(({ data }) => {
      setPeople(data || [])
      setNames(Object.fromEntries((data || []).map(u => [u.id, u.full_name || u.email])))
    })
  }, [mode, providerId])

  const query = useCallback((from) => {
    let q = supabase.from('transactions').select('id, user_id, type, amount_usd, description, created_at, ref_order_id')
      .order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    if (type !== 'all') q = q.eq('type', type)
    const target = userId || (who !== 'all' ? who : null)
    if (target) q = q.eq('user_id', target)
    // (proveedor: la base de datos ya devuelve solo los movimientos de SUS distribuidores)
    return q
  }, [type, who, userId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    query(0).then(({ data }) => {
      if (!alive) return
      setRows(data || []); setMore((data || []).length === PAGE); setLoading(false)
    })
    return () => { alive = false }
  }, [query])

  // Resumen de los últimos 30 días
  useEffect(() => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString()
    let q = supabase.from('transactions').select('type, amount_usd').gte('created_at', since)
    const target = userId || (who !== 'all' ? who : null)
    if (target) q = q.eq('user_id', target)
    q.then(({ data }) => {
      const s = { recargas: 0, compras: 0, devoluciones: 0 }
      ;(data || []).forEach(t => {
        const a = parseFloat(t.amount_usd) || 0
        if (t.type === 'recarga') s.recargas += a
        else if (t.type === 'devolucion') s.devoluciones += a
        else if (t.type === 'compra') s.compras += -a
      })
      setSummary(s)
    })
  }, [userId, who])

  async function loadMore() {
    setLoadingMore(true)
    const { data } = await query(rows.length)
    setRows(r => r.concat(data || [])); setMore((data || []).length === PAGE); setLoadingMore(false)
  }

  // Saldo resultante tras cada movimiento (solo vista propia sin filtros)
  const withBalance = useMemo(() => {
    if (mode !== 'self' || type !== 'all' || currentBalance === null) return rows
    let bal = parseFloat(currentBalance) || 0
    return rows.map(r => { const after = bal; bal -= parseFloat(r.amount_usd) || 0; return { ...r, _after: after } })
  }, [rows, mode, type, currentBalance])

  const groups = useMemo(() => {
    const g = []
    withBalance.forEach(r => {
      const k = new Date(r.created_at).toDateString()
      if (!g.length || g[g.length - 1].k !== k) g.push({ k, label: dayLabel(r.created_at), items: [] })
      g[g.length - 1].items.push(r)
    })
    return g
  }, [withBalance])

  function exportCsv() {
    const head = ['fecha', mode !== 'self' ? 'distribuidor' : null, 'tipo', 'monto_usd', 'detalle'].filter(Boolean)
    const lines = rows.map(r => [
      new Date(r.created_at).toLocaleString('es-PE'),
      mode !== 'self' ? (names[r.user_id] || r.user_id) : null,
      (TYPES[r.type] || OTHER).label, r.amount_usd, (r.description || '').replace(/"/g, "'"),
    ].filter(v => v !== null).map(v => `"${v}"`).join(','))
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `movimientos-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            ['Recargas', summary.recargas, 'text-[var(--a)]', '+'],
            ['Compras', summary.compras, 'text-[var(--ink)]', '−'],
            ['Devoluciones', summary.devoluciones, 'text-[var(--b)]', '+'],
          ].map(([k, v, c, sign]) => (
            <div key={k} className="inset px-3 py-2.5 min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-[var(--ink-faint)] truncate">{k} · 30 d</p>
              <p className={`font-mono text-[15px] sm:text-lg mt-0.5 truncate ${c}`}>{v ? sign : ''}{formatUSD(v)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-2.5 mb-4">
        <Tabs
          tabs={[{ label: 'Todo', value: 'all' }, { label: 'Recargas', value: 'recarga' }, { label: 'Compras', value: 'compra' }, { label: 'Devoluciones', value: 'devolucion' }]}
          active={type} onChange={setType}
        />
        {showPeople && (
          <label className="relative flex-1 md:max-w-xs">
            <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
            <select className="input input-icon !min-h-[2.6rem]" value={who} onChange={e => setWho(e.target.value)} aria-label="Filtrar por distribuidor">
              <option value="all">Todos los distribuidores</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </label>
        )}
        {rows.length > 0 && <button onClick={exportCsv} className="btn-secondary btn-sm md:ml-auto"><IconDownload size={14} />Descargar CSV</button>}
      </div>

      {loading ? <SkeletonList rows={6} /> : rows.length === 0 ? (
        <div className="card"><EmptyState icon={IconWallet} title="Sin movimientos" description={type === 'all' ? 'Aquí aparecerán las recargas, compras y devoluciones.' : 'No hay movimientos de este tipo.'} /></div>
      ) : (
        <div className="card overflow-hidden">
          {groups.map(g => (
            <div key={g.k}>
              <p className="px-4 sm:px-5 py-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--ink-faint)] bg-[var(--surface-side)] border-b border-[var(--surface-border)] first-letter:uppercase">{g.label}</p>
              <ul className="divide-y divide-[var(--surface-border)]">
                {g.items.map(r => {
                  const t = TYPES[r.type] || OTHER
                  const amt = parseFloat(r.amount_usd) || 0
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <span className={`w-9 h-9 rounded-xl border grid place-items-center flex-shrink-0 ${t.tone}`}><t.icon size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-[var(--ink)] truncate">{r.description || t.label}</p>
                        <p className="text-[11.5px] text-[var(--ink-faint)] truncate">
                          {format(new Date(r.created_at), 'HH:mm')} · {t.label}
                          {mode !== 'self' && names[r.user_id] ? <> · <span className="text-[var(--ink-muted)]">{names[r.user_id]}</span></> : null}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-mono text-[14px] ${amt > 0 ? 'text-[var(--a)]' : 'text-[var(--ink)]'}`}>{amt > 0 ? '+' : '−'}{formatUSD(Math.abs(amt))}</p>
                        {r._after !== undefined && <p className="text-[10.5px] font-mono text-[var(--ink-faint)]">saldo {formatUSD(r._after)}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {more && (
            <div className="p-3 border-t border-[var(--surface-border)]">
              <button onClick={loadMore} disabled={loadingMore} className="btn-ghost btn-sm w-full justify-center">{loadingMore ? <Spinner size={14} /> : 'Ver más movimientos'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
