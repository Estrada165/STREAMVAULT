import { useState } from 'react'
import { formatDate, formatUSD } from '@/utils'
import { PlatformLogo } from '@/utils/platform'
import { buildWhatsAppUrl, waLink } from '@/lib/whatsapp'
import { clientReminder, providerRenewal, markReminded } from '@/lib/reminders'
import { Modal, CopyField, Alert, Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import PhoneInput from './PhoneInput'
import {
  IconWhatsApp, IconHeadphones, IconSend, IconClock,
  IconMail, IconKey, IconLink, IconHash, IconUser, IconRefreshCw, IconChevronDown, IconAlertCircle, IconEdit
} from '@/assets/icons'
import SupportForm from './SupportForm'

function daysRemaining(expiresAt) {
  const now = new Date()
  const exp = new Date(expiresAt)
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
}

const STATUS_CONFIG = {
  activo: { label: 'Activo', badge: 'green' },
  pendiente_credenciales: { label: 'Pendiente', badge: 'violet' },
  expirado: { label: 'Expirado', badge: 'neutral' },
  cancelado: { label: 'Cancelado', badge: 'red' },
}

export default function OrderCard({ order, template, exchangeRate = 3.5, onCredentialsUpdated }) {
  const [expanded, setExpanded] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [renewDismissed, setRenewDismissed] = useState(false)
  const [showEditClient, setShowEditClient] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const item = order.stock_items
  const product = order.products
  const platform = product?.platforms
  const hasCreds = !!(item?.email || item?.url || item?.activation_code)
  const days = order.expires_at ? daysRemaining(order.expires_at) : null
  const daysTone = days === null ? null : days <= 5 ? 'red' : days <= 10 ? 'yellow' : 'green'
  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.expirado
  const showRenewalBanner = !renewDismissed && order.status === 'activo' && days !== null && days <= 7
  const showRenewBtn = order.status === 'activo' || order.status === 'expirado'
  // Mostrar botón de aviso al cliente cuando vence en ≤7 días y hay número
  const showNotifyClient = order.status === 'activo' && days !== null && days <= 7 && !!order.client_whatsapp

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
    const msg = `👋 ¡Hola! Realicé el pedido *${order.order_code}* de *${product?.name}*.\n\n¿Me avisas cuando las credenciales estén listas? ¡Gracias! 🙌`
    const url = phone ? waLink(phone, msg) : waLink('', msg)
    window.open(url, '_blank')
  }

  function handleRenewWhatsApp() {
    const phone = product?.providers?.whatsapp_support || ''
    window.open(waLink(phone, providerRenewal({
      orderCode: order.order_code, productName: product?.name, email: item?.email,
      expiresAt: order.expires_at, costUsd: product?.renewal_price_usd || order.price_paid, exchangeRate,
    })), '_blank')
  }

  // Avisar al cliente final que su cuenta vence pronto (sin precios, credenciales ni códigos internos)
  function handleNotifyClient() {
    if (!order.client_whatsapp) return
    window.open(waLink(order.client_whatsapp, clientReminder({
      clientName: order.client_name, platformName: platform?.name || product?.name, expiresAt: order.expires_at,
    })), '_blank')
    markReminded(order.id)
  }

  function openEditClient() {
    setClientName(order.client_name || '')
    setClientPhone(order.client_whatsapp || '')
    setEditError('')
    setShowEditClient(true)
  }

  async function saveClientInfo() {
    setEditSaving(true); setEditError('')
    try {
      const { error } = await supabase
        .from('orders')
        .update({ client_name: clientName.trim() || null, client_whatsapp: clientPhone.trim() || null })
        .eq('id', order.id)
      if (error) throw error
      onCredentialsUpdated?.()
      setShowEditClient(false)
    } catch (e) { setEditError(e.message) }
    setEditSaving(false)
  }


  const IconKey_ = ({ onClick, title, tone = '', children }) => (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      aria-label={title}
      className={`btn-secondary btn-sm btn-icon ${tone}`}
    >
      {children}
    </button>
  )

  const credFields = item ? [
    { key: 'email', label: 'Correo', icon: IconMail },
    { key: 'password', label: 'Contraseña', icon: IconKey, hidden: true },
    { key: 'url', label: 'URL', icon: IconLink },
    { key: 'profile_name', label: 'Perfil', icon: IconUser },
    { key: 'profile_pin', label: 'PIN', icon: IconHash, hidden: true },
    { key: 'activation_code', label: 'Código', icon: IconHash },
  ].filter(f => item[f.key]) : []

  return (
    <>
      <article className={`card overflow-hidden ${order.status === 'expirado' ? 'opacity-80' : ''}`}>

        {showRenewalBanner && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b text-[12.5px] font-medium ${days <= 0 ? 'bg-[var(--status-red-bg)] border-[var(--status-red-border)] text-[var(--status-red)]' : 'bg-[var(--status-yellow-bg)] border-[var(--status-yellow-border)] text-[var(--status-yellow)]'}`}>
            <IconAlertCircle size={14} className="flex-shrink-0" />
            <p className="flex-1 min-w-[150px]">{days <= 0 ? 'Venció. ¿Lo renuevas?' : `Vence en ${days} día${days === 1 ? '' : 's'}. ¿Confirmas la renovación?`}</p>
            <div className="flex gap-2">
              <button onClick={e => { e.stopPropagation(); handleRenewWhatsApp() }} className="btn-primary btn-sm"><IconWhatsApp size={13} />Renovar</button>
              <button onClick={e => { e.stopPropagation(); setRenewDismissed(true) }} className="btn-ghost btn-sm !text-current">Descartar</button>
            </div>
          </div>
        )}

        <div
          onClick={() => hasCreds && setExpanded(e => !e)}
          className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${hasCreds ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <PlatformLogo name={platform?.name} filename={platform?.logo_filename} size={42} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-semibold text-[15px] text-[var(--ink)] truncate max-w-full">{product?.name}</h3>
                <span className={`badge badge-${sc.badge}`}>{sc.badge === 'green' && <span className="dot dot-glow" />}{sc.label}</span>
              </div>
              <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap text-xs text-[var(--ink-muted)]">
                <span className="font-mono text-[11px] text-[var(--ink-faint)]">{order.order_code}</span>
                {order.client_name && <span className="inline-flex items-center gap-1"><IconUser size={11} />{order.client_name}</span>}
                {days !== null && order.status === 'activo' && (
                  <span className={`days-pill ${daysTone}`}><IconClock size={10} />{days <= 0 ? 'Vencido' : `${days}d`}</span>
                )}
              </div>
            </div>
            <div className="text-right sm:hidden flex-shrink-0">
              <p className="font-mono text-[15px] text-[var(--ink)]">{formatUSD(order.price_paid)}</p>
              <p className="text-[11px] text-[var(--ink-faint)]">{formatDate(order.created_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="text-right mr-1 hidden sm:block">
              <p className="font-mono text-[15px] text-[var(--ink)]">{formatUSD(order.price_paid)}</p>
              <p className="text-[11px] text-[var(--ink-faint)]">{formatDate(order.created_at)}</p>
            </div>
            {hasCreds && order.client_whatsapp && (
              <button onClick={e => { e.stopPropagation(); handleSendCreds() }} className="btn-accent btn-sm flex-1 sm:flex-none" title="Enviar credenciales al cliente">
                <IconWhatsApp size={14} />Enviar
              </button>
            )}
            {!hasCreds && order.status === 'pendiente_credenciales' && (
              <button onClick={e => { e.stopPropagation(); handleNotifyProvider() }} className="btn-secondary btn-sm btn-violet flex-1 sm:flex-none">
                <IconSend size={13} />Avisar proveedor
              </button>
            )}
            {showNotifyClient && (
              <IconKey_ onClick={handleNotifyClient} title="Avisar vencimiento al cliente" tone="!text-[var(--status-yellow)]"><IconClock size={14} /></IconKey_>
            )}
            {showRenewBtn && (
              <IconKey_ onClick={handleRenewWhatsApp} title="Pedir renovación al proveedor" tone="!text-[var(--a)]"><IconRefreshCw size={14} /></IconKey_>
            )}
            <IconKey_ onClick={openEditClient} title="Editar datos del cliente"><IconEdit size={14} /></IconKey_>
            <IconKey_ onClick={() => setShowSupport(true)} title="Soporte"><IconHeadphones size={14} /></IconKey_>
            {hasCreds && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                aria-expanded={expanded}
                aria-label={expanded ? 'Ocultar credenciales' : 'Ver credenciales'}
                className="btn-ghost btn-sm !px-2"
              >
                <IconChevronDown size={16} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {expanded && hasCreds && (
          <div className="border-t border-[var(--surface-border)] bg-[var(--surface-side)] p-4 animate-fade-in">
            <div className="grid gap-3 sm:grid-cols-2">
              {credFields.map(f => (
                <CopyField key={f.key} value={item[f.key]} icon={f.icon} label={f.label} hidden={f.hidden} />
              ))}
            </div>
            {item?.extra_notes && (
              <p className="inset mt-3 px-3 py-2.5 text-[13px] text-[var(--ink-muted)] leading-relaxed whitespace-pre-wrap">{item.extra_notes}</p>
            )}
            {order.client_whatsapp && (
              <button onClick={handleSendCreds} className="btn-accent w-full mt-3"><IconWhatsApp size={15} />Enviar credenciales por WhatsApp</button>
            )}
          </div>
        )}

        {!hasCreds && order.status === 'pendiente_credenciales' && (
          <div className="border-t border-[var(--surface-border)] px-4 py-2.5 flex items-center gap-2 text-[12.5px] text-[var(--b)]">
            <span className="dot animate-pulse-soft" />Esperando que tu proveedor cargue las credenciales.
          </div>
        )}
      </article>

      <Modal
        open={showEditClient}
        onClose={() => setShowEditClient(false)}
        title="Datos del cliente"
        subtitle="El próximo envío de credenciales usará estos datos."
        maxWidth="max-w-sm"
        footer={<>
          <button onClick={() => setShowEditClient(false)} className="btn-ghost">Cancelar</button>
          <button onClick={saveClientInfo} disabled={editSaving} className="btn-primary">{editSaving ? <Spinner size={15} /> : 'Guardar'}</button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del cliente</label>
            <input className="input" placeholder="María Pérez" value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>
          <PhoneInput label="WhatsApp del cliente" value={clientPhone} onChange={setClientPhone} />
          {editError && <Alert type="error">{editError}</Alert>}
        </div>
      </Modal>

      {showSupport && (
        <Modal open onClose={() => setShowSupport(false)} title="Abrir ticket de soporte" subtitle={`${product?.name} · ${order.order_code}`}>
          <SupportForm order={order} onClose={() => setShowSupport(false)} />
        </Modal>
      )}
    </>
  )
}
