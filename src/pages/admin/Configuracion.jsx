import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Alert, Spinner } from '@/components/ui'
import { IconDollar } from '@/assets/icons'

export default function AdminConfiguracion() {
  const [rate, setRate] = useState('3.50')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'exchange_rate').single()
      .then(({ data }) => { if (data) setRate(data.value); setLoading(false) })
  }, [])

  async function save() {
    setSaving(true)
    setSuccess(false)
    await supabase.from('settings').update({ value: rate }).eq('key', 'exchange_rate')
    setSuccess(true)
    setSaving(false)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes globales de la plataforma" />

      <div className="max-w-md">
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center">
              <IconDollar size={18} className="text-[var(--ink-muted)]" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-[var(--ink)]">Tipo de cambio</h2>
              <p className="text-xs text-[var(--ink-muted)]">1 USD equivale a X soles peruanos</p>
            </div>
          </div>

          {loading ? <Spinner /> : (
            <>
              <div>
                <label className="label">1 USD = ? PEN</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="input"
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                  />
                  <span className="text-sm font-semibold text-[var(--ink-muted)] whitespace-nowrap">soles</span>
                </div>
                <p className="text-xs text-[var(--ink-faint)] mt-1">
                  Ejemplo: si rate = 3.80, $1 → S/ 3.80
                </p>
              </div>

              {success && <Alert type="success">Tipo de cambio actualizado correctamente</Alert>}

              <button onClick={save} disabled={saving} className="btn-primary w-full justify-center">
                {saving ? <Spinner size={16} /> : 'Guardar cambios'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
