import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Alert, Spinner } from '@/components/ui'
import { IconMail, IconChevronLeft } from '@/assets/icons'

/** Paso 1: pedir el enlace para crear una contraseña nueva */
export default function Recuperar() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSending(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })
    setSending(false)
    if (err) {
      if (/only request this after|rate limit|too many/i.test(err.message)) return setError('Ya pediste un enlace hace poco. Espera un minuto e intenta de nuevo.')
      if (/invalid.*email|email.*invalid/i.test(err.message)) return setError('Escribe un correo válido.')
      // Por seguridad no decimos si el correo existe o no
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)] animate-pop"><IconMail size={24} /></div>
        <h1 className="font-display text-[1.5rem] font-semibold text-[var(--ink)]">Revisa tu correo</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">
          Si <b className="text-[var(--ink)]">{email}</b> tiene una cuenta, te llegará un enlace para crear una contraseña nueva. Revisa también spam o promociones.
        </p>
        <p className="text-xs text-[var(--ink-faint)] mt-3">El enlace vence en 1 hora y solo sirve una vez.</p>
        <Link to="/login" className="btn-primary w-full mt-6">Volver a iniciar sesión</Link>
        <button onClick={() => setSent(false)} className="btn-ghost btn-sm mt-2 mx-auto">Usar otro correo</button>
      </div>
    )
  }

  return (
    <>
      <Link to="/login" className="btn-ghost btn-sm -ml-2 mb-3"><IconChevronLeft size={15} />Volver</Link>
      <h1 className="font-display text-[1.6rem] font-semibold leading-tight text-[var(--ink)]">Recupera tu <span className="grad">acceso</span></h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1.5 mb-6">Te enviamos un enlace para crear una contraseña nueva.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="remail">Correo de tu cuenta</label>
          <input id="remail" type="email" className="input" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </div>
        {error && <Alert type="error">{error}</Alert>}
        <button type="submit" disabled={sending} className="btn-primary btn-lg w-full">{sending ? <Spinner size={18} /> : 'Enviar enlace'}</button>
      </form>
    </>
  )
}
