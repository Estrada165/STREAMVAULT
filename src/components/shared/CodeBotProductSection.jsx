import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Toggle, Spinner, Alert } from '@/components/ui'
import { useCodebotStatus, codebotPlatforms, defaultCodeTypes, matchPlatform } from '@/lib/codebot'
import { TourButton, useAutoTour } from './Tour'
import { IconZap, IconAlertCircle, IconCheck } from '@/assets/icons'

/**
 * Paso «Bot de códigos» del formulario de producto.
 * value = products.code_bot → { enabled, platform_id, platform_name, types: [...] }
 */
export default function CodeBotProductSection({ value, onChange, deliveryType, platformName }) {
  const { profile } = useAuth()
  const { status } = useCodebotStatus()
  const [platforms, setPlatforms] = useState(null)
  const [error, setError] = useState('')
  const v = value || {}
  const on = !!v.enabled
  const connected = !!status?.connected
  const supported = ['perfil', 'cuenta_completa'].includes(deliveryType)
  useAutoTour('codebot-product-intro', profile, { ready: connected && !on, inModal: true, delay: 600 })
  useAutoTour('codebot-product', profile, { ready: connected && on && platforms !== null, inModal: true, delay: 500 })

  useEffect(() => {
    if (!connected || !on || platforms) return
    codebotPlatforms().then(setPlatforms).catch(e => { setError(e.message); setPlatforms([]) })
  }, [connected, on])

  const set = patch => onChange({ ...v, ...patch })
  const current = platforms?.find(p => p.id === v.platform_id) || null

  // Al activar (o si cambia la plataforma del producto) se sugiere la de StreamPanel y sus tipos
  useEffect(() => {
    if (!on || !platforms?.length || v.platform_id) return
    const m = matchPlatform(platforms, platformName)
    if (m) set({ platform_id: m.id, platform_name: m.name, types: defaultCodeTypes(deliveryType, m.types) })
  }, [on, platforms, platformName])

  function pickPlatform(id) {
    const p = platforms.find(x => x.id === id)
    set({ platform_id: id || null, platform_name: p?.name || null, types: p ? defaultCodeTypes(deliveryType, p.types) : [] })
  }
  const toggleType = id => set({ types: (v.types || []).includes(id) ? v.types.filter(t => t !== id) : [...(v.types || []), id] })

  return (
    <fieldset className="pt-5 border-t border-[var(--surface-border)]" data-tour="codebot-section">
      <div className={`rounded-2xl border transition-colors ${on ? 'border-[var(--a-line)] bg-[var(--a-soft)]' : 'border-[var(--surface-border)]'}`}>
        <div className="flex items-center justify-between gap-3 p-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-9 h-9 rounded-xl grid place-items-center flex-shrink-0 ${on ? 'bg-[var(--a)] text-[var(--accent-ink,#fff)]' : 'inset text-[var(--ink-faint)]'}`}><IconZap size={16} /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--ink)]">Bot de códigos</p>
              <p className="text-[11px] text-[var(--ink-muted)]">El comprador recibe su enlace para sacar códigos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {on && connected && <TourButton id="codebot-product" user={profile} label="Ver guía del bot" />}
            <Toggle checked={on} onChange={val => set({ enabled: val })} disabled={!connected && !on} />
          </div>
        </div>

        {status === null ? null : !connected ? (
          <div className="px-3.5 pb-3.5">
            <p className="text-[12px] text-[var(--ink-muted)] leading-relaxed">Primero conecta tu StreamPanel en <Link to="/proveedor/configuracion" className="text-[var(--a)] font-semibold underline underline-offset-2">Configuración → Bot de códigos</Link>.</p>
          </div>
        ) : on && (
          <div className="px-3.5 pb-3.5 space-y-3.5 animate-fade-in">
            {!supported && <Alert type="warning">El bot de códigos está pensado para productos de tipo Perfil o Cuenta completa.</Alert>}
            {platforms === null ? <div className="py-3 grid place-items-center"><Spinner size={18} /></div> : (
              <>
                <div data-tour="codebot-platform">
                  <label className="label">Plataforma en tu StreamPanel</label>
                  <select className="input" value={v.platform_id || ''} onChange={e => pickPlatform(e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {!v.platform_id && <p className="text-[11px] text-[var(--status-yellow)] mt-1.5 inline-flex items-center gap-1"><IconAlertCircle size={12} />Elige la plataforma o no se crearán enlaces.</p>}
                </div>
                {current && (
                  <div data-tour="codebot-types">
                    <p className="label">Códigos que podrá pedir</p>
                    <div className="flex flex-wrap gap-1.5">
                      {current.types.map(t => {
                        const sel = (v.types || []).includes(t.id)
                        return (
                          <button key={t.id} type="button" onClick={() => toggleType(t.id)} aria-pressed={sel}
                            className={`btn-secondary btn-sm ${sel ? 'is-down !border-[var(--a-line)] !text-[var(--a)]' : ''} ${t.sensitive ? '!border-dashed' : ''}`}>
                            {sel && <IconCheck size={12} />}{t.label}{t.sensitive && <span className="text-[10px] text-[var(--status-yellow)] font-semibold ml-0.5">sensible</span>}
                          </button>
                        )
                      })}
                    </div>
                    {!(v.types || []).length && <p className="text-[11px] text-[var(--status-yellow)] mt-1.5">Sin tipos marcados se usan los básicos (sin los sensibles).</p>}
                    {(v.types || []).includes('account') && <p className="text-[11px] text-[var(--status-yellow)] mt-1.5">El código de 6 dígitos permite cambiar datos de la cuenta. Úsalo solo en cuentas completas.</p>}
                  </div>
                )}
                <p className="text-[11.5px] text-[var(--ink-muted)] leading-relaxed">
                  {deliveryType === 'perfil'
                    ? <>Cada perfil vendido recibe <b className="text-[var(--ink)] font-semibold">su propio enlace</b>, aunque compartan el mismo correo. Cada enlace dura lo mismo que su pedido.</>
                    : <>El comprador recibe un enlace que solo ve este correo y dura lo mismo que su pedido.</>}
                  {' '}Solo funciona con correos registrados en tu StreamPanel.
                </p>
                {error && <Alert type="error">{error}</Alert>}
              </>
            )}
          </div>
        )}
      </div>
    </fieldset>
  )
}
