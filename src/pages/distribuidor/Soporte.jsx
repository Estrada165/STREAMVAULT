import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import { PageHeader, EmptyState, Spinner, Badge, PageLoader } from '@/components/ui'
import { IconHeadphones, IconTrash, IconWhatsApp } from '@/assets/icons'
import { formatDateTime, getReasonLabel, getTicketStatusColor } from '@/utils'
import { waLink } from '@/lib/whatsapp'

export default function DistSoporte() {
  const { profile, provider } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { if (profile) fetchTickets() }, [profile])

  async function fetchTickets() {
    const { data } = await supabase
      .from('support_tickets')
      .select('*, orders(order_code, products(name))')
      .eq('distributor_id', profile.id)
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  async function deleteTicket(ticketId) {
    setDeletingId(ticketId)
    await supabase.from('support_tickets').delete().eq('id', ticketId)
    setTickets(prev => prev.filter(t => t.id !== ticketId))
    setDeletingId(null)
  }

  if (loading) return <PageLoader />

  const providerPhone = provider?.whatsapp_support?.replace(/\D/g, '')
  const distName = profile?.full_name || profile?.email?.split('@')[0] || 'Distribuidor'
  const STATUS = { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto' }
  const openCount = tickets.filter(t => t.status !== 'resuelto').length

  return (
    <div>
      <PageHeader
        title="Soporte"
        subtitle={openCount ? `${openCount} ticket${openCount !== 1 ? 's' : ''} en curso` : 'Tus tickets y las respuestas de tu proveedor'}
        action={providerPhone && (
          <a className="btn-secondary" target="_blank" rel="noreferrer" href={waLink(providerPhone)}><IconWhatsApp size={15} />Escribir al proveedor</a>
        )}
      />

      {tickets.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={IconHeadphones}
            title="Sin tickets por ahora"
            description="Si una cuenta falla, ábrelo desde Mis pedidos con el botón de soporte. Tu proveedor recibe el aviso al instante."
            action={<Link to="/dashboard" className="btn-primary">Ir a mis pedidos</Link>}
          />
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {tickets.map(t => {
            const waMsg =
              `Hola! Soy *${distName}*\n\n` +
              `Te escribo por mi ticket *#${t.ticket_code}* - *${getReasonLabel(t.reason)}*\n` +
              `Pedido: #${t.orders?.order_code} - ${t.orders?.products?.name}\n` +
              (t.description ? `\nDetalle: ${t.description}` : '') +
              `\n\nPodrias ayudarme?`
            return (
              <article key={t.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge color={getTicketStatusColor(t.status)} dot>{STATUS[t.status] || t.status}</Badge>
                      <span className="font-mono text-[11px] text-[var(--ink-faint)]">#{t.ticket_code}</span>
                      <span className="text-[11px] text-[var(--ink-faint)]">· {formatDateTime(t.created_at)}</span>
                    </div>
                    <h3 className="font-display font-semibold text-[15px] text-[var(--ink)]">{getReasonLabel(t.reason)}</h3>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">Pedido <span className="font-mono">#{t.orders?.order_code}</span> · {t.orders?.products?.name}</p>
                    {t.description && <p className="text-[13px] text-[var(--ink-muted)] mt-2 leading-relaxed">{t.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    {t.status !== 'resuelto' && providerPhone && (
                      <a href={waLink(providerPhone, waMsg)} target="_blank" rel="noreferrer" className="btn-accent btn-sm">
                        <IconWhatsApp size={14} />Avisar
                      </a>
                    )}
                    {t.status === 'resuelto' && (
                      <button onClick={() => deleteTicket(t.id)} disabled={deletingId === t.id} className="btn-secondary btn-sm btn-icon hover:!text-[var(--status-red)]" aria-label="Eliminar ticket" title="Eliminar ticket">
                        {deletingId === t.id ? <Spinner size={13} /> : <IconTrash size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {t.provider_response && (
                  <div className="mt-4 rounded-xl p-3.5 bg-[var(--surface-side)] border border-[var(--surface-border)] relative">
                    <p className="eyebrow mb-1.5 flex items-center gap-1.5"><span className="dot" style={{ color: 'var(--a)' }} />Respuesta de tu proveedor</p>
                    <p className="text-[13.5px] text-[var(--ink)] leading-relaxed">{t.provider_response}</p>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
