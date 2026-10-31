import { useState } from 'react'
import { PlatformLogo } from '@/utils/platform'
import { waLink } from '@/lib/whatsapp'
import { daysLeft, clientReminder, providerRenewal, getReminded, markReminded } from '@/lib/reminders'
import { IconClock, IconWhatsApp, IconRefreshCw, IconCheck, IconChevronDown } from '@/assets/icons'

function agoShort(isoDate) {
  const d = Math.floor((Date.now() - new Date(isoDate)) / 86400000)
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`
}

function DaysChip({ days }) {
  const tone = days < 0 ? 'red' : days <= 1 ? 'red' : days <= 3 ? 'yellow' : 'green'
  const label = days < 0 ? 'Vencido' : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${days} días`
  return <span className={`days-pill ${tone} !text-[11.5px] !px-2.5 !py-1`}><span className={`dot ${days <= 1 ? 'animate-pulse-soft' : ''}`} />{label}</span>
}

/**
 * "Vencen pronto": pedidos activos que vencen en ≤7 días y vencidos hace ≤3 días.
 * Un toque para recordarle al cliente y otro para pedir la renovación al proveedor.
 */
export default function ExpiringSoon({ orders, exchangeRate = 3.5 }) {
  const [showAll, setShowAll] = useState(false)
  const [, force] = useState(0)

  const list = orders
    .map(o => ({ ...o, _days: daysLeft(o.expires_at) }))
    .filter(o => o._days !== null && ((o.status === 'activo' && o._days <= 7) || (o.status === 'expirado' && o._days >= -3)))
    .sort((a, b) => a._days - b._days)

  if (!list.length) return null
  const shown = showAll ? list : list.slice(0, 6)
  const urgent = list.filter(o => o._days <= 1).length

  function remind(o) {
    const platformName = o.products?.platforms?.name || o.products?.name
    window.open(waLink(o.client_whatsapp, clientReminder({ clientName: o.client_name, platformName, expiresAt: o.expires_at })), '_blank')
    markReminded(o.id); force(x => x + 1)
  }
  function renew(o) {
    const phone = o.products?.providers?.whatsapp_support || ''
    window.open(waLink(phone, providerRenewal({
      orderCode: o.order_code, productName: o.products?.name, email: o.stock_items?.email,
      expiresAt: o.expires_at, costUsd: o.products?.renewal_price_usd || o.price_paid, exchangeRate,
    })), '_blank')
  }

  return (
    <section className="card p-4 sm:p-5 mb-6 animate-slide-up" aria-label="Pedidos que vencen pronto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl grid place-items-center bg-[var(--status-yellow-bg)] border border-[var(--status-yellow-border)] text-[var(--status-yellow)]"><IconClock size={18} /></span>
          <div>
            <h2 className="font-display font-semibold text-[var(--ink)] leading-tight">Vencen pronto <span className="font-mono text-sm text-[var(--ink-faint)]">{list.length}</span></h2>
            <p className="text-xs text-[var(--ink-muted)]">{urgent ? `${urgent} vence${urgent === 1 ? '' : 'n'} hoy o mañana · ` : ''}Avisa a tus clientes y asegura la renovación</p>
          </div>
        </div>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map(o => {
          const reminded = getReminded(o.id)
          const platform = o.products?.platforms
          return (
            <li key={o.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-side)] p-3 flex flex-col gap-3 transition-colors hover:border-[var(--surface-border-strong)]">
              <div className="flex items-center gap-3 min-w-0">
                <PlatformLogo name={platform?.name} filename={platform?.logo_filename} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{o.client_name || 'Cliente sin nombre'}</p>
                  <p className="text-[11.5px] text-[var(--ink-faint)] truncate">{o.products?.name}</p>
                </div>
                <DaysChip days={o._days} />
              </div>
              <div className="flex items-center gap-2">
                {o.client_whatsapp ? (
                  <button onClick={() => remind(o)} className={`btn-sm flex-1 ${reminded ? 'btn-secondary' : 'btn-accent'}`}>
                    {reminded ? <><IconCheck size={14} />Avisado {agoShort(reminded)}</> : <><IconWhatsApp size={14} />Recordar</>}
                  </button>
                ) : (
                  <span className="flex-1 text-[11.5px] text-[var(--ink-faint)] px-1">Sin WhatsApp del cliente</span>
                )}
                <button onClick={() => renew(o)} className="btn-secondary btn-sm" title="Pedir renovación al proveedor"><IconRefreshCw size={14} />Renovar</button>
              </div>
            </li>
          )
        })}
      </ul>

      {list.length > 6 && (
        <button onClick={() => setShowAll(v => !v)} className="btn-ghost btn-sm mx-auto mt-3 flex">
          {showAll ? 'Ver menos' : `Ver los ${list.length}`}<IconChevronDown size={14} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  )
}
