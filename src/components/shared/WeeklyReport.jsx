import { useState, useEffect, useMemo } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Modal, Tabs, Spinner, Badge, useToast } from '@/components/ui'
import { PlatformLogo } from '@/utils/platform'
import { formatUSD, copyToClipboard } from '@/utils'
import { waLink } from '@/lib/whatsapp'
import { IconCopy, IconWhatsApp } from '@/assets/icons'

function weekRange(offset) {
  const start = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7 * offset)
  return { start, end: addDays(start, 7) }
}

function Delta({ now, before }) {
  if (!before) return <span className="text-[11px] text-[var(--ink-faint)]">{now ? 'nuevo' : '—'}</span>
  const d = ((now - before) / before) * 100
  return <span className={`text-[11px] font-semibold ${d >= 0 ? 'text-[var(--a)]' : 'text-[var(--status-red)]'}`}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)}%</span>
}

/** Reporte semanal del proveedor: ventas, recargas, lo más vendido y sus mejores distribuidores */
export default function WeeklyReport({ open, onClose }) {
  const { provider } = useAuth()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [raw, setRaw] = useState(null)

  useEffect(() => {
    if (!open || !provider) return
    setRaw(null)
    const { start, end } = weekRange(offset)
    const prevStart = addDays(start, -7).toISOString()
    Promise.all([
      supabase.from('orders').select('price_paid, status, created_at, distributor_id, product_id, products(name, platforms(name, logo_filename))')
        .gte('created_at', prevStart).lt('created_at', end.toISOString()),
      supabase.from('transactions').select('amount_usd, created_at').eq('type', 'recarga').gte('created_at', prevStart).lt('created_at', end.toISOString()),
      supabase.from('users').select('id, full_name, email, created_at').eq('provider_id', provider.id).eq('role', 'distribuidor'),
    ]).then(([o, t, u]) => setRaw({ orders: o.data || [], recharges: t.data || [], users: u.data || [], start, end }))
  }, [open, offset, provider])

  const r = useMemo(() => {
    if (!raw) return null
    const { start, end } = raw
    const inWeek = d => new Date(d) >= start && new Date(d) < end
    // Semana en curso: se compara contra el MISMO tramo de la semana anterior (lunes → hoy a esta hora)
    const cutoff = end > new Date() ? new Date(Date.now() - 7 * 864e5) : addDays(start, 0)
    const inPrev = d => !inWeek(d) && new Date(d) < cutoff
    const valid = raw.orders.filter(o => o.status !== 'cancelado')
    const cur = valid.filter(o => inWeek(o.created_at)), prev = valid.filter(o => inPrev(o.created_at))
    const sum = l => l.reduce((s, o) => s + (parseFloat(o.price_paid ?? o.amount_usd) || 0), 0)
    const names = Object.fromEntries(raw.users.map(u => [u.id, u.full_name || u.email]))
    const days = Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), total: 0, count: 0 }))
    cur.forEach(o => { const i = Math.floor((new Date(o.created_at) - start) / 864e5); if (days[i]) { days[i].total += parseFloat(o.price_paid); days[i].count++ } })
    const top = (key, label) => Object.values(cur.reduce((m, o) => {
      const k = o[key]; m[k] = m[k] || { k, label: label(o), count: 0, total: 0, logo: o.products?.platforms }
      m[k].count++; m[k].total += parseFloat(o.price_paid); return m
    }, {})).sort((a, b) => b.total - a.total).slice(0, 5)
    const recCur = raw.recharges.filter(x => inWeek(x.created_at)), recPrev = raw.recharges.filter(x => inPrev(x.created_at))
    return {
      start, end,
      sales: sum(cur), salesPrev: sum(prev), count: cur.length, countPrev: prev.length,
      avg: cur.length ? sum(cur) / cur.length : 0,
      recharges: sum(recCur), rechargesPrev: sum(recPrev),
      newDists: raw.users.filter(u => inWeek(u.created_at)).length,
      days, max: Math.max(1, ...days.map(d => d.total)),
      products: top('product_id', o => o.products?.name || 'Producto'),
      dists: top('distributor_id', o => names[o.distributor_id] || 'Distribuidor'),
    }
  }, [raw])

  const label = r ? `${format(r.start, "d 'de' MMM", { locale: es })} – ${format(addDays(r.end, -1), "d 'de' MMM", { locale: es })}` : ''

  function summaryText() {
    return (
      `📊 *Reporte semanal · ${provider?.display_name || ''}*\n🗓️ ${label}\n\n` +
      `💰 Ventas: *${formatUSD(r.sales)}* (${r.count} pedidos)\n` +
      `🎟️ Ticket promedio: ${formatUSD(r.avg)}\n` +
      `💳 Recargas recibidas: ${formatUSD(r.recharges)}\n` +
      `👥 Distribuidores nuevos: ${r.newDists}\n` +
      (r.products.length ? `\n🏆 Lo más vendido:\n${r.products.map((p, i) => `${i + 1}. ${p.label} — ${p.count} (${formatUSD(p.total)})`).join('\n')}\n` : '') +
      (r.dists.length ? `\n⭐ Mejores distribuidores:\n${r.dists.map((p, i) => `${i + 1}. ${p.label} — ${formatUSD(p.total)}`).join('\n')}` : '')
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Reporte semanal" subtitle={label || 'Cargando…'} maxWidth="max-w-3xl"
      footer={r && <>
        <button onClick={async () => { await copyToClipboard(summaryText()); toast.success('Resumen copiado') }} className="btn-secondary"><IconCopy size={15} />Copiar resumen</button>
        {provider?.whatsapp_support && <a href={waLink(provider.whatsapp_support, summaryText())} target="_blank" rel="noreferrer" className="btn-primary"><IconWhatsApp size={15} />Enviarme por WhatsApp</a>}
      </>}>
      <Tabs className="mb-5" tabs={[{ label: 'Esta semana', value: 0 }, { label: 'Semana pasada', value: 1 }, { label: 'Hace 2 semanas', value: 2 }]} active={offset} onChange={setOffset} />
      {!r ? <div className="h-64 grid place-items-center"><Spinner size={24} /></div> : (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              ['Ventas', formatUSD(r.sales), <Delta now={r.sales} before={r.salesPrev} />],
              ['Pedidos', r.count, <Delta now={r.count} before={r.countPrev} />],
              ['Recargas', formatUSD(r.recharges), <Delta now={r.recharges} before={r.rechargesPrev} />],
              ['Nuevos distrib.', r.newDists, <span className="text-[11px] text-[var(--ink-faint)]">ticket prom. {formatUSD(r.avg)}</span>],
            ].map(([k, v, d]) => (
              <div key={k} className="inset px-3.5 py-3 min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-[var(--ink-faint)] truncate">{k}</p>
                <p className="font-mono text-xl text-[var(--ink)] mt-1 truncate">{v}</p>
                <div className="mt-0.5 truncate">{d}</div>
              </div>
            ))}
          </div>

          <div>
            <p className="eyebrow mb-3">Ventas por día</p>
            <div className="flex items-end gap-2 h-32" title="Los porcentajes comparan con el mismo periodo de la semana anterior">
              {r.days.map((d, i) => (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group relative">
                  <span className="absolute -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-mono px-2 py-1 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] whitespace-nowrap pointer-events-none z-10">{formatUSD(d.total)} · {d.count}</span>
                  <div className="w-full rounded-t-[8px] rounded-b-[3px] transition-all duration-700" style={{ height: `${Math.max(4, (d.total / r.max) * 100)}%`, background: d.total ? 'linear-gradient(180deg, var(--a), color-mix(in srgb, var(--a) 55%, var(--b)))' : 'var(--surface-border)' }} />
                  <span className="text-[10.5px] text-[var(--ink-faint)] capitalize">{format(d.date, 'EEE', { locale: es }).slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[['Lo más vendido', r.products, true], ['Mejores distribuidores', r.dists, false]].map(([title, list, isProd]) => (
              <div key={title} className="rounded-2xl border border-[var(--surface-border)] p-4">
                <p className="eyebrow mb-3">{title}</p>
                {list.length === 0 ? <p className="text-sm text-[var(--ink-faint)]">Sin ventas esta semana.</p> : (
                  <ul className="space-y-2.5">
                    {list.map((p, i) => (
                      <li key={p.k} className="flex items-center gap-3">
                        {isProd ? <PlatformLogo name={p.logo?.name} filename={p.logo?.logo_filename} size={30} />
                          : <span className="w-[30px] h-[30px] rounded-full inset grid place-items-center text-[11px] font-bold text-[var(--ink-muted)]">{i + 1}</span>}
                        <span className="flex-1 min-w-0 text-[13px] text-[var(--ink)] truncate">{p.label}</span>
                        <Badge color="neutral">{p.count}</Badge>
                        <span className="font-mono text-[13px] text-[var(--ink)] w-16 text-right">{formatUSD(p.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
