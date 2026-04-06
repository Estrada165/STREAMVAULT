import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner } from '@/components/ui'
import { IconShoppingCart, IconTrash, IconUser, IconPhone, IconDollar, IconCheck } from '@/assets/icons'
import { formatUSD, formatPEN, getLogoPath } from '@/utils'
import { addDays } from 'date-fns'

export default function Carrito() {
  const { items, removeItem, clearCart, total, count } = useCart()
  const { profile, provider } = useAuth()
  const { balance, refetch: refetchBalance } = useBalance()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [modal, setModal] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [prefix, setPrefix] = useState('+51')
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
        // Get available stock
        let stockItemId = null
        if (item.delivery_mode === 'stock') {
          const { data: stockItems } = await supabase
            .from('stock_items')
            .select('id')
            .eq('product_id', item.id)
            .eq('is_sold', false)
            .limit(1)
          if (!stockItems?.length) throw new Error(`Sin stock disponible para: ${item.name}`)
          stockItemId = stockItems[0].id
        }

        const expiresAt = addDays(new Date(), item.duration_days).toISOString()
        const status = item.delivery_mode === 'stock' ? 'activo' : 'pendiente_credenciales'

        // Create order
        const { data: order } = await supabase.from('orders').insert({
          distributor_id: profile.id,
          product_id: item.id,
          stock_item_id: stockItemId,
          client_name: clientName.trim(),
          client_whatsapp: `${prefix}${clientPhone.trim()}`,
          price_paid: item.price_usd,
          status,
          expires_at: expiresAt,
        }).select().single()

        // Mark stock as sold
        if (stockItemId) {
          await supabase.from('stock_items').update({
            is_sold: true, sold_at: new Date().toISOString(), order_id: order.id
          }).eq('id', stockItemId)
        }

        // Record transaction
        await supabase.from('transactions').insert({
          user_id: profile.id,
          type: 'compra',
          amount_usd: -item.price_usd,
          ref_order_id: order.id,
          description: `Compra: ${item.name}`,
        })
      }

      // Deduct balance
      const { data: bal } = await supabase.from('balances').select('amount_usd').eq('user_id', profile.id).single()
      await supabase.from('balances').update({ amount_usd: parseFloat(bal.amount_usd) - total }).eq('user_id', profile.id)

      clearCart()
      refetchBalance()
      setSuccess(true)
    } catch (e) {
      setError(e.message)
    }
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
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map(item => (
              <div key={item.id} className="card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img src={getLogoPath(item.platforms?.logo_filename)} alt={item.platforms?.name}
                    className="w-10 h-10 object-contain" onError={e => e.target.style.display='none'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--ink)] text-sm truncate">{item.name}</p>
                  <p className="text-xs text-[var(--ink-faint)]">{item.platforms?.name} · {item.duration_days} días</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-display font-bold text-[var(--ink)]">{formatUSD(item.price_usd)}</p>
                  <p className="text-xs text-[var(--ink-faint)]">≈ {formatPEN(item.price_usd * settings.exchange_rate)}</p>
                </div>
                <button onClick={() => removeItem(item.id)} className="btn-ghost p-2 text-[var(--status-red)] flex-shrink-0">
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="font-display font-semibold text-[var(--ink)]">Resumen</h2>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--ink-muted)]">Subtotal</span>
                  <span className="text-[var(--ink)]">{formatUSD(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--ink-muted)]">En soles</span>
                  <span className="text-[var(--ink-faint)]">≈ {formatPEN(total * settings.exchange_rate)}</span>
                </div>
              </div>

              <div className="divider" />

              <div className="flex justify-between font-display font-bold text-lg">
                <span className="text-[var(--ink)]">Total</span>
                <span className="text-[var(--ink)]">{formatUSD(total)}</span>
              </div>

              <div className={`flex items-center justify-between text-sm px-3 py-2.5 rounded-xl
                ${insufficient ? 'bg-[var(--status-red-bg)]' : 'bg-[var(--status-green-bg)]'}`}>
                <div className="flex items-center gap-1.5">
                  <IconDollar size={14} className={insufficient ? 'text-[var(--status-red)]' : 'text-[var(--status-green)]'} />
                  <span className={insufficient ? 'text-[var(--status-red)]' : 'text-[var(--status-green)]'}>Tu saldo</span>
                </div>
                <span className={`font-semibold ${insufficient ? 'text-[var(--status-red)]' : 'text-[var(--status-green)]'}`}>
                  {formatUSD(balance)}
                </span>
              </div>

              {insufficient && (
                <Alert type="error">Saldo insuficiente. Contacta a tu proveedor para recargar.</Alert>
              )}

              <button onClick={() => { setModal(true); setError('') }} disabled={insufficient} className="btn-primary w-full justify-center py-2.5">
                Confirmar compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client data modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Datos del cliente">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-muted)]">Ingresa los datos de tu cliente final. Estos se guardarán en el pedido.</p>

          <div>
            <label className="label">Nombre del cliente</label>
            <div className="relative">
              <IconUser size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input className="input pl-9" placeholder="Nombre completo" value={clientName}
                onChange={e => setClientName(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">WhatsApp del cliente</label>
            <div className="flex flex-col sm:flex-row gap-2">
  <select className="input sm:w-24 flex-shrink-0" value={prefix} onChange={e => setPrefix(e.target.value)}>
    <option>+51</option><option>+1</option><option>+57</option><option>+56</option>
    <option>+52</option><option>+54</option><option>+34</option>
  </select>
  <div className="relative flex-1">
    <IconPhone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
    <input className="input pl-9" placeholder="999999999" value={clientPhone}
      onChange={e => setClientPhone(e.target.value)} type="tel" />
  </div>
</div>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <div className="bg-[var(--surface-overlay)] rounded-xl p-3 text-xs text-[var(--ink-muted)]">
            Total a descontar: <strong className="text-[var(--ink)]">{formatUSD(total)}</strong> · Saldo restante: <strong className="text-[var(--ink)]">{formatUSD(balance - total)}</strong>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={checkout} disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <Spinner size={16} /> : 'Pagar ahora'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
