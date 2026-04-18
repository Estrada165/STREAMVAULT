import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Alert, Spinner, Modal, Toggle } from '@/components/ui'
import { IconSettings, IconUsers, IconPlus, IconEdit, IconTrash } from '@/assets/icons'

// ── MÉTODOS DE PAGO DISPONIBLES ────────────────────────────
// Para agregar uno nuevo: copia un bloque y cambia key, label y logo
const PAYMENT_METHODS = [
  { key: 'yape',    label: 'Yape',    logo: '/logos/logoYAPE.png',    placeholder: 'Número de teléfono' },
  { key: 'plin',    label: 'Plin',    logo: '/logos/logoPLIN.png',    placeholder: 'Número de teléfono' },
  { key: 'bim',     label: 'Bim',     logo: '/logos/LOGOBIM.webp',     placeholder: 'Número de teléfono' },
  { key: 'binance', label: 'Binance', logo: '/logos/logoBINANCE.webp', placeholder: 'ID de Binance Pay' },
  { key: 'lemon',   label: 'Lemon',   logo: '/logos/logoLEMON.webp',   placeholder: 'Número de teléfono' },
  { key: 'agora',   label: 'Agora',   logo: '/logos/LOGOAGORA.webp',   placeholder: 'Número de teléfono' },
  // ── AGREGAR MÁS MÉTODOS AQUÍ ──
  // { key: 'interbank', label: 'Interbank', logo: '/logos/logo_interbank.png', placeholder: 'N° de cuenta / CCI' },
  // { key: 'paypal',    label: 'PayPal',    logo: '/logos/logo_paypal.png',    placeholder: 'Email de PayPal' },
]

function MethodLogo({ logo, label, size = 32 }) {
  const [err, setErr] = useState(false)
  if (err) return (
    <div style={{ width: size, height: size, borderRadius: size/4, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: 'var(--ink-muted)' }}>
      {label[0]}
    </div>
  )
  return <img src={logo} alt={label} width={size} height={size} style={{ borderRadius: size/4, objectFit: 'contain' }} onError={() => setErr(true)} />
}

