import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { PageHeader, Alert, Spinner } from '@/components/ui'
import { IconUser, IconDollar, IconKey } from '@/assets/icons'
import { formatUSD } from '@/utils'
import { DEFAULT_TEMPLATE } from '@/lib/whatsapp'

export default function DistPerfil() {
  const { profile, refreshProfile } = useAuth()
  const { balance } = useBalance()
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState('')
  const [errorPass, setErrorPass] = useState('')
  const [success, setSuccess] = useState('')
  const [successPass, setSuccessPass] = useState('')
  const [successTemplate, setSuccessTemplate] = useState(false)

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', phone: profile.phone || '' })
    fetchTemplate()
  }, [profile])

  async function fetchTemplate() {
    const { data } = await supabase.from('whatsapp_templates').select('template_text').eq('distributor_id', profile?.id).single()
    if (data) setTemplate(data.template_text)
  }

  async function saveProfile() {
    setSaving(true); setError(''); setSuccess('')
    try {
      await supabase.from('users').update({ full_name: form.full_name, phone: form.phone }).eq('id', profile.id)
      await refreshProfile()
      setSuccess('Perfil actualizado correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function changePassword() {
    if (passwords.new.length < 6) return setErrorPass('La contraseña debe tener al menos 6 caracteres')
    if (passwords.new !== passwords.confirm) return setErrorPass('Las contraseñas no coinciden')
    setSavingPass(true); setErrorPass(''); setSuccessPass('')
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new })
      if (error) throw error
      setSuccessPass('Contraseña actualizada')
      setPasswords({ current: '', new: '', confirm: '' })
      setTimeout(() => setSuccessPass(''), 3000)
    } catch (e) { setErrorPass(e.message) }
    setSavingPass(false)
  }

  async function saveTemplate() {
    setSavingTemplate(true)
    try {
      const { data: existing } = await supabase.from('whatsapp_templates').select('id').eq('distributor_id', profile.id).single()
      if (existing) {
        await supabase.from('whatsapp_templates').update({ template_text: template }).eq('distributor_id', profile.id)
      } else {
        await supabase.from('whatsapp_templates').insert({ distributor_id: profile.id, template_text: template })
      }
      setSuccessTemplate(true)
      setTimeout(() => setSuccessTemplate(false), 3000)
    } catch (e) {}
    setSavingTemplate(false)
  }

  return (
    <div>
      <PageHeader title="Mi perfil" subtitle="Configura tu cuenta y preferencias" />

      <div className="max-w-2xl space-y-5">
        {/* Balance card */}
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface-overlay)] flex items-center justify-center">
            <IconDollar size={22} className="text-[var(--ink-muted)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--ink-faint)] uppercase font-bold tracking-wider">Saldo disponible</p>
            <p className="font-display font-bold text-2xl text-[var(--ink)]">{formatUSD(balance)}</p>
            <p className="text-xs text-[var(--ink-faint)]">Recarga contactando a tu proveedor</p>
          </div>
        </div>

        {/* Personal info */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center">
              <IconUser size={18} className="text-[var(--ink-muted)]" />
            </div>
            <h2 className="font-display font-semibold text-[var(--ink)]">Información personal</h2>
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input className="input" value={profile?.email || ''} disabled />
          </div>
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" placeholder="Tu nombre" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Teléfono / WhatsApp</label>
            <input className="input" placeholder="+51 999 999 999" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
          <button onClick={saveProfile} disabled={saving} className="btn-primary w-full justify-center">
            {saving ? <Spinner size={16} /> : 'Guardar cambios'}
          </button>
        </div>

        {/* WhatsApp template */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center text-[var(--ink-muted)]">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display font-semibold text-[var(--ink)]">Plantilla de WhatsApp</h2>
              <p className="text-xs text-[var(--ink-muted)]">Personaliza el mensaje que envías a tus clientes</p>
            </div>
          </div>
          <div className="bg-[var(--surface-overlay)] rounded-xl px-3 py-2 text-xs text-[var(--ink-faint)] leading-relaxed">
            Variables disponibles: <span className="font-mono">{'{nombre_cliente}'} {'{plataforma}'} {'{correo}'} {'{contrasena}'} {'{perfil}'} {'{pin}'} {'{url}'} {'{codigo}'} {'{duracion}'} {'{fecha_vencimiento}'}</span>
          </div>
          <textarea
            className="input resize-none font-mono text-xs leading-relaxed"
            rows={10}
            value={template}
            onChange={e => setTemplate(e.target.value)}
          />
          {successTemplate && <Alert type="success">Plantilla guardada</Alert>}
          <button onClick={saveTemplate} disabled={savingTemplate} className="btn-primary w-full justify-center">
            {savingTemplate ? <Spinner size={16} /> : 'Guardar plantilla'}
          </button>
        </div>

        {/* Change password */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center">
              <IconKey size={18} className="text-[var(--ink-muted)]" />
            </div>
            <h2 className="font-display font-semibold text-[var(--ink)]">Cambiar contraseña</h2>
          </div>
          <div>
            <label className="label">Nueva contraseña</label>
            <input type="password" className="input" placeholder="Mínimo 6 caracteres" value={passwords.new}
              onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} />
          </div>
          <div>
            <label className="label">Confirmar nueva contraseña</label>
            <input type="password" className="input" placeholder="Repite la contraseña" value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
          </div>
          {errorPass && <Alert type="error">{errorPass}</Alert>}
          {successPass && <Alert type="success">{successPass}</Alert>}
          <button onClick={changePassword} disabled={savingPass} className="btn-primary w-full justify-center">
            {savingPass ? <Spinner size={16} /> : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}
