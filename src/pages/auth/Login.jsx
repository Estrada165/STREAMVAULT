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

  // Navigate once profile is loaded after login
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

            <button type="submit" disabled={submitting || didLogin} className="btn-primary w-full justify-center py-2.5">
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
      </div>
    </div>
  )
}