export default function ProveedorConfiguracion() {
  const { provider, refreshProfile } = useAuth()

  // ── Store settings state ──
  const [form, setForm] = useState({ display_name: '', slug: '', whatsapp_support: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // ── Payment methods state ──
  const [methods, setMethods] = useState([]) // saved in DB
  const [methodModal, setMethodModal] = useState(null) // null | { key } | { key, existing }
  const [methodForm, setMethodForm] = useState({ holder_name: '', account_number: '' })
  const [methodSaving, setMethodSaving] = useState(false)
  const [methodError, setMethodError] = useState('')

  useEffect(() => {
    if (provider) {
      setForm({
        display_name: provider.display_name || '',
        slug: provider.slug || '',
        whatsapp_support: provider.whatsapp_support || '',
      })
      fetchMethods()
      setLoading(false)
    }
  }, [provider])

  async function fetchMethods() {
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('provider_id', provider.id)
    setMethods(data || [])
  }

  // ── Save store settings ──
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
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  // ── Payment method modal ──
  function openMethod(pm) {
    const existing = methods.find(m => m.method_key === pm.key)
    setMethodModal({ ...pm, existing })
    setMethodForm({ holder_name: existing?.holder_name || '', account_number: existing?.account_number || '' })
    setMethodError('')
  }

  async function saveMethod() {
    console.log('Saving method:', methodForm)
    if (!methodForm.holder_name.trim() || !methodForm.account_number.trim()) {
      return setMethodError('Completa todos los campos')
    }
    setMethodSaving(true); setMethodError('')
    try {
      const existing = methodModal.existing
      if (existing) {
        await supabase.from('payment_methods').update({
          holder_name: methodForm.holder_name.trim(),
          account_number: methodForm.account_number.trim(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await supabase.from('payment_methods').insert({
          provider_id: provider.id,
          method_key: methodModal.key,
          holder_name: methodForm.holder_name.trim(),
          account_number: methodForm.account_number.trim(),
          is_active: true,
        })
      }
      await fetchMethods()
      setMethodModal(null)
    } catch (e) { setMethodError(e.message) }
    setMethodSaving(false)
  }

  async function toggleMethod(method) {
    await supabase.from('payment_methods').update({ is_active: !method.is_active }).eq('id', method.id)
    fetchMethods()
  }

  async function deleteMethod(id) {
    if (!confirm('¿Eliminar este método de pago?')) return
    await supabase.from('payment_methods').delete().eq('id', id)
    fetchMethods()
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes de tu tienda" />

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, maxWidth: 900 }}>

        {/* ── LEFT: Store settings ── */}
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
            <input className="input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="mi-tienda-123"
              value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 5 }}>
              Código para distribuidores: <span style={{ fontFamily: 'DM Mono, monospace', background: 'var(--surface-overlay)', padding: '1px 6px', borderRadius: 5 }}>{form.slug || 'tu-codigo'}</span>
            </p>
          </div>

          <div>
            <label className="label">WhatsApp de soporte / ventas</label>
            <input className="input" placeholder="+51 999 999 999" value={form.whatsapp_support}
              onChange={e => setForm(f => ({ ...f, whatsapp_support: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
              El sistema usa este número cuando un distribuidor notifica al proveedor.
            </p>
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">Configuración guardada correctamente</Alert>}

          <button onClick={save} disabled={saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? <Spinner size={15} /> : 'Guardar cambios'}
          </button>

          {/* How to add distributors */}
          <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)', flexShrink: 0 }}>
              <IconUsers size={16} />
            </div>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>¿Cómo agregar distribuidores?</p>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
                Comparte tu código <span style={{ fontFamily: 'DM Mono, monospace', background: 'var(--surface-overlay)', padding: '1px 6px', borderRadius: 5 }}>{form.slug}</span> con tus distribuidores. Ellos se registran en <strong>/register</strong> e ingresan tu código.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Payment methods ── */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
           <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)' }}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
</div>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Métodos de recarga</p>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Tus distribuidores verán estos datos para recargar</p>
            </div>
          </div>

          {/* Grid of available methods */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {PAYMENT_METHODS.map(pm => {
              const saved = methods.find(m => m.method_key === pm.key)
              const isActive = saved?.is_active
              return (
                <button key={pm.key} onClick={() => openMethod(pm)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${isActive ? 'var(--status-green-border)' : saved ? 'var(--surface-border-strong)' : 'var(--surface-border)'}`,
                    background: isActive ? 'var(--status-green-bg)' : saved ? 'var(--surface-overlay)' : 'transparent',
                    transition: 'all 0.15s', position: 'relative',
                  }}>
                  <MethodLogo logo={pm.logo} label={pm.label} size={34} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? 'var(--status-green)' : 'var(--ink-muted)' }}>
                    {pm.label}
                  </span>
                  {/* Active indicator */}
                  {isActive && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--status-green)' }} />
                  )}
                  {/* Saved but inactive */}
                  {saved && !isActive && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-faint)' }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Saved methods list */}
          {methods.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>Configurados</p>
              {methods.map(m => {
                const pm = PAYMENT_METHODS.find(p => p.key === m.method_key)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-overlay)', border: '1px solid var(--surface-border)' }}>
                    <MethodLogo logo={pm?.logo || ''} label={pm?.label || m.method_key} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{pm?.label || m.method_key}</p>
                      <p style={{ fontSize: 11, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.holder_name} · {m.account_number}
                      </p>
                    </div>
                    <Toggle checked={m.is_active} onChange={() => toggleMethod(m)} />
                    <button onClick={() => deleteMethod(m.id)} className="btn-ghost" style={{ padding: '4px 6px', color: 'var(--status-red)', flexShrink: 0 }}>
                      <IconTrash size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {methods.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', padding: '8px 0' }}>
              Haz click en un método para configurarlo. Los activos aparecen en la tienda de tus distribuidores.
            </p>
          )}
        </div>
      </div>

      {/* ── METHOD MODAL ── */}
      <Modal open={!!methodModal} onClose={() => setMethodModal(null)}
        title={`Configurar ${methodModal?.label}`} maxWidth="max-w-sm">
        {methodModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Logo + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-overlay)', borderRadius: 10 }}>
              <MethodLogo logo={methodModal.logo} label={methodModal.label} size={40} />
              <div>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{methodModal.label}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Tus distribuidores verán esta información</p>
              </div>
            </div>

            <div>
              <label className="label">Nombre del titular</label>
              <input className="input" placeholder="Juan García López" value={methodForm.holder_name}
                onChange={e => setMethodForm(f => ({ ...f, holder_name: e.target.value }))} />
            </div>

            <div>
              <label className="label">{methodModal.key === 'binance' ? 'ID de Binance Pay' : methodModal.key === 'bcp' ? 'N° de cuenta / CCI' : 'Número'}</label>
              <input className="input" style={{ fontFamily: 'DM Mono, monospace' }}
                placeholder={methodModal.placeholder}
                value={methodForm.account_number}
                onChange={e => setMethodForm(f => ({ ...f, account_number: e.target.value }))} />
            </div>

            {/* Active toggle if already exists */}
            {methodModal.existing && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-overlay)', borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Visible para distribuidores</span>
                <Toggle
                  checked={methods.find(m => m.id === methodModal.existing.id)?.is_active ?? true}
                  onChange={() => { toggleMethod(methodModal.existing); setMethodModal(null) }}
                />
              </div>
            )}

            {methodError && <Alert type="error">{methodError}</Alert>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMethodModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={saveMethod} disabled={methodSaving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {methodSaving ? <Spinner size={15} /> : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
