import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Alert, Spinner } from '@/components/ui'
import { IconEyeOff, IconEye } from '@/assets/icons'

export default function Login() {
  const { signIn, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const justReset = location.state?.passwordReset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [didLogin, setDidLogin] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (didLogin && !loading && profile) {
      navigate('/')
    }
  }, [didLogin, loading, profile])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await signIn(email, password)
      setDidLogin(true)
    } catch (err) {
      setError('Correo o contraseña incorrectos')
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="font-display text-[1.85rem] font-semibold leading-tight text-[var(--ink)]">Bienvenido de <span className="grad">vuelta</span></h1>
      <p className="text-sm text-[var(--ink-muted)] mt-1.5 mb-6">Ingresa a tu panel</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" className="input" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </div>
        <div>
          <div className="flex items-center justify-between mb-[.4rem]">
            <label className="label !mb-0" htmlFor="password">Contraseña</label>
            <Link to="/recuperar" className="text-[12px] font-semibold text-[var(--a)] hover:underline">¿Olvidaste tu contraseña?</Link>
          </div>
          <div className="relative">
            <input id="password" type={showPass ? 'text' : 'password'} className="input !pr-11" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-2" aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
        </div>

        {justReset && !error && <Alert type="success">Contraseña actualizada. Ingresa con tu nueva contraseña.</Alert>}
        {error && <Alert type="error">{error}</Alert>}

        <button type="submit" disabled={submitting || didLogin} className="btn-primary btn-lg w-full">
          {(submitting || didLogin) ? <Spinner size={18} /> : 'Ingresar'}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--ink-muted)] mt-6">
        ¿No tienes cuenta? <Link to="/register" className="font-semibold text-[var(--a)] hover:underline">Regístrate</Link>
      </p>
    </>
  )
}
