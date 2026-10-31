import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Alert, Spinner } from '@/components/ui'
import { IconEye, IconEyeOff, IconAlertCircle } from '@/assets/icons'

/** Paso 2: el enlace del correo abre esta pantalla para poner la contraseña nueva */
export default function NuevaContrasena() {
  const navigate = useNavigate()
  const [state, setState] = useState('checking') // checking | ready | invalid
  const [linkError, setLinkError] = useState('')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Enlace vencido o ya usado: Supabase lo indica en la URL
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    const err = params.get('error_description') || params.get('error')
    if (err) {
      setLinkError(/expired|invalid/i.test(err) ? 'El enlace venció o ya se usó.' : decodeURIComponent(err.replace(/\+/g, ' ')))
      setState('invalid'); return
    }
    let done = false
    const ok = () => { if (!done) { done = true; setState('ready') } }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) ok()
    })
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) ok() })
    const t = setTimeout(() => { if (!done) { done = true; setLinkError('Abre esta página desde el enlace que te enviamos por correo.'); setState('invalid') } }, 4000)
    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (pass.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (pass !== confirm) return setError('Las contraseñas no coinciden')
    setSaving(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    if (err) {
      setSaving(false)
      return setError(/different from the old|same/i.test(err.message) ? 'Usa una contraseña distinta a la anterior.' : err.message)
    }
    await supabase.auth.signOut()
    navigate('/login', { replace: true, state: { passwordReset: true } })
  }

  if (state === 'checking') return <div className="h-60 grid place-items-center"><Spinner size={24} /></div>

  if (state === 'invalid') {
    return (
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center bg-[var(--status-yellow-bg)] border border-[var(--status-yellow-border)] text-[var(--status-yellow)]"><IconAlertCircle size={24} /></div>
        <h1 className="font-display text-[1.4rem] font-semibold text-[var(--ink)]">Enlace no válido</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-2">{linkError} Pide uno nuevo y ábrelo antes de 1 hora.</p>
        <Link to="/recuperar" className="btn-primary w-full mt-6">Pedir un enlace nuevo</Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="font-display text-[1.6rem] font-semibold leading-tight text-[var(--ink)]">Crea tu nueva <span className="grad">contraseña</span></h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1.5 mb-6">Después ingresarás con ella.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="np1">Nueva contraseña</label>
          <div className="relative">
            <input id="np1" type={show ? 'text' : 'password'} className="input !pr-11" placeholder="Mínimo 6 caracteres" value={pass} onChange={e => setPass(e.target.value)} required autoComplete="new-password" autoFocus />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-2" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <IconEyeOff size={16} /> : <IconEye size={16} />}</button>
          </div>
          {pass && (
            <div className="flex gap-1 mt-2" aria-hidden="true">
              {[0, 1, 2].map(i => <span key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: pass.length >= [6, 9, 12][i] ? 'var(--a)' : 'var(--surface-border)' }} />)}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="np2">Repite la contraseña</label>
          <input id="np2" type={show ? 'text' : 'password'} className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
        </div>
        {error && <Alert type="error">{error}</Alert>}
        <button type="submit" disabled={saving} className="btn-primary btn-lg w-full">{saving ? <Spinner size={18} /> : 'Guardar contraseña'}</button>
      </form>
    </>
  )
}
