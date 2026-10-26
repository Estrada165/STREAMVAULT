import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner } from '@/components/ui'
import { IconShoppingCart, IconTrash, IconCheck, IconPlus, IconX } from '@/assets/icons'
import { formatUSD, formatPEN, getLogoPath } from '@/utils'
import PhoneInput from '@/components/shared/PhoneInput'

function CartItemThumb({ item }) {
  const [imgErr, setImgErr] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const logoPath = getLogoPath(item.platforms?.logo_filename)
  const imageUrl = item.image_url || null

  if (imageUrl && !imgErr) {
    return (
      <div style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--surface-border)' }}>
        <img src={imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
      </div>
    )
  }
  return (
    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {logoPath && !logoErr
        ? <img src={logoPath} alt={item.platforms?.name} style={{ width: 36, height: 36, objectFit: 'contain' }} onError={() => setLogoErr(true)} />
        : <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-muted)' }}>{(item.platforms?.name || item.name || '?')[0]}</span>
      }
    </div>
  )
}

export default function Carrito() {
  const { items, grouped, updateQuantity, clearCart, total, count } = useCart()
  const { profile } = useAuth()
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
        <div className="card p-10 max-w-sm w-full text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-[var(--status-green-bg)] flex items-center justify-center mx-auto mb-5">
            <IconCheck size={32} className="text-[var(--status-green)]" />
          </div>
          <h2 className="font-display font-bold text-xl text-[var(--ink)] mb-2">Compra exitosa</h2>
          <p className="text-sm text-[var(--ink-muted)] mb-6">
            {createdCount > 1 ? `${createdCount} pedidos creados.` : 'Tu pedido esta listo.'} Revisa tu panel para ver las credenciales.
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary w-full justify-center">Ver mis pedidos</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Carrito" subtitle={`${count} producto${count !== 1 ? 's' : ''}`} />

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-overlay)] flex items-center justify-center mb-4 text-[var(--ink-faint)]">
            <IconShoppingCart size={30} />
          </div>
          <h3 className="font-display font-semibold text-[var(--ink)] mb-1">Tu carrito esta vacio</h3>
          <p className="text-sm text-[var(--ink-muted)] mb-5">Agrega productos desde la tienda</p>
          <button onClick={() => navigate('/tienda')} className="btn-primary">Ir a la tienda</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ITEMS AGRUPADOS */}
          <div className="lg:col-span-2 space-y-3">
            {grouped.map(item => (
              <div key={item.id} className="card p-4 flex items-center gap-4">
                <CartItemThumb item={item} />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {item.platforms?.name} · {item.duration_days} dias
                  </p>
                  {item.quantity > 1 && (
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">
                      {item.quantity} x {formatUSD(item.price_usd)} c/u
                    </p>
                  )}
                </div>

                {/* Selector de cantidad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-overlay)', borderRadius: 10, padding: '4px 6px', border: '1px solid var(--surface-border)' }}>
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'var(--surface-raised)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)', fontWeight: 700, fontSize: 16 }}>
                    −
                  </button>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: 14, color: 'var(--ink)', minWidth: 20, textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'var(--surface-raised)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)', fontWeight: 700, fontSize: 16 }}>
                    +
                  </button>
                </div>

                <div className="text-right" style={{ minWidth: 70 }}>
                  <p className="font-display font-bold">{formatUSD(item.subtotal)}</p>
                  <p className="text-xs text-[var(--ink-faint)]">≈ {formatPEN(item.subtotal * rate)}</p>
                </div>

                <button onClick={() => {
                  // Quitar todas las instancias de este producto
                  for (let i = 0; i < item.quantity; i++) updateQuantity(item.id, -1)
                }} className="btn-ghost p-2 text-[var(--status-red)]">
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* RESUMEN */}
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="font-display font-semibold">Resumen</h2>

              {grouped.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-muted)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                    {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}
                  </span>
                  <span style={{ flexShrink: 0, marginLeft: 8 }}>{formatUSD(item.subtotal)}</span>
                </div>
              ))}

              <div className="divider" />

              <div className="flex justify-between text-sm">
                <span>En soles</span>
                <span>≈ {formatPEN(total * rate)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatUSD(total)}</span>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 12, background: insufficient ? 'var(--status-red-bg)' : 'var(--status-green-bg)', border: `1px solid ${insufficient ? 'var(--status-red-border)' : 'var(--status-green-border)'}` }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: insufficient ? 'var(--status-red)' : 'var(--status-green)' }}>Tu saldo</span>
                  <span style={{ fontWeight: 700, color: insufficient ? 'var(--status-red)' : 'var(--status-green)' }}>{formatUSD(balance)}</span>
                </div>
                {insufficient && (
                  <p style={{ fontSize: 11, color: 'var(--status-red)', marginTop: 4 }}>
                    Te faltan {formatUSD(total - balance)} para completar esta compra
                  </p>
                )}
              </div>

              {insufficient && <Alert type="error">Saldo insuficiente para completar la compra</Alert>}

              <button
                onClick={() => { setModal(true); setError('') }}
                disabled={insufficient || grouped.length === 0}
                className="btn-primary w-full"
                style={{ justifyContent: 'center' }}>
                Confirmar compra · {formatUSD(total)}
              </button>

              <button onClick={() => navigate('/tienda')} className="btn-secondary w-full" style={{ justifyContent: 'center', fontSize: 13 }}>
                Seguir comprando
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Datos del cliente">
        <div className="space-y-4">
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
            Estos datos se usaran para todos los pedidos de esta compra.
          </p>
          <div>
            <label className="label">Nombre del cliente</label>
            <input className="input" placeholder="Nombre completo" value={clientName} onChange={e => setClientName(e.target.value)} autoFocus />
          </div>
          <PhoneInput label="WhatsApp del cliente" value={clientPhone} onChange={setClientPhone} />
          {error && <Alert type="error">{error}</Alert>}
          <div className="flex gap-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1" style={{ justifyContent: 'center' }}>Cancelar</button>
            <button onClick={checkout} disabled={loading} className="btn-primary flex-1" style={{ justifyContent: 'center' }}>
              {loading ? <Spinner size={16} /> : `Pagar ${formatUSD(total)}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}