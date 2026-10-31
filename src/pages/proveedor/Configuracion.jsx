import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Alert, Spinner, Modal, Toggle, PageLoader, CopyField, useToast, useConfirm } from '@/components/ui'
import { PAYMENT_METHODS, MethodLogo, getMethodMeta } from '@/lib/paymentMethods'
import { DEFAULT_DUO, APP_FULL_NAME, applyBrand } from '@/lib/brand'
import BrandColors from '@/components/shared/BrandColors'
import AssistantSettings from '@/components/shared/AssistantSettings'
import { IconSettings, IconTrash, IconStore } from '@/assets/icons'

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-10 h-10 rounded-xl inset grid place-items-center text-[var(--ink-muted)] flex-shrink-0">{icon}</span>
      <div>
        <h2 className="font-display font-semibold text-[var(--ink)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--ink-muted)]">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function ProveedorConfiguracion() {
  const { provider, refreshProfile } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [form, setForm] = useState({ display_name: '', slug: '', whatsapp_support: '', logo_url: '', brand_accent: DEFAULT_DUO })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [methods, setMethods] = useState([])
  const [methodModal, setMethodModal] = useState(null)
  const [methodForm, setMethodForm] = useState({ holder_name: '', account_number: '', qr_url: '' })
  const [methodSaving, setMethodSaving] = useState(false)
  const [methodError, setMethodError] = useState('')

  useEffect(() => {
    if (provider) {
      setForm({
        display_name: provider.display_name || '',
        slug: provider.slug || '',
        whatsapp_support: provider.whatsapp_support || '',
        logo_url: provider.logo_url || '',
        brand_accent: provider.brand_accent || DEFAULT_DUO,
      })
      fetchMethods()
      setLoading(false)
    }
  }, [provider])

  // Vista previa en vivo del color; si sales sin guardar, vuelve al guardado
  useEffect(() => { applyBrand(form.brand_accent) }, [form.brand_accent])
  useEffect(() => () => applyBrand(provider?.brand_accent), [provider?.brand_accent])

  async function fetchMethods() {
    const { data } = await supabase.from('payment_methods').select('*').eq('provider_id', provider.id)
    setMethods(data || [])
  }

  async function save() {
    if (!form.slug.trim()) return setError('El código de invitación no puede estar vacío')
    const slugClean = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    setSaving(true); setError('')
    try {
      const payload = {
        display_name: form.display_name || null,
        slug: slugClean,
        whatsapp_support: form.whatsapp_support || null,
        logo_url: form.logo_url || null,
      }
      // El color solo se envía si cambió (requiere la columna brand_accent)
      if (form.brand_accent !== (provider.brand_accent || DEFAULT_DUO)) payload.brand_accent = form.brand_accent
      const { error: err } = await supabase.from('providers').update(payload).eq('id', provider.id)
      if (err) throw err
      await refreshProfile()
      toast.success('Cambios guardados')
    } catch (e) {
      setError(e.message?.includes('brand_accent') ? 'Falta ejecutar los SQL 005 y 006 (colores de marca) en Supabase.' : e.message)
    }
    setSaving(false)
  }

  function openMethod(pm) {
    const existing = methods.find(m => m.method_key === pm.key)
    setMethodModal({ ...pm, existing })
    setMethodForm({ holder_name: existing?.holder_name || '', account_number: existing?.account_number || '', qr_url: existing?.qr_url || '' })
    setMethodError('')
  }

  async function saveMethod() {
    if (!methodForm.holder_name.trim() || !methodForm.account_number.trim()) return setMethodError('Completa el titular y el número')
    const qr = methodForm.qr_url.trim()
    if (qr && !/^https:\/\//i.test(qr)) return setMethodError('El enlace del QR debe empezar con https://')
    // El QR solo se envía si cambió (requiere el SQL 009)
    const qrPatch = qr !== (methodModal.existing?.qr_url || '') ? { qr_url: qr || null } : {}
    setMethodSaving(true); setMethodError('')
    try {
      const existing = methodModal.existing
      if (existing) {
        const { error: err } = await supabase.from('payment_methods').update({
          holder_name: methodForm.holder_name.trim(),
          account_number: methodForm.account_number.trim(),
          is_active: true,
          updated_at: new Date().toISOString(),
          ...qrPatch,
        }).eq('id', existing.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('payment_methods').insert({
          provider_id: provider.id,
          method_key: methodModal.key,
          holder_name: methodForm.holder_name.trim(),
          account_number: methodForm.account_number.trim(),
          is_active: true,
          ...qrPatch,
        })
        if (err) throw err
      }
      await fetchMethods()
      toast.success(`${methodModal.label} guardado`)
      setMethodModal(null)
    } catch (e) { setMethodError(e.message?.includes('qr_url') ? 'Falta ejecutar el SQL 009 en Supabase para guardar el QR.' : e.message) }
    setMethodSaving(false)
  }

  async function toggleMethod(method) {
    setMethods(prev => prev.map(m => m.id === method.id ? { ...m, is_active: !m.is_active } : m))
    await supabase.from('payment_methods').update({ is_active: !method.is_active }).eq('id', method.id)
  }

  async function deleteMethod(m) {
    const ok = await confirm({ title: '¿Eliminar este método?', message: `${getMethodMeta(m.method_key).label} dejará de aparecer para tus distribuidores.`, danger: true, confirmText: 'Eliminar' })
    if (!ok) return
    await supabase.from('payment_methods').delete().eq('id', m.id)
    fetchMethods()
  }

  if (loading) return <PageLoader />

  const dirty = form.display_name !== (provider.display_name || '') || form.slug !== (provider.slug || '') ||
    form.whatsapp_support !== (provider.whatsapp_support || '') || form.logo_url !== (provider.logo_url || '') ||
    form.brand_accent !== (provider.brand_accent || DEFAULT_DUO)

  return (
    <div className={dirty ? 'pb-24' : ''}>
      <PageHeader title="Configuración" subtitle="Tu marca, cómo te encuentran tus distribuidores y cómo te pagan" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          {/* Marca */}
          <section className="card p-5 sm:p-6">
            <SectionTitle icon={<IconStore size={18} />} title="Tu marca" subtitle="Lo que ven tus distribuidores al entrar" />

            <div className="flex items-center gap-4 mb-5">
              {form.logo_url
                ? <img src={form.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover border border-[var(--surface-border)]" onError={e => { e.target.style.opacity = 0.2 }} />
                : <span className="w-16 h-16 rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center font-display text-2xl font-bold shadow-[inset_0_1px_0_var(--hl),0_3px_0_var(--a-edge)]">{(form.display_name || 'T')[0]}</span>}
              <div className="min-w-0">
                <p className="font-display text-xl text-[var(--ink)] truncate">{form.display_name || 'Tu tienda'}</p>
                <p className="text-xs text-[var(--ink-faint)]">con {APP_FULL_NAME}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Nombre de la tienda</label>
                <input className="input" placeholder="Mi Tienda Streaming" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Logo (URL)</label>
                <input className="input" placeholder="https://i.postimg.cc/tu-logo.png" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} />
                <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Súbelo a postimages.org y pega el enlace directo.</p>
              </div>

              <BrandColors value={form.brand_accent} onChange={v => setForm(f => ({ ...f, brand_accent: v }))} />
            </div>
          </section>

          {/* Acceso */}
          <section className="card p-5 sm:p-6">
            <SectionTitle icon={<IconSettings size={18} />} title="Invitación y soporte" />
            <div className="space-y-4">
              <div>
                <label className="label">Código de invitación</label>
                <input className="input font-mono" placeholder="mi-tienda" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Tus distribuidores se registran en /register con este código. Solo letras, números y guiones.</p>
              </div>
              {provider.slug && <CopyField label="Enlace para compartir" value={`${window.location.origin}/register?codigo=${provider.slug}`} />}
              <div>
                <label className="label">WhatsApp de soporte y ventas</label>
                <input className="input" placeholder="+51 999 999 999" value={form.whatsapp_support} onChange={e => setForm(f => ({ ...f, whatsapp_support: e.target.value }))} />
                <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">A este número llegan los avisos de recargas, pedidos y tickets.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
        {/* Métodos de pago */}
        <section className="card p-5 sm:p-6">
          <SectionTitle
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
            title="Métodos de recarga"
            subtitle="Tus distribuidores ven estos datos al recargar saldo"
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-5">
            {PAYMENT_METHODS.map(pm => {
              const saved = methods.find(m => m.method_key === pm.key)
              const isActive = saved?.is_active
              return (
                <button key={pm.key} onClick={() => openMethod(pm)}
                  className={`btn-secondary !h-auto !flex-col !gap-2 !py-3 relative ${isActive ? '!border-[var(--a-line)]' : ''}`}>
                  <MethodLogo logo={pm.logo} label={pm.label} size={32} />
                  <span className="text-[11.5px]">{pm.label}</span>
                  {saved && <span className="absolute top-2 right-2 dot" style={{ color: isActive ? 'var(--a)' : 'var(--ink-faint)', boxShadow: isActive ? '0 0 8px var(--a)' : 'none' }} />}
                </button>
              )
            })}
          </div>

          {methods.length > 0 ? (
            <div>
              <p className="eyebrow mb-2.5">Configurados</p>
              <ul className="space-y-2">
                {methods.map(m => {
                  const pm = getMethodMeta(m.method_key)
                  return (
                    <li key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-[var(--surface-border)] bg-[var(--surface-side)]">
                      <MethodLogo logo={pm.logo} label={pm.label} size={30} />
                      <button className="flex-1 min-w-0 text-left" onClick={() => openMethod(pm)}>
                        <p className="text-[13px] font-semibold text-[var(--ink)]">{pm.label}</p>
                        <p className="text-[11.5px] text-[var(--ink-faint)] truncate">{m.holder_name} · <span className="font-mono">{m.account_number}</span></p>
                      </button>
                      <Toggle checked={m.is_active} onChange={() => toggleMethod(m)} />
                      <button onClick={() => deleteMethod(m)} className="btn-ghost p-2 hover:!text-[var(--status-red)]" aria-label={`Eliminar ${pm.label}`}><IconTrash size={14} /></button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : <p className="text-[13px] text-[var(--ink-muted)] text-center py-2">Toca un método para configurarlo.</p>}
        </section>
        <AssistantSettings />
        </div>
      </div>

      {error && <div className="mt-5"><Alert type="error">{error}</Alert></div>}

      {/* Barra de guardar (aparece al tener cambios) */}
      {dirty && (
        <div className="fixed bottom-0 inset-x-0 lg:left-[var(--sidebar-w)] z-40 p-3 sm:p-4 animate-slide-up" style={{ paddingBottom: 'calc(.75rem + env(safe-area-inset-bottom))' }}>
          <div className="max-w-[1320px] mx-auto card flex items-center gap-3 px-4 py-3 !rounded-2xl shadow-[0_18px_44px_var(--shadow)]">
            <span className="dot animate-pulse-soft" style={{ color: 'var(--b)' }} />
            <p className="flex-1 text-sm text-[var(--ink-muted)]">Tienes cambios sin guardar</p>
            <button onClick={() => setForm({ display_name: provider.display_name || '', slug: provider.slug || '', whatsapp_support: provider.whatsapp_support || '', logo_url: provider.logo_url || '', brand_accent: provider.brand_accent || DEFAULT_DUO })} className="btn-ghost btn-sm">Descartar</button>
            <button onClick={save} disabled={saving} className="btn-primary btn-sm min-w-[96px]">{saving ? <Spinner size={14} /> : 'Guardar'}</button>
          </div>
        </div>
      )}

      <Modal
        open={!!methodModal}
        onClose={() => setMethodModal(null)}
        title={methodModal ? `Configurar ${methodModal.label}` : ''}
        subtitle="Tus distribuidores verán estos datos"
        maxWidth="max-w-sm"
        footer={<>
          <button onClick={() => setMethodModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={saveMethod} disabled={methodSaving} className="btn-primary min-w-[110px]">{methodSaving ? <Spinner size={15} /> : 'Guardar'}</button>
        </>}
      >
        {methodModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MethodLogo logo={methodModal.logo} label={methodModal.label} size={44} />
              <p className="font-display font-semibold text-lg text-[var(--ink)]">{methodModal.label}</p>
            </div>
            <div>
              <label className="label">Nombre del titular</label>
              <input className="input" placeholder="Juan García López" value={methodForm.holder_name} onChange={e => setMethodForm(f => ({ ...f, holder_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">{methodModal.key === 'binance' ? 'ID de Binance Pay' : 'Número'}</label>
              <input className="input font-mono" placeholder={methodModal.placeholder} value={methodForm.account_number} onChange={e => setMethodForm(f => ({ ...f, account_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">QR de pago (URL, opcional)</label>
              <div className="flex gap-3 items-center">
                <input className="input flex-1" placeholder="https://i.postimg.cc/mi-qr.png" value={methodForm.qr_url} onChange={e => setMethodForm(f => ({ ...f, qr_url: e.target.value.trim() }))} />
                {methodForm.qr_url && <img src={methodForm.qr_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-white border border-[var(--surface-border)] flex-shrink-0" onError={e => { e.currentTarget.style.opacity = .2 }} />}
              </div>
              <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Tus distribuidores lo ven al recargar y en el asistente. Súbelo a postimages.org y pega el enlace directo.</p>
            </div>
            {methodModal.existing && (
              <div className="flex items-center justify-between inset px-3.5 py-2.5">
                <span className="text-sm text-[var(--ink-muted)]">Visible para distribuidores</span>
                <Toggle checked={methods.find(m => m.id === methodModal.existing.id)?.is_active ?? true} onChange={() => { toggleMethod(methodModal.existing); setMethodModal(null) }} />
              </div>
            )}
            {methodError && <Alert type="error">{methodError}</Alert>}
          </div>
        )}
      </Modal>
    </div>
  )
}
