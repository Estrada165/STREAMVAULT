import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Modal, Toggle, Alert, Spinner, useToast } from '@/components/ui'
import { useAssistantData } from '@/hooks/useAssistantData'
import AssistantChat from './AssistantChat'
import { welcomeText } from '@/lib/assistant'
import AssistantIcon from './AssistantIcon'
import { IconPlus, IconTrash } from '@/assets/icons'

const MAX_FAQS = 15
const EXAMPLES = [
  { q: 'horario, a qué hora atienden, atención', a: 'Atendemos todos los días de 9:00 a. m. a 10:00 p. m.' },
  { q: 'cambio de correo, cambiar cuenta, reemplazo', a: 'Si tu cuenta falla dentro de la garantía, la reemplazamos sin costo. Abre un ticket desde Mis pedidos.' },
]

/** Configuración del asistente (sin IA) del proveedor + vista de prueba */
export default function AssistantSettings() {
  const { provider, refreshProfile } = useAuth()
  const toast = useToast()
  const saved = provider?.assistant || {}
  const [cfg, setCfg] = useState({ enabled: true, name: '', welcome: '', faqs: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [test, setTest] = useState(false)
  const data = useAssistantData(test ? provider?.id : null)

  useEffect(() => {
    setCfg({ enabled: saved.enabled !== false, name: saved.name || '', welcome: saved.welcome || '', faqs: Array.isArray(saved.faqs) ? saved.faqs : [] })
  }, [provider?.assistant])

  const clean = c => ({
    enabled: c.enabled, name: c.name.trim().slice(0, 30), welcome: c.welcome.trim().slice(0, 300),
    faqs: c.faqs.map(f => ({ q: String(f.q || '').trim().slice(0, 160), a: String(f.a || '').trim().slice(0, 500) })).filter(f => f.q && f.a).slice(0, MAX_FAQS),
  })
  const dirty = JSON.stringify(clean(cfg)) !== JSON.stringify(clean({ enabled: saved.enabled !== false, name: saved.name || '', welcome: saved.welcome || '', faqs: saved.faqs || [] }))

  async function save() {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('providers').update({ assistant: clean(cfg) }).eq('id', provider.id)
    if (err) setError(err.message?.includes('assistant') ? 'Falta ejecutar el SQL 009 en Supabase.' : err.message)
    else { await refreshProfile(); toast.success('Asistente guardado') }
    setSaving(false)
  }

  const setFaq = (i, patch) => setCfg(c => ({ ...c, faqs: c.faqs.map((f, k) => (k === i ? { ...f, ...patch } : f)) }))
  const botName = cfg.name.trim() || 'Asistente'

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)]"><AssistantIcon size={18} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-[var(--ink)]">Asistente de tu tienda</h2>
          <p className="text-xs text-[var(--ink-muted)]">Sin IA: responde con tus productos, precios, stock, garantías y métodos de pago</p>
        </div>
        <Toggle checked={cfg.enabled} onChange={v => setCfg(c => ({ ...c, enabled: v }))} />
      </div>

      <div className={`space-y-4 ${cfg.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--ink-muted)] bg-[var(--surface-overlay)] border border-[var(--surface-border)]">
          Ya sabe responder solo, con lo que tienes en la tienda: <b className="text-[var(--ink)] font-semibold">precios y planes, comparar duraciones, qué alcanza con un presupuesto, combos, stock, garantía, términos, qué incluye</b> y las guías para recargar, comprar, renovar y pedir soporte. Abajo puedes sumarle tus propias respuestas.
        </div>
        <div className="grid sm:grid-cols-[180px_1fr] gap-3">
          <div>
            <label className="label">Nombre</label>
            <input className="input" maxLength={30} placeholder="Asistente" value={cfg.name} onChange={e => setCfg(c => ({ ...c, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Mensaje de bienvenida</label>
            <input className="input" maxLength={300} placeholder={welcomeText({ config: { name: botName }, provider })} value={cfg.welcome} onChange={e => setCfg(c => ({ ...c, welcome: e.target.value }))} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label !mb-0">Tus respuestas <span className="font-normal text-[var(--ink-faint)]">({cfg.faqs.length}/{MAX_FAQS})</span></p>
            {cfg.faqs.length === 0 && <button type="button" onClick={() => setCfg(c => ({ ...c, faqs: EXAMPLES }))} className="btn-ghost btn-sm">Usar ejemplos</button>}
          </div>
          <div className="space-y-2.5">
            {cfg.faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-[var(--surface-border)] p-3 space-y-2 animate-fade-in">
                <div className="flex gap-2">
                  <input className="input !min-h-[2.4rem] !text-[13px]" placeholder="Palabras clave, separadas por coma: horario, a qué hora atienden" value={f.q} onChange={e => setFaq(i, { q: e.target.value })} aria-label={`Palabras clave ${i + 1}`} />
                  <button type="button" onClick={() => setCfg(c => ({ ...c, faqs: c.faqs.filter((_, k) => k !== i) }))} className="btn-ghost p-2 hover:!text-[var(--status-red)]" aria-label="Quitar respuesta"><IconTrash size={14} /></button>
                </div>
                <textarea className="input !min-h-[3.5rem] !text-[13px]" rows={2} maxLength={500} placeholder="Lo que responde el asistente" value={f.a} onChange={e => setFaq(i, { a: e.target.value })} aria-label={`Respuesta ${i + 1}`} />
              </div>
            ))}
          </div>
          {cfg.faqs.length < MAX_FAQS && <button type="button" onClick={() => setCfg(c => ({ ...c, faqs: [...c.faqs, { q: '', a: '' }] }))} className="btn-secondary btn-sm mt-2.5"><IconPlus size={14} />Agregar respuesta</button>}
          <p className="text-[11px] text-[var(--ink-faint)] mt-2">Responde cuando el mensaje contiene alguna de las palabras clave. Escribe varias formas de preguntar lo mismo.</p>
        </div>
      </div>

      {error && <div className="mt-4"><Alert type="error">{error}</Alert></div>}
      <div className="flex flex-wrap gap-2 mt-5">
        <button type="button" onClick={() => setTest(true)} className="btn-secondary"><AssistantIcon size={15} />Probar asistente</button>
        {dirty && <button onClick={save} disabled={saving} className="btn-primary flex-1 min-w-[140px]">{saving ? <Spinner size={15} /> : 'Guardar asistente'}</button>}
      </div>

      <Modal open={test} onClose={() => setTest(false)} title={`Probar a ${botName}`} subtitle="Así lo ven tus distribuidores (con tus cambios, aunque no los guardes)" maxWidth="max-w-2xl">
        <div className="h-[62dvh] min-h-[380px]">
          {!data ? <div className="h-full grid place-items-center"><Spinner size={22} /></div>
            : <AssistantChat key={JSON.stringify(clean(cfg))} preview ctx={{ ...data, provider, balance: null, config: clean(cfg) }} />}
        </div>
      </Modal>
    </section>
  )
}
