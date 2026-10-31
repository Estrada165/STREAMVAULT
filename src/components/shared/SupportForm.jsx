import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Alert, Spinner } from '@/components/ui'

const REASONS = [
  { value: 'contrasena_incorrecta', label: 'Contraseña incorrecta' },
  { value: 'no_da_acceso', label: 'No da acceso' },
  { value: 'perfil_ocupado', label: 'Perfil ocupado' },
  { value: 'codigo_invalido', label: 'Código inválido' },
  { value: 'otro', label: 'Otro' },
]

export default function SupportForm({ order, onClose }) {
  const { profile } = useAuth()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    if (!reason) return setError('Selecciona un motivo')
    setLoading(true)
    setError('')
    try {
      const providerId = order?.products?.provider_id
      if (!providerId) throw new Error('No se encontró el proveedor')

      const { error: ticketErr } = await supabase.from('support_tickets').insert({
        order_id: order.id,
        distributor_id: profile.id,
        provider_id: providerId,
        reason,
        description: description || null,
        status: 'abierto',
      })
      if (ticketErr) throw ticketErr

      // Get provider user_id to notify
      const { data: prov } = await supabase
        .from('providers').select('user_id').eq('id', providerId).maybeSingle()

      if (prov?.user_id) {
        await supabase.from('notifications').insert({
          user_id: prov.user_id,
          title: 'Nuevo ticket de soporte',
          message: `Pedido ${order.order_code} — ${REASONS.find(r => r.value === reason)?.label}`,
          type: 'warning',
          ref_id: order.id,
        })
      }

      setSuccess(true)
      setTimeout(() => { setSuccess(false); onClose() }, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-6 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)] animate-pop">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <p className="font-display font-semibold text-lg text-[var(--ink)]">Ticket enviado</p>
        <p className="text-sm text-[var(--ink-muted)] mt-1">Tu proveedor ya fue notificado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label">¿Qué pasa con la cuenta?</p>
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              aria-pressed={reason === r.value}
              className={`btn-secondary btn-sm !justify-start !h-auto !py-2.5 !whitespace-normal text-left ${reason === r.value ? 'is-down !border-[var(--a-line)] !text-[var(--a)]' : ''}`}
            >
              <span className="dot" style={{ color: reason === r.value ? 'var(--a)' : 'var(--surface-border-strong)' }} />
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Detalle (opcional)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} className="input" rows={3} placeholder="Ej: dice contraseña incorrecta desde ayer en la noche" />
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="flex gap-2.5">
        <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button onClick={handleSubmit} disabled={loading || !reason} className="btn-primary flex-[2]">
          {loading ? <Spinner size={15} /> : 'Enviar ticket'}
        </button>
      </div>
    </div>
  )
}
