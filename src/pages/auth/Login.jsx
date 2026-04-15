import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Alert, Spinner } from '@/components/ui'
import { LogoSV, IconSun, IconMoon, IconEyeOff, IconEye } from '@/assets/icons'

export default function Login() {
  const { signIn, profile, loading } = useAuth()
  const { toggle, isDark } = useTheme()
  const navigate = useNavigate()
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
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4">
      {/* Theme toggle */}
      <button onClick={toggle} className="fixed top-4 right-4 btn-ghost p-2">
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>

      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <LogoSV size={36} className="text-[var(--ink)]" />
          <span className="font-display font-bold text-2xl tracking-tight text-[var(--ink)]">StreamVault</span>
        </div>

        <div className="card p-7">
          <h1 className="font-display font-bold text-xl text-[var(--ink)] mb-1">Iniciar sesión</h1>
          <p className="text-sm text-[var(--ink-muted)] mb-6">Accede a tu panel de gestión</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
                >
                  {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            <button
              type="submit"
              disabled={submitting || didLogin}
              className="btn-primary w-full justify-center py-2.5"
            >
              {(submitting || didLogin) ? <Spinner size={18} /> : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--ink-muted)] mt-5">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-[var(--ink)] font-semibold hover:underline">
            Regístrate
          </Link>
        </p>

        <p className="text-center text-xs text-[var(--ink-faint)] mt-4">
          {'Desarrollado por '}
          <a
            href="https://wa.me/51970765248?text=Hola%2C%20vi%20tu%20p%C3%A1gina%20de%20StreamVault%2C%20me%20gustar%C3%ADa%20hacer%20una%20consulta"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[var(--ink-muted)] hover:text-[#25D366] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Carlos Estrada
          </a>
        </p>
      </div>
    </div>
  )
}