import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, EmptyState, Spinner, Badge } from '@/components/ui'
import { IconHeadphones, IconTrash, IconWhatsApp } from '@/assets/icons'
import { formatDateTime, getReasonLabel, getTicketStatusColor } from '@/utils'

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

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <Spinner size={32} />
    </div>
  )

  // Número WA del proveedor para notificar seguimiento
  const providerPhone = provider?.whatsapp_support?.replace(/\D/g, '')
  const distName = profile?.full_name || profile?.email?.split('@')[0] || 'Distribuidor'

  return (
    <div>
      <PageHeader title="Soporte" subtitle="Historial de tus tickets enviados" />

      {tickets.length === 0 ? (
        <EmptyState
          icon={IconHeadphones}
          title="Sin tickets"
          description="No has abierto ningún ticket de soporte. Puedes hacerlo desde tus pedidos activos."
        />
      ) : (
        <div className="space-y-3 stagger">
          {tickets.map(t => {
            // Mensaje WA al proveedor cuando el ticket ya fue resuelto
            const waResolvedMsg =
              `Hola! Soy *${distName}*\n\n` +
              `Queria confirmar que recibi la solucion de mi ticket *#${t.ticket_code}*.\n` +
              `Pedido: #${t.orders?.order_code} - ${t.orders?.products?.name}\n` +
              (t.provider_response ? `\nRespuesta recibida: "${t.provider_response}"` : '') +
              `\n\nGracias por la atencion!`

            return (
              <div key={t.id} className="card p-4">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                      background: t.status === 'abierto' ? 'var(--status-red)'
                        : t.status === 'en_revision' ? 'var(--status-yellow)'
                        : 'var(--status-green)',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--ink-faint)' }}>
                          #{t.ticket_code}
                        </span>
                        <Badge color={getTicketStatusColor(t.status)}>
                          {t.status === 'abierto' ? 'Abierto' : t.status === 'en_revision' ? 'En revisión' : 'Resuelto'}
                        </Badge>
                      </div>
                      <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>
                        {getReasonLabel(t.reason)}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        Pedido #{t.orders?.order_code} · {t.orders?.products?.name}
                      </p>
                      {t.description && (
                        <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>{t.description}</p>
                      )}
                      <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6 }}>
                        {formatDateTime(t.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Botones derecha */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {/* WA en tickets NO resueltos — para contactar al proveedor */}
                    {t.status !== 'resuelto' && providerPhone && (
                      <a href={`https://wa.me/${providerPhone}?text=${encodeURIComponent(
                        `Hola! Soy *${distName}*\n\n` +
                        `Te escribo por mi ticket *#${t.ticket_code}* - *${getReasonLabel(t.reason)}*\n` +
                        `Pedido: #${t.orders?.order_code} - ${t.orders?.products?.name}\n` +
                        (t.description ? `\nDetalle: ${t.description}` : '') +
                        `\n\nPodrias ayudarme?`
                      )}`}
                        target="_blank" rel="noreferrer"
                        style={{
                          fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5,
                          borderRadius: 8, background: '#25d366', color: '#fff', fontWeight: 600,
                          fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', whiteSpace: 'nowrap',
                        }}>
                        <IconWhatsApp size={13} />Notificar
                      </a>
                    )}
                    {/* Eliminar solo cuando está resuelto */}
                    {t.status === 'resuelto' && (
                      <button
                        onClick={() => deleteTicket(t.id)}
                        disabled={deletingId === t.id}
                        title="Eliminar ticket"
                        style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: 'var(--surface-overlay)',
                          border: '1px solid var(--surface-border)',
                          color: 'var(--ink-faint)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: deletingId === t.id ? 0.5 : 1,
                          transition: 'color 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--status-red)'; e.currentTarget.style.borderColor = 'var(--status-red)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-faint)'; e.currentTarget.style.borderColor = 'var(--surface-border)' }}
                      >
                        {deletingId === t.id ? <Spinner size={13} /> : <IconTrash size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Respuesta del proveedor */}
                {t.provider_response && (
                  <div style={{ marginTop: 12, marginLeft: 18, background: 'var(--surface-overlay)', borderRadius: 10, padding: '8px 12px' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-faint)', marginBottom: 4 }}>
                      Respuesta del proveedor
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{t.provider_response}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}