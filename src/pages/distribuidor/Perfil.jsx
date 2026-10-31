import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { PageHeader, Alert, Spinner } from '@/components/ui'
import { IconUser, IconKey, IconWhatsApp, IconCheck } from '@/assets/icons'
import { formatUSD } from '@/utils'
import { DEFAULT_TEMPLATE, fillTemplate } from '@/lib/whatsapp'
import PhoneInput from '@/components/shared/PhoneInput'
import BrandColors from '@/components/shared/BrandColors'
import { applyBrand } from '@/lib/brand'
import { useToast } from '@/components/ui'

/** Colores del panel del distribuidor: los suyos o los de su proveedor */
function PanelColors() {
  const { profile, provider, refreshProfile } = useAuth()
  const toast = useToast()
  const saved = profile?.ui_accent || null
  const [value, setValue] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setValue(saved) }, [saved])
  // Vista previa en vivo; al salir sin guardar vuelve a lo guardado
  useEffect(() => { applyBrand(value || provider?.brand_accent) }, [value, provider?.brand_accent])
  useEffect(() => () => applyBrand(saved || provider?.brand_accent), [saved, provider?.brand_accent])

  async function save() {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('users').update({ ui_accent: value }).eq('id', profile.id)
    if (err) setError(err.message?.includes('ui_accent') ? 'Falta ejecutar el SQL 008 en Supabase.' : err.message)
    else { await refreshProfile(); toast.success('Colores guardados') }
    setSaving(false)
  }

  const dirty = (value || null) !== saved
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-10 h-10 rounded-xl inset grid place-items-center text-[var(--ink-muted)] flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a10 10 0 110-20c5.5 0 10 4 10 9a5 5 0 01-5 5h-1.8a1.7 1.7 0 00-1.2 2.9A1.7 1.7 0 0112 22z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>
        </span>
        <div>
          <h2 className="font-display font-semibold text-[var(--ink)]">Colores de tu panel</h2>
          <p className="text-xs text-[var(--ink-muted)]">Solo cambian lo que tú ves. El logo y el nombre siguen siendo de {provider?.display_name || 'tu proveedor'}.</p>
        </div>
      </div>
      <BrandColors value={value} onChange={setValue} inheritLabel={`Colores de ${provider?.display_name || 'mi proveedor'}`} inheritValue={provider?.brand_accent} />
      {error && <div className="mt-3"><Alert type="error">{error}</Alert></div>}
      {dirty && (
        <div className="flex gap-2 mt-4 animate-fade-in">
          <button onClick={() => setValue(saved)} className="btn-ghost">Descartar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size={16} /> : 'Guardar colores'}</button>
        </div>
      )}
    </div>
  )
}

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
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      })
    }
    fetchTemplate()
  }, [profile])

  async function fetchTemplate() {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('template_text')
      .eq('distributor_id', profile?.id)
      .single()

    if (data) setTemplate(data.template_text)
  }

  async function saveProfile() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await supabase
        .from('users')
        .update({
          full_name: form.full_name,
          phone: form.phone,
        })
        .eq('id', profile.id)

      await refreshProfile()
      setSuccess('Perfil actualizado correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message)
    }

    setSaving(false)
  }

  async function changePassword() {
    if (passwords.new.length < 6) {
      return setErrorPass('La contraseña debe tener al menos 6 caracteres')
    }

    if (passwords.new !== passwords.confirm) {
      return setErrorPass('Las contraseñas no coinciden')
    }

    setSavingPass(true)
    setErrorPass('')
    setSuccessPass('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new,
      })

      if (error) throw error

      setSuccessPass('Contraseña actualizada')
      setPasswords({ current: '', new: '', confirm: '' })
      setTimeout(() => setSuccessPass(''), 3000)
    } catch (e) {
      setErrorPass(e.message)
    }

    setSavingPass(false)
  }

  async function saveTemplate() {
    setSavingTemplate(true)

    try {
      const { data: existing } = await supabase
        .from('whatsapp_templates')
        .select('id')
        .eq('distributor_id', profile.id)
        .single()

      if (existing) {
        await supabase
          .from('whatsapp_templates')
          .update({ template_text: template })
          .eq('distributor_id', profile.id)
      } else {
        await supabase
          .from('whatsapp_templates')
          .insert({
            distributor_id: profile.id,
            template_text: template,
          })
      }

      setSuccessTemplate(true)
      setTimeout(() => setSuccessTemplate(false), 3000)
    } catch (e) {
      // opcional: mostrar error si quieres
    }

    setSavingTemplate(false)
  }

  const VARS = ['{nombre_cliente}', '{plataforma}', '{correo}', '{contrasena}', '{perfil}', '{pin}', '{url}', '{codigo}', '{duracion}', '{fecha_vencimiento}']
  const preview = fillTemplate(template || DEFAULT_TEMPLATE, {
    clientName: 'María', platformName: 'Netflix', email: 'cuenta01@correo.com', password: 'Clave2026',
    profileName: 'Perfil 3', profilePin: '1234', durationDays: 30, expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), orderCode: 'ORD-8F2A91C3',
  })
  const SectionTitle = ({ icon: Icon, title, subtitle }) => (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-10 h-10 rounded-xl inset grid place-items-center text-[var(--ink-muted)] flex-shrink-0"><Icon size={18} /></span>
      <div>
        <h2 className="font-display font-semibold text-[var(--ink)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--ink-muted)]">{subtitle}</p>}
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader title="Mi" accent="perfil" subtitle="Tus datos, tu plantilla de WhatsApp, tus colores y tu contraseña" />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        <div className="xl:col-span-2 space-y-5">
          <div className="card p-5 flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl inset grid place-items-center font-display text-xl font-semibold text-[var(--ink)] uppercase">
              {(profile?.full_name || profile?.email || '?')[0]}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--ink)] truncate">{profile?.full_name || 'Sin nombre'}</p>
              <p className="text-xs text-[var(--ink-faint)] truncate">{profile?.email}</p>
            </div>
            <div className="ml-auto text-right lg:hidden">
              <p className="eyebrow">Saldo</p>
              <p className="font-mono text-xl grad">{formatUSD(balance)}</p>
            </div>
          </div>

          <div className="card p-5 sm:p-6 space-y-4">
            <SectionTitle icon={IconUser} title="Información personal" />
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" value={profile?.email || ''} disabled />
            </div>
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" placeholder="Tu nombre" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <PhoneInput label="Teléfono / WhatsApp" value={form.phone} onChange={value => setForm(f => ({ ...f, phone: value }))} />
            {error && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}
            <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">{saving ? <Spinner size={16} /> : 'Guardar cambios'}</button>
          </div>

          <div className="card p-5 sm:p-6 space-y-4">
            <SectionTitle icon={IconKey} title="Cambiar contraseña" />
            <div>
              <label className="label">Nueva contraseña</label>
              <input type="password" className="input" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} />
            </div>
            <div>
              <label className="label">Confirmar nueva contraseña</label>
              <input type="password" className="input" placeholder="Repite la contraseña" autoComplete="new-password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
            </div>
            {errorPass && <Alert type="error">{errorPass}</Alert>}
            {successPass && <Alert type="success">{successPass}</Alert>}
            <button onClick={changePassword} disabled={savingPass} className="btn-secondary w-full">{savingPass ? <Spinner size={16} /> : 'Cambiar contraseña'}</button>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-5">
        <div className="card p-5 sm:p-6">
          <SectionTitle icon={IconWhatsApp} title="Plantilla de WhatsApp" subtitle="El mensaje con credenciales que envías a tus clientes" />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="label">Toca una variable para agregarla</p>
              <div className="flex flex-wrap gap-1.5">
                {VARS.map(v => (
                  <button key={v} type="button" onClick={() => setTemplate(t => (t || '') + (t?.endsWith('\n') || !t ? '' : ' ') + v)} className="badge hover:!border-[var(--a-line)] hover:!text-[var(--a)] font-mono !text-[11px] cursor-pointer">{v}</button>
                ))}
              </div>
              <textarea className="input font-mono !text-[12.5px] leading-relaxed" rows={14} value={template} onChange={e => setTemplate(e.target.value)} aria-label="Plantilla" />
              <div className="flex gap-2">
                <button onClick={() => setTemplate(DEFAULT_TEMPLATE)} className="btn-ghost">Restaurar</button>
                <button onClick={saveTemplate} disabled={savingTemplate} className="btn-primary flex-1">{savingTemplate ? <Spinner size={16} /> : successTemplate ? <><IconCheck size={15} className="animate-pop" />Guardada</> : 'Guardar plantilla'}</button>
              </div>
            </div>
            <div>
              <p className="label">Vista previa</p>
              <div className="rounded-2xl p-4 min-h-[280px] border border-[var(--surface-border)]" style={{ background: 'color-mix(in srgb, var(--a) 6%, var(--surface-overlay))' }}>
                <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md px-3.5 py-2.5 bg-[var(--surface-raised)] border border-[var(--surface-border)] shadow-[0_2px_6px_var(--shadow)]">
                  <p className="text-[13px] leading-relaxed text-[var(--ink)] whitespace-pre-wrap break-words">{preview}</p>
                  <p className="text-[10px] text-[var(--ink-faint)] text-right mt-1">12:30 ✓✓</p>
                </div>
              </div>
              <p className="text-[11px] text-[var(--ink-faint)] mt-2">Las líneas sin dato (por ejemplo, sin PIN) se ocultan solas.</p>
            </div>
          </div>
        </div>
        <PanelColors />
        </div>
      </div>
    </div>
  )
}
