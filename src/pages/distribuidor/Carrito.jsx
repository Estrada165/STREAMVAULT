import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner } from '@/components/ui'
import { IconShoppingCart, IconTrash, IconUser, IconDollar, IconCheck } from '@/assets/icons'
import { formatUSD, formatPEN, getLogoPath } from '@/utils'
import { addDays } from 'date-fns'
import PhoneInput from '@/components/shared/PhoneInput'

// Thumbnail del item en carrito: imagen custom > logo plataforma
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
  const { items, removeItem, clearCart, total, count } = useCart()
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

  const insufficient = balance < total

  async function checkout() {
    if (!clientName.trim()) return setError('El nombre del cliente es requerido')
    if (!clientPhone.trim()) return setError('El número de WhatsApp es requerido')
    if (insufficient) return setError('Saldo insuficiente')

    setLoading(true)
    setError('')

    try {
      for (const item of items) {
        let stockItemId = null

        if (item.delivery_mode === 'stock') {
          const { data: stockItems } = await supabase
            .from('stock_items').select('id').eq('product_id', item.id).eq('is_sold', false).limit(1)
          if (!stockItems?.length) throw new Error(`Sin stock disponible para: ${item.name}`)
          stockItemId = stockItems[0].id
        }

        const expiresAt = addDays(new Date(), item.duration_days).toISOString()
        const status = item.delivery_mode === 'stock' ? 'activo' : 'pendiente_credenciales'

        const { data: order } = await supabase.from('orders').insert({
          distributor_id: profile.id,
          product_id: item.id,
          stock_item_id: stockItemId,
          client_name: clientName.trim(),
          client_whatsapp: clientPhone.trim(),
          price_paid: item.price_usd,
          status,
          expires_at: expiresAt,
        }).select().single()

        if (stockItemId) {
          await supabase.from('stock_items').update({ is_sold: true, sold_at: new Date().toISOString(), order_id: order.id }).eq('id', stockItemId)
        }

        await supabase.from('transactions').insert({
          user_id: profile.id, type: 'compra', amount_usd: -item.price_usd,
          ref_order_id: order.id, description: `Compra: ${item.name}`,
        })
      }

      const { data: bal } = await supabase.from('balances').select('amount_usd').eq('user_id', profile.id).single()
      await supabase.from('balances').update({ amount_usd: parseFloat(bal.amount_usd) - total }).eq('user_id', profile.id)

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
          <p className="text-sm text-[var(--ink-muted)] mb-6">Tus pedidos están listos. Revisa tu panel para ver las credenciales.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary w-full justify-center">Ver mis pedidos</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Carrito" subtitle={`${count} producto${count !== 1 ? 's' : ''}`} />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-overlay)] flex items-center justify-center mb-4 text-[var(--ink-faint)]">
            <IconShoppingCart size={30} />
          </div>
          <h3 className="font-display font-semibold text-[var(--ink)] mb-1">Tu carrito está vacío</h3>
          <p className="text-sm text-[var(--ink-muted)] mb-5">Agrega productos desde la tienda</p>
          <button onClick={() => navigate('/tienda')} className="btn-primary">Ir a la tienda</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ITEMS */}
          <div className="lg:col-span-2 space-y-3">
            {items.map(item => (
              <div key={item.id} className="card p-4 flex items-center gap-4">
                <CartItemThumb item={item} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  <p className="text-xs text-[var(--ink-faint)]">{item.platforms?.name} · {item.duration_days} días</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">{formatUSD(item.price_usd)}</p>
                  <p className="text-xs text-[var(--ink-faint)]">≈ {formatPEN(item.price_usd * settings.exchange_rate)}</p>
                </div>
                <button onClick={() => removeItem(item.id)} className="btn-ghost p-2 text-[var(--status-red)]">
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* RESUMEN */}
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="font-display font-semibold">Resumen</h2>
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatUSD(total)}</span></div>
              <div className="flex justify-between text-sm"><span>En soles</span><span>≈ {formatPEN(total * settings.exchange_rate)}</span></div>
              <div className="divider" />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatUSD(total)}</span></div>
              <div className={`p-3 rounded-xl ${insufficient ? 'bg-[var(--status-red-bg)]' : 'bg-[var(--status-green-bg)]'}`}>
                <div className="flex justify-between text-sm"><span>Tu saldo</span><span>{formatUSD(balance)}</span></div>
              </div>
              {insufficient && <Alert type="error">Saldo insuficiente</Alert>}
              <button onClick={() => { setModal(true); setError('') }} disabled={insufficient} className="btn-primary w-full">
                Confirmar compra
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Datos del cliente">
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del cliente</label>
            <input className="input" placeholder="Nombre completo" value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>
          <PhoneInput label="WhatsApp del cliente" value={clientPhone} onChange={setClientPhone} />
          {error && <Alert type="error">{error}</Alert>}
          <div className="flex gap-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={checkout} disabled={loading} className="btn-primary flex-1">
              {loading ? <Spinner size={16} /> : 'Pagar ahora'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}