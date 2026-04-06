import { useState } from 'react'
import { formatDate, formatUSD, getLogoPath } from '@/utils'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import { Modal, CopyField } from '@/components/ui'
import {
  IconWhatsApp, IconHeadphones, IconSend, IconClock,
  IconMail, IconKey, IconLink, IconHash, IconUser, IconRefreshCw, IconChevronDown, IconAlertCircle
} from '@/assets/icons'
import SupportForm from './SupportForm'

function getPlatformColor(name = '') {
  const n = name.toLowerCase()
  if (n.includes('netflix')) return '#e50914'
  if (n.includes('disney')) return '#006e99'
  if (n.includes('hbo') || n.includes('max')) return '#5822b4'
  if (n.includes('amazon') || n.includes('prime')) return '#ff9900'
  if (n.includes('spotify')) return '#1db954'
  if (n.includes('youtube')) return '#ff0000'
  if (n.includes('crunchyroll')) return '#f47521'
  if (n.includes('apple')) return '#555555'
  if (n.includes('paramount')) return '#0064ff'
  if (n.includes('directv')) return '#00a8e0'
  if (n.includes('movistar')) return '#019df4'
  if (n.includes('deezer')) return '#a238ff'
  return 'var(--ink-faint)'
}

function daysRemaining(expiresAt) {
  const now = new Date()
  const exp = new Date(expiresAt)
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
}

function getDaysPillStyle(days) {
  if (days <= 5) return { background: 'var(--status-red-bg)', color: 'var(--status-red)', border: '1px solid var(--status-red)' }
  if (days <= 10) return { background: 'var(--status-yellow-bg)', color: 'var(--status-yellow)', border: '1px solid var(--status-yellow)' }
  return { background: 'var(--status-green-bg)', color: 'var(--status-green)', border: '1px solid var(--status-green)' }
}

const STATUS_CONFIG = {
  activo: { label: 'Activo', color: 'var(--status-green)', bg: 'var(--status-green-bg)', border: 'var(--status-green-border)' },
  pendiente_credenciales: { label: 'Pendiente', color: 'var(--status-yellow)', bg: 'var(--status-yellow-bg)', border: 'var(--status-yellow-border)' },
  expirado: { label: 'Expirado', color: 'var(--ink-faint)', bg: 'var(--surface-overlay)', border: 'var(--surface-border)' },
  cancelado: { label: 'Cancelado', color: 'var(--status-red)', bg: 'var(--status-red-bg)', border: 'var(--status-red-border)' },
}

