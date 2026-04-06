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
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, color: 'var(--ink)' }}>Ticket enviado</p>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>El proveedor fue notificado.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--ink-muted)' }}>
        Pedido <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--ink)' }}>#{order?.order_code}</span>
        {' · '}{order?.products?.name}
      </div>

      <div>
        <label className="label">Motivo</label>
        <select value={reason} onChange={e => setReason(e.target.value)} className="input">
          <option value="">Selecciona un motivo...</option>
          {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Descripción (opcional)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          className="input" rows={3} placeholder="Describe el problema..." style={{ resize: 'none' }} />
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
        <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
          {loading ? <Spinner size={15} /> : 'Enviar ticket'}
        </button>
      </div>
    </div>
  )
}