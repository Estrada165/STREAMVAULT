import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, EmptyState, StatCard, Badge, PageLoader, Toggle, useToast, useConfirm } from '@/components/ui'
import { PAY_METHODS, parseAmount, currencyOf, money, extendProviderAccess, registerPayment, nextExpiry } from '@/lib/admin'
import { daysRemaining } from '@/utils'
import { waLink } from '@/lib/whatsapp'
import { APP_FULL_NAME } from '@/lib/brand'
import { IconDollar, IconPlus, IconTrash, IconCalendar, IconClock, IconWhatsApp, IconTrendingUp, IconDownload } from '@/assets/icons'

const EMPTY = { providerId: '', amount: '', currency: 'PEN', days: 30, extend: true, method: 'Yape', note: '', paidAt: '' }
const toLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16)

export default function AdminCobros() {
  const toast = useToast()
  const confirm = useConfirm()
  const [payments, setPayments] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: pays, error: err }, { data: provs }, { data: users }] = await Promise.all([
      supabase.from('provider_payments').select('*').order('paid_at', { ascending: false }).limit(1000),
      supabase.from('providers').select('id, user_id, slug, display_name, expires_at, is_active, renewal_cost'),
      supabase.from('users').select('id, phone, full_name, email').eq('role', 'proveedor'),
    ])
    if (err) setError(err.message?.includes('provider_payments') ? 'Falta ejecutar el SQL 008 en Supabase.' : err.message)
    const u = Object.fromEntries((users || []).map(x => [x.id, x]))
    setProviders((provs || []).map(p => ({ ...p, user: u[p.user_id] || {}, name: p.display_name || u[p.user_id]?.full_name || p.slug })).sort((a, b) => a.name.localeCompare(b.name)))
    setPayments(pays || []); setLoading(false)
  }

  const byId = useMemo(() => Object.fromEntries(providers.map(p => [p.id, p])), [providers])

  const stats = useMemo(() => {
    const m0 = startOfMonth(new Date()), m1 = subMonths(m0, 1), y = subMonths(m0, 11)
    const sum = (from, to, cur) => payments.filter(p => p.currency === cur && new Date(p.paid_at) >= from && (!to || new Date(p.paid_at) < to)).reduce((s, p) => s + parseFloat(p.amount), 0)
    const months = Array.from({ length: 6 }, (_, i) => {
      const from = subMonths(m0, 5 - i), to = subMonths(m0, 4 - i)
      return { label: format(from, 'MMM', { locale: es }), total: sum(from, to, 'PEN') }
    })
    return {
      month: sum(m0, null, 'PEN'), monthUsd: sum(m0, null, 'USD'),
      prev: sum(m1, m0, 'PEN'), year: sum(y, null, 'PEN'),
      months, max: Math.max(1, ...months.map(m => m.total)),
    }
  }, [payments])

  // Por cobrar: activos que vencen en ≤7 días o ya vencidos
  const due = providers
    .filter(p => p.expires_at && daysRemaining(p.expires_at) <= 7)
    .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))

  function openNew(p = null) {
    setForm({ ...EMPTY, providerId: p?.id || '', amount: parseAmount(p?.renewal_cost), currency: currencyOf(p?.renewal_cost), paidAt: toLocal(new Date()) })
    setError(''); setModal(true)
  }

  async function save() {
    const prov = byId[form.providerId]
    if (!prov) return setError('Elige un proveedor')
    if (!(parseFloat(form.amount) >= 0) || form.amount === '') return setError('Escribe el monto cobrado')
    setSaving(true); setError('')
    try {
      const days = form.extend ? parseInt(form.days) || 0 : 0
      if (days) await extendProviderAccess(prov, days)
      await registerPayment({ providerId: prov.id, amount: form.amount, currency: form.currency, days, method: form.method, note: form.note, paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : null })
      setModal(false); load(); toast.success(days ? `Cobro registrado y +${days} días para ${prov.name}` : 'Cobro registrado')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function remove(p) {
    if (!await confirm({ title: '¿Eliminar este cobro?', message: 'Solo se borra el registro; los días de acceso no cambian.', danger: true, confirmText: 'Eliminar' })) return
    await supabase.from('provider_payments').delete().eq('id', p.id); load()
  }

  function remind(p) {
    const days = daysRemaining(p.expires_at)
    const msg = `👋 ¡Hola ${p.name}!\n\n⏳ Tu acceso a *${APP_FULL_NAME}* ${days <= 0 ? 'ya venció' : `vence en ${days} día${days === 1 ? '' : 's'}`}.` +
      (p.renewal_cost ? `\n💰 Renovación: *${p.renewal_cost}*` : '') + `\n\n¿Coordinamos la renovación para que tus distribuidores no se queden sin tienda? 🙌`
    window.open(waLink(p.user.phone, msg), '_blank')
  }

  function exportCsv() {
    const rows = visible.map(p => [format(new Date(p.paid_at), 'yyyy-MM-dd HH:mm'), byId[p.provider_id]?.name || '', p.currency, p.amount, p.days_added, p.method || '', (p.note || '').replace(/"/g, "'")])
    const csv = '﻿' + [['fecha', 'proveedor', 'moneda', 'monto', 'dias', 'metodo', 'nota'], ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'cobros.csv'; a.click()
  }

  if (loading) return <PageLoader />
  const visible = filter === 'all' ? payments : payments.filter(p => p.provider_id === filter)
  const sel = byId[form.providerId]

  return (
    <div>
      <PageHeader eyebrow="Administración" title="Cobros de" accent="renovación" subtitle="Lo que te pagan tus proveedores por su acceso"
        action={<button onClick={() => openNew()} className="btn-primary"><IconPlus size={16} />Registrar cobro</button>} />
      {error && !modal && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger">
        <StatCard label="Este mes" value={money(stats.month)} icon={IconDollar} color="green" highlight sub={stats.monthUsd ? `+ ${money(stats.monthUsd, 'USD')}` : format(new Date(), 'MMMM', { locale: es })} />
        <StatCard label="Mes anterior" value={money(stats.prev)} icon={IconCalendar} color="neutral" />
        <StatCard label="Últimos 12 meses" value={money(stats.year)} icon={IconTrendingUp} color="violet" />
        <StatCard label="Por cobrar" value={due.length} icon={IconClock} color={due.length ? 'yellow' : 'neutral'} sub="vencen en 7 días o vencidos" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px] items-start">
        <div className="space-y-5 min-w-0">
          <section className="card p-5">
            <p className="eyebrow mb-4">Cobrado por mes (S/)</p>
            <div className="flex items-end gap-3 h-36">
              {stats.months.map((m, i) => (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5">
                  <span className="text-[10.5px] font-mono text-[var(--ink-muted)]">{m.total ? Math.round(m.total) : ''}</span>
                  <div className="w-full rounded-t-[8px] rounded-b-[3px]" style={{ height: `${Math.max(3, (m.total / stats.max) * 100)}%`, background: i === 5 ? 'linear-gradient(180deg, var(--a), color-mix(in srgb, var(--a) 55%, var(--b)))' : 'var(--surface-border)' }} />
                  <span className="text-[11px] capitalize text-[var(--ink-faint)]">{m.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2.5 px-5 pt-5 pb-3">
              <p className="eyebrow flex-1">Historial</p>
              <select className="input !w-auto !min-h-[2.4rem] !text-[13px]" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar por proveedor">
                <option value="all">Todos los proveedores</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {visible.length > 0 && <button onClick={exportCsv} className="btn-secondary btn-sm"><IconDownload size={14} />CSV</button>}
            </div>
            {visible.length === 0 ? <EmptyState icon={IconDollar} title="Sin cobros registrados" description="Registra un cobro al renovar el acceso de un proveedor." /> : (
              <ul className="divide-y divide-[var(--surface-border)]">
                {visible.map(p => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-9 h-9 rounded-xl grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)] flex-shrink-0"><IconDollar size={16} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-[var(--ink)] truncate">{byId[p.provider_id]?.name || 'Proveedor eliminado'}</p>
                      <p className="text-[11.5px] text-[var(--ink-faint)] truncate">
                        {format(new Date(p.paid_at), "d MMM yyyy · HH:mm", { locale: es })}{p.method ? ` · ${p.method}` : ''}{p.days_added ? ` · +${p.days_added} días` : ''}{p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <span className="font-mono text-[14px] text-[var(--ink)]">{money(p.amount, p.currency)}</span>
                    <button onClick={() => remove(p)} className="btn-ghost p-2 hover:!text-[var(--status-red)]" aria-label="Eliminar cobro"><IconTrash size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card overflow-hidden xl:sticky xl:top-6">
          <div className="px-5 pt-5 pb-3">
            <p className="eyebrow flex items-center gap-1.5"><IconClock size={13} />Por cobrar</p>
            <p className="text-xs text-[var(--ink-muted)] mt-1">Recuérdales y registra el pago en un toque</p>
          </div>
          {due.length === 0 ? <p className="px-5 pb-5 text-sm text-[var(--ink-faint)]">Nadie vence esta semana.</p> : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {due.map(p => {
                const d = daysRemaining(p.expires_at)
                return (
                  <li key={p.id} className="px-5 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 min-w-0 text-[13.5px] font-medium text-[var(--ink)] truncate">{p.name}</p>
                      <span className={`days-pill ${d <= 3 ? 'red' : 'yellow'}`}>{d <= 0 ? 'Vencido' : `${d} d`}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openNew(p)} className="btn-accent btn-sm flex-1"><IconDollar size={14} />Cobrar {p.renewal_cost || ''}</button>
                      {p.user.phone && <button onClick={() => remind(p)} className="btn-secondary btn-sm btn-icon" aria-label="Recordar por WhatsApp" title="Recordar por WhatsApp"><IconWhatsApp size={14} /></button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar cobro" subtitle={sel ? `Vence ${sel.expires_at ? format(new Date(sel.expires_at), "d 'de' MMM", { locale: es }) : 'sin fecha'}` : 'Pago de renovación de un proveedor'} maxWidth="max-w-md"
        footer={<>
          <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary min-w-[140px]">{saving ? <Spinner size={15} /> : 'Registrar'}</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label">Proveedor</label>
            <select className="input" value={form.providerId} onChange={e => { const p = byId[e.target.value]; setForm(f => ({ ...f, providerId: e.target.value, amount: f.amount || parseAmount(p?.renewal_cost), currency: p ? currencyOf(p.renewal_cost) : f.currency })) }}>
              <option value="">Elegir…</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}{p.renewal_cost ? ` · ${p.renewal_cost}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Monto cobrado</label>
            <div className="flex gap-2">
              <div className="inset flex p-1 gap-1 flex-shrink-0">
                {['PEN', 'USD'].map(c => <button key={c} type="button" onClick={() => setForm(f => ({ ...f, currency: c }))} className={`px-3 h-9 rounded-[.55rem] text-xs font-semibold border ${form.currency === c ? 'bg-[var(--key)] text-[var(--ink)] border-[var(--surface-border-strong)] shadow-[inset_0_1px_0_var(--hl),0_2px_0_var(--key-edge)]' : 'border-transparent text-[var(--ink-faint)]'}`}>{c === 'PEN' ? 'S/' : '$'}</button>)}
              </div>
              <input type="number" inputMode="decimal" min="0" step="0.5" className="input font-mono text-lg" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div>
            <p className="label">Método</p>
            <div className="flex flex-wrap gap-1.5">{PAY_METHODS.map(m => <button key={m} type="button" onClick={() => setForm(f => ({ ...f, method: m }))} className={`btn-secondary btn-sm ${form.method === m ? 'is-down !text-[var(--a)]' : ''}`}>{m}</button>)}</div>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-[var(--ink)]">Sumar días de acceso</p><p className="text-[11.5px] text-[var(--ink-faint)]">Renueva el acceso en el mismo paso</p></div>
              <Toggle checked={form.extend} onChange={v => setForm(f => ({ ...f, extend: v }))} />
            </div>
            {form.extend && (
              <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
                {[15, 30, 60, 90].map(d => <button key={d} type="button" onClick={() => setForm(f => ({ ...f, days: d }))} className={`btn-secondary btn-sm ${parseInt(form.days) === d ? 'is-down !text-[var(--a)]' : ''}`}>+{d}</button>)}
                <input type="number" min="1" className="input !w-20 !min-h-[2.25rem] font-mono" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} aria-label="Días" />
                {sel && parseInt(form.days) > 0 && <span className="text-[12px] text-[var(--a)] font-semibold ml-1">hasta {nextExpiry(sel.expires_at, form.days).toLocaleDateString('es-PE')}</span>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className="label">Fecha del pago</label><input type="datetime-local" className="input" value={form.paidAt} onChange={e => setForm(f => ({ ...f, paidAt: e.target.value }))} /></div>
            <div><label className="label">Nota</label><input className="input" maxLength={200} placeholder="N.º de operación…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
          </div>
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
