import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Alert, Spinner, useToast, useConfirm } from '@/components/ui'
import { codebot, useCodebotStatus, clearCodebotCache } from '@/lib/codebot'
import { TourButton, useAutoTour } from './Tour'
import { formatDate } from '@/utils'
import { IconKey, IconPower, IconCheck, IconZap } from '@/assets/icons'

/** Configuración → Bot de códigos: conecta la tienda con el StreamPanel del proveedor */
export default function CodeBotSettings() {
  const { profile } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { status, reload } = useCodebotStatus()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useAutoTour('codebot-connect', profile, { ready: status !== null })

  async function connect() {
    setBusy(true); setError('')
    try {
      const r = await codebot('connect', { token: token.trim() })
      clearCodebotCache(); setToken(''); await reload()
      toast.success(r.synced ? `Conectado · ${r.synced} pedido${r.synced === 1 ? '' : 's'} activo${r.synced === 1 ? '' : 's'} recibieron su enlace` : 'StreamPanel conectado')
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function disconnect() {
    const ok = await confirm({ title: '¿Desconectar StreamPanel?', message: 'Las ventas nuevas ya no crearán enlaces de códigos. Los enlaces que ya entregaste siguen funcionando hasta su fecha.', danger: true, confirmText: 'Desconectar' })
    if (!ok) return
    setBusy(true)
    try { await codebot('disconnect'); clearCodebotCache(); await reload(); toast('StreamPanel desconectado') }
    catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  const on = status?.connected
  return (
    <section className="card p-5 sm:p-6" data-tour="codebot-card">
      <div className="flex items-start gap-3 mb-4">
        <span className={`w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 border ${on ? 'bg-[var(--a-soft)] border-[var(--a-line)] text-[var(--a)]' : 'inset text-[var(--ink-faint)]'}`}><IconZap size={18} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-[var(--ink)]">Bot de códigos</h2>
          <p className="text-xs text-[var(--ink-muted)]">Conecta tu StreamPanel: cada venta entrega al comprador su enlace para sacar códigos</p>
        </div>
        <TourButton id="codebot-connect" user={profile} label="Ver guía del bot de códigos" />
      </div>

      {status === null ? <div className="py-6 grid place-items-center"><Spinner size={20} /></div> : (
        <div className="space-y-4">
          {status.missingSql && <Alert type="warning">Falta ejecutar el SQL 012 (bot de códigos) en Supabase.</Alert>}

          <div className={`rounded-xl px-3.5 py-3 flex items-center gap-3 border ${on ? 'border-[var(--a-line)] bg-[var(--a-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-overlay)]'}`}>
            <span className={`dot ${on ? 'dot-glow' : ''}`} style={{ color: on ? 'var(--a)' : 'var(--ink-faint)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--ink)]">{on ? <>Conectado a <span className="text-[var(--a)]">{status.panel_name || 'StreamPanel'}</span></> : 'Sin conectar'}</p>
              <p className="text-[11.5px] text-[var(--ink-muted)]">
                {on ? <>Desde el {formatDate(status.connected_at)}{status.last_ok_at ? ' · funcionando' : ''}</> : 'Pega la clave que generas en tu StreamPanel.'}
              </p>
            </div>
            {on && <span className="badge badge-green"><IconCheck size={11} />Activo</span>}
          </div>

          {on && status.last_error && (
            <Alert type="warning">Último error: {status.last_error}. Si cambiaste la clave en StreamPanel, pega la nueva.</Alert>
          )}

          <div data-tour="codebot-key">
            <label className="label">{on ? 'Cambiar clave' : 'Clave de StreamPanel'}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="relative flex-1">
                <IconKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
                <input className="input input-icon font-mono !text-[13px]" placeholder="spk_…" value={token} onChange={e => setToken(e.target.value.trim())} autoComplete="off" spellCheck={false} aria-label="Clave de StreamPanel" />
              </label>
              <button onClick={connect} disabled={busy || !token.startsWith('spk_')} className="btn-primary sm:min-w-[120px]">{busy ? <Spinner size={15} /> : on ? 'Actualizar' : 'Conectar'}</button>
            </div>
            <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">En StreamPanel: Configuración → Tienda StreamVault → Generar clave.</p>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          {on && (
            <button onClick={disconnect} disabled={busy} className="btn-ghost btn-sm hover:!text-[var(--status-red)]"><IconPower size={14} />Desconectar</button>
          )}
        </div>
      )}
    </section>
  )
}