export default function OrderCard({ order, template, onCredentialsUpdated }) {
  const [expanded, setExpanded] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [renewDismissed, setRenewDismissed] = useState(false)

  const item = order.stock_items
  const product = order.products
  const platform = product?.platforms
  const hasCreds = !!(item?.email || item?.url || item?.activation_code)
  const days = order.expires_at ? daysRemaining(order.expires_at) : null
  const pillStyle = days !== null ? getDaysPillStyle(days) : null
  const accentColor = getPlatformColor(platform?.name || '')
  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.expirado

  // Mostrar banner de renovación si activo y quedan ≤7 días, o ya venció
  const showRenewalBanner = !renewDismissed && order.status === 'activo' && days !== null && days <= 7

  // Mostrar botón renovar: siempre en activo, también en expirado
  const showRenewBtn = order.status === 'activo' || order.status === 'expirado'

  function handleSendCreds() {
    if (!order.client_whatsapp) return
    const url = buildWhatsAppUrl(order.client_whatsapp, template || '', {
      clientName: order.client_name,
      platformName: platform?.name,
      email: item?.email,
      password: item?.password,
      profileName: item?.profile_name,
      profilePin: item?.profile_pin,
      url: item?.url,
      activationCode: item?.activation_code,
      durationDays: product?.duration_days,
      expiresAt: order.expires_at,
      orderCode: order.order_code,
    })
    window.open(url, '_blank')
  }

  function handleNotifyProvider() {
    const provWA = product?.providers?.whatsapp_support
    const phone = provWA ? provWA.replace(/\D/g, '') : ''
    const msg = `Hola! Realicé el pedido *${order.order_code}* de *${product?.name}*. Por favor confirma cuando las credenciales estén listas. Gracias!`
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  function handleRenewWhatsApp() {
    const provWA = product?.providers?.whatsapp_support
    const phone = provWA ? provWA.replace(/\D/g, '') : ''
    const daysText = days !== null && days <= 0 ? 'ya venció' : days !== null ? `vence en ${days} día${days === 1 ? '' : 's'}` : 'está por vencer'
    const msg = `Hola! Mi pedido *${order.order_code}* de *${product?.name}* ${daysText}. ¿Me puedes ayudar con la renovación? Gracias!`
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // Botón de acción circular reutilizable
  const ActionBtn = ({ onClick, title, bg, color, border, children }) => (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: bg || 'var(--surface-overlay)',
        border: border || '1px solid var(--surface-border)',
        color: color || 'var(--ink-faint)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )

  return (
    <>
      <div style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--surface-border)',
        borderLeft: `3px solid ${sc.color}`,
        borderRadius: '0 12px 12px 0',
        overflow: 'hidden',
      }}>

        {/* ── RENEWAL BANNER ── */}
        {showRenewalBanner && (
          <div style={{
            background: days <= 0 ? 'var(--status-red-bg)' : 'var(--status-yellow-bg)',
            borderBottom: `1px solid ${days <= 0 ? 'var(--status-red)' : 'var(--status-yellow)'}`,
            padding: '7px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <IconAlertCircle size={13} style={{ color: days <= 0 ? 'var(--status-red)' : 'var(--status-yellow)', flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: 12, fontWeight: 500, color: days <= 0 ? 'var(--status-red)' : 'var(--status-yellow)' }}>
              {days <= 0 ? 'Venció. ¿Deseas renovarlo?' : `Vence en ${days}d. ¿Confirmas renovación?`}
            </p>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={e => { e.stopPropagation(); handleRenewWhatsApp() }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 7, background: '#25d366', border: 'none', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                <IconWhatsApp size={11} /> Renovar
              </button>
              <button
                onClick={e => { e.stopPropagation(); setRenewDismissed(true) }}
                style={{ padding: '3px 10px', borderRadius: 7, background: 'transparent', border: `1px solid ${days <= 0 ? 'var(--status-red)' : 'var(--status-yellow)'}`, color: days <= 0 ? 'var(--status-red)' : 'var(--status-yellow)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* ── COMPACT ROW ── */}
        <div
          onClick={() => hasCreds && setExpanded(e => !e)}
          style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: hasCreds ? 'pointer' : 'default' }}
        >
          {/* Logo */}
          <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: `${accentColor}15`, border: `1px solid ${accentColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {platform?.logo_filename
              ? <img src={getLogoPath(platform.logo_filename)} alt={platform.name} style={{ width: 26, height: 26, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
              : <span style={{ fontSize: 12, fontWeight: 800, color: accentColor }}>{platform?.name?.[0]}</span>
            }
          </div>

          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {product?.name}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                {sc.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--ink-faint)' }}>#{order.order_code}</span>
              {order.client_name && (
                <span style={{ fontSize: 11, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IconUser size={10} />{order.client_name}
                </span>
              )}
              {days !== null && order.status === 'activo' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600, ...pillStyle }}>
                  <IconClock size={9} />{days <= 0 ? 'Vencido' : `${days}d`}
                </span>
              )}
            </div>
          </div>

          {/* Right: price + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ textAlign: 'right', marginRight: 2 }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{formatUSD(order.price_paid)}</p>
              <p style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{formatDate(order.created_at)}</p>
            </div>

            {/* WhatsApp enviar credenciales */}
            {hasCreds && order.client_whatsapp && (
              <ActionBtn onClick={handleSendCreds} title="Enviar credenciales" bg="#25d366" color="white" border="none">
                <IconWhatsApp size={14} />
              </ActionBtn>
            )}

            {/* Notificar proveedor (pendiente) */}
            {!hasCreds && order.status === 'pendiente_credenciales' && (
              <ActionBtn onClick={handleNotifyProvider} title="Notificar proveedor">
                <IconSend size={13} />
              </ActionBtn>
            )}

            {/* Renovar — activo o expirado */}
            {showRenewBtn && (
              <ActionBtn
                onClick={handleRenewWhatsApp}
                title={order.status === 'expirado' ? 'Contactar proveedor para renovar' : 'Solicitar renovación'}
                bg="var(--status-green-bg)"
                color="var(--status-green)"
                border="1px solid var(--status-green)"
              >
                <IconRefreshCw size={13} />
              </ActionBtn>
            )}

            {/* Soporte */}
            <ActionBtn onClick={() => setShowSupport(true)} title="Soporte">
              <IconHeadphones size={13} />
            </ActionBtn>

            {/* Expandir credenciales */}
            {hasCreds && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
                title="Ver credenciales"
              >
                <IconChevronDown size={15} />
              </button>
            )}
          </div>
        </div>

        {/* ── EXPANDED CREDENTIALS ── */}
        {expanded && hasCreds && (
          <div style={{ borderTop: '1px solid var(--surface-border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item?.email && <CopyField value={item.email} icon={IconMail} label="Correo" />}
            {item?.password && <CopyField value={item.password} icon={IconKey} label="Contraseña" hidden />}
            {item?.url && <CopyField value={item.url} icon={IconLink} label="URL" />}
            {item?.profile_name && <CopyField value={item.profile_name} icon={IconUser} label="Perfil" />}
            {item?.profile_pin && <CopyField value={item.profile_pin} icon={IconHash} label="PIN" hidden />}
            {item?.activation_code && <CopyField value={item.activation_code} icon={IconHash} label="Código" />}
            {item?.extra_notes && (
              <div style={{ background: 'var(--surface-overlay)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5 }}>{item.extra_notes}</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {order.client_whatsapp && (
                <button onClick={handleSendCreds} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 10, background: '#25d366', border: 'none', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  <IconWhatsApp size={13} />Enviar credenciales
                </button>
              )}
              <button onClick={handleSendCreds} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', color: 'var(--ink-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} title="Reenviar">
                <IconRefreshCw size={13} />
              </button>
            </div>
          </div>
        )}

        {!hasCreds && order.status === 'pendiente_credenciales' && (
          <div style={{ borderTop: '1px solid var(--surface-border)', padding: '8px 14px' }}>
            <p style={{ fontSize: 12, color: 'var(--status-yellow)' }}>Esperando credenciales del proveedor.</p>
          </div>
        )}
      </div>

      {/* Support modal */}
      {showSupport && (
        <Modal open={true} onClose={() => setShowSupport(false)} title="Abrir ticket de soporte">
          <SupportForm order={order} onClose={() => setShowSupport(false)} />
        </Modal>
      )}
    </>
  )
}