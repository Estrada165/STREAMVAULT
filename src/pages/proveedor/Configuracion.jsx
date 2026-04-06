import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Alert, Spinner } from '@/components/ui'
import { IconSettings, IconUsers } from '@/assets/icons'

export default function ProveedorConfiguracion() {
  const { provider, refreshProfile } = useAuth()
  const [form, setForm] = useState({ display_name: '', slug: '', whatsapp_support: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (provider) {
      setForm({
        display_name: provider.display_name || '',
        slug: provider.slug || '',
        whatsapp_support: provider.whatsapp_support || '',
      })
      setLoading(false)
    }
  }, [provider])

  async function save() {
    if (!form.slug.trim()) return setError('El código de acceso no puede estar vacío')
    const slugClean = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    setSaving(true); setError(''); setSuccess(false)
    try {
      const { error: err } = await supabase.from('providers').update({
        display_name: form.display_name || null,
        slug: slugClean,
        whatsapp_support: form.whatsapp_support || null,
      }).eq('id', provider.id)
      if (err) throw err
      await refreshProfile()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes de tu tienda" />

      <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Store settings */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)' }}>
              <IconSettings size={18} />
            </div>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Datos de tu tienda</p>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Nombre y código para tus distribuidores</p>
            </div>
          </div>

          <div>
            <label className="label">Nombre de tu tienda</label>
            <input className="input" placeholder="Mi Tienda Streaming" value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>

          <div>
            <label className="label">Código de acceso (slug)</label>
            <input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="mi-tienda-123" value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 5 }}>
              Tus distribuidores usan este código al registrarse:{' '}
              <span style={{ fontFamily: 'DM Mono, monospace', background: 'var(--surface-overlay)', padding: '1px 6px', borderRadius: 5 }}>
                {form.slug || 'tu-codigo'}
              </span>
            </p>
          </div>

          <div>
            <label className="label">Número WhatsApp de soporte / ventas</label>
            <input className="input" placeholder="+51999999999" value={form.whatsapp_support}
              onChange={e => setForm(f => ({ ...f, whatsapp_support: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 5 }}>
              Cuando un distribuidor haga un pedido a pedido o reporte un problema, el sistema usará este número para abrir WhatsApp automáticamente.
            </p>
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">Configuración guardada correctamente</Alert>}

          <button onClick={save} disabled={saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? <Spinner size={15} /> : 'Guardar cambios'}
          </button>
        </div>

        {/* Info card */}
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)', flexShrink: 0 }}>
            <IconUsers size={18} />
          </div>
          <div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 5 }}>¿Cómo agregar distribuidores?</p>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
              Comparte tu código <span style={{ fontFamily: 'DM Mono, monospace', background: 'var(--surface-overlay)', padding: '1px 6px', borderRadius: 5 }}>{form.slug}</span> con tus distribuidores. Ellos se registran en <strong>/register</strong> con rol "Distribuidor" e ingresan tu código. Luego tú activas su cuenta desde la sección Distribuidores.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}