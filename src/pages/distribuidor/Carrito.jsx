import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, EmptyState } from '@/components/ui'
import { PlatformLogo } from '@/utils/platform'
import { IconShoppingCart, IconTrash, IconCheck, IconPlus, IconX } from '@/assets/icons'
import { formatUSD, formatPEN } from '@/utils'
import PhoneInput from '@/components/shared/PhoneInput'

function CartItemThumb({ item }) {
  const [imgErr, setImgErr] = useState(false)
  if (item.image_url && !imgErr) {
    return <img src={item.image_url} alt="" className="w-12 h-12 rounded-xl object-contain p-0.5 bg-[var(--surface-overlay)] flex-shrink-0 border border-[var(--surface-border)]" onError={() => setImgErr(true)} />
  }
  return <PlatformLogo name={item.platforms?.name || item.custom_platform_name || item.name} filename={item.platforms?.logo_filename} size={48} />
}

export default function Carrito() {
  const { items, grouped, updateQuantity, clearCart, total, count } = useCart()
  const { balance, refetch: refetchBalance } = useBalance()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [modal, setModal] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [createdCount, setCreatedCount] = useState(0)

  const insufficient = balance < total
  const rate = parseFloat(settings?.exchange_rate) || 3.5

  async function checkout() {
    if (!clientName.trim()) return setError('El nombre del cliente es requerido')
    if (!clientPhone.trim()) return setError('El numero de WhatsApp es requerido')
    if (insufficient) return setError('Saldo insuficiente')

    setLoading(true)
    setError('')

    try {
      // Compra atómica en la base de datos: precio real, stock bloqueado y saldo
      // descontado en una sola transacción (si algo falla, no se cobra nada).
      const payload = grouped.map(g => ({ product_id: g.id, quantity: g.quantity }))
      const { data, error: rpcErr } = await supabase.rpc('checkout', {
        p_items: payload,
        p_client_name: clientName.trim(),
        p_client_whatsapp: clientPhone.trim(),
      })
      if (rpcErr) throw rpcErr

      setCreatedCount(data?.orders?.length || count)
      clearCart()
      refetchBalance()
      setSuccess(true)
    } catch (e) { setError(e.message) }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card card-sig p-8 sm:p-10 max-w-sm w-full text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)] animate-pop">
            <IconCheck size={30} />
          </div>
          <h2 className="font-display text-2xl text-[var(--ink)] mb-2">Compra <span className="ser grad">lista</span></h2>
          <p className="text-sm text-[var(--ink-muted)] mb-6">
            {createdCount > 1 ? `${createdCount} pedidos creados.` : 'Tu pedido está listo.'} Encuentra las credenciales en "Mis pedidos".
          </p>
          <div className="flex flex-col gap-2.5">
            <button onClick={() => navigate('/dashboard')} className="btn-primary w-full">Ver mis pedidos</button>
            <button onClick={() => navigate('/tienda')} className="btn-ghost w-full justify-center">Seguir comprando</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={grouped.length ? 'pb-28 lg:pb-0' : ''}>
      <PageHeader title="Tu" accent="carrito" subtitle={count ? `${count} producto${count !== 1 ? 's' : ''} · cada unidad es un pedido` : 'Todavía no agregas productos'} />

      {grouped.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={IconShoppingCart}
            title="Tu carrito está vacío"
            description="Agrega productos desde la tienda y aparecerán aquí."
            action={<button onClick={() => navigate('/tienda')} className="btn-primary">Ir a la tienda</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Productos */}
          <div className="lg:col-span-2 space-y-3 stagger">
            {grouped.map(item => (
              <div key={item.id} className="card p-4 flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3">
                <CartItemThumb item={item} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] text-[var(--ink)] truncate">{item.name}</p>
                  <p className="text-xs text-[var(--ink-muted)] mt-0.5">{item.platforms?.name} · {item.duration_days} días</p>
                  <p className="text-xs text-[var(--ink-faint)] mt-0.5 font-mono">{formatUSD(item.price_usd)} c/u</p>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <div className="inset flex items-center gap-1 p-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="btn-secondary btn-sm btn-icon" aria-label="Quitar uno">−</button>
                    <span className="font-mono text-[15px] text-[var(--ink)] min-w-[28px] text-center" aria-live="polite">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="btn-secondary btn-sm btn-icon" aria-label="Agregar uno"><IconPlus size={14} /></button>
                  </div>
                  <div className="text-right min-w-[78px]">
                    <p className="font-mono text-[15px] text-[var(--ink)]">{formatUSD(item.subtotal)}</p>
                    <p className="text-[11px] text-[var(--ink-faint)]">≈ {formatPEN(item.subtotal * rate)}</p>
                  </div>
                  <button
                    onClick={() => { for (let i = 0; i < item.quantity; i++) updateQuantity(item.id, -1) }}
                    className="btn-ghost p-2 hover:!text-[var(--status-red)]"
                    aria-label={`Quitar ${item.name}`}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => navigate('/tienda')} className="btn-ghost"><IconPlus size={15} />Agregar más productos</button>
          </div>

          {/* Resumen */}
          <aside className="card p-5 space-y-4 lg:sticky lg:top-6">
            <h2 className="font-display font-semibold text-lg">Resumen</h2>
            <div className="space-y-2">
              {grouped.map(item => (
                <div key={item.id} className="flex justify-between gap-3 text-[13px] text-[var(--ink-muted)]">
                  <span className="truncate">{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}</span>
                  <span className="font-mono flex-shrink-0">{formatUSD(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="divider !my-0" />
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow">Total</p>
                <p className="text-xs text-[var(--ink-faint)] mt-1">≈ {formatPEN(total * rate)}</p>
              </div>
              <p className="font-mono text-[1.75rem] leading-none text-[var(--ink)]">{formatUSD(total)}</p>
            </div>

            <div className={`rounded-xl px-3.5 py-3 border ${insufficient ? 'bg-[var(--status-red-bg)] border-[var(--status-red-border)]' : 'bg-[var(--a-soft)] border-[var(--a-line)]'}`}>
              <div className="flex justify-between text-sm">
                <span className={insufficient ? 'text-[var(--status-red)]' : 'text-[var(--ink-muted)]'}>Tu saldo</span>
                <span className={`font-mono ${insufficient ? 'text-[var(--status-red)]' : 'text-[var(--a)]'}`}>{formatUSD(balance)}</span>
              </div>
              {insufficient
                ? <p className="text-xs text-[var(--status-red)] mt-1.5">Te faltan {formatUSD(total - balance)}. <button className="underline font-semibold" onClick={() => navigate('/tienda?recargar=1')}>Recargar</button></p>
                : <p className="text-xs text-[var(--ink-muted)] mt-1.5">Después de comprar te quedan <span className="font-mono">{formatUSD(balance - total)}</span></p>}
            </div>

            <button onClick={() => { setModal(true); setError('') }} disabled={insufficient || grouped.length === 0} className="btn-primary btn-lg w-full hidden lg:inline-flex">
              Confirmar compra · {formatUSD(total)}
            </button>
          </aside>
        </div>
      )}

      {/* Botón fijo en móvil */}
      {grouped.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 lg:hidden bg-gradient-to-t from-[var(--surface)] via-[var(--surface)] to-transparent" style={{ paddingBottom: 'calc(.75rem + env(safe-area-inset-bottom))' }}>
          <button onClick={() => { setModal(true); setError('') }} disabled={insufficient} className="btn-primary w-full !h-14 !rounded-2xl !justify-between !px-5">
            <span>{insufficient ? 'Saldo insuficiente' : 'Confirmar compra'}</span>
            <span className="font-mono">{formatUSD(total)}</span>
          </button>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="¿Para quién es?"
        subtitle="Estos datos se usan en todos los pedidos de esta compra."
        footer={<>
          <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
          <button onClick={checkout} disabled={loading} className="btn-primary min-w-[140px]">
            {loading ? <Spinner size={16} /> : `Pagar ${formatUSD(total)}`}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del cliente</label>
            <input className="input" placeholder="María Pérez" value={clientName} onChange={e => setClientName(e.target.value)} autoFocus />
          </div>
          <PhoneInput label="WhatsApp del cliente" value={clientPhone} onChange={setClientPhone} />
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
