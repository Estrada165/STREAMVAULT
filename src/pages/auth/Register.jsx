import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Alert, Spinner } from '@/components/ui'
import { LogoSV, IconSun, IconMoon, IconEyeOff, IconEye, IconInfo } from '@/assets/icons'

export default function Register() {
  const { signUp } = useAuth()
  const { toggle, isDark } = useTheme()
  const [role, setRole] = useState('distribuidor')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [providerCode, setProviderCode] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    setLoading(true)
    setError('')
    try {
      await signUp(email, password, role, providerCode, phone.trim() || null, fullName.trim() || null)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4">
        <div className="card p-8 max-w-sm w-full text-center animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-[var(--status-green-bg)] flex items-center justify-center mx-auto mb-4">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-[var(--ink)] mb-2">Registro exitoso</h2>
          <p className="text-sm text-[var(--ink-muted)] mb-5">
            {role === 'proveedor'
              ? 'Tu cuenta está pendiente de activación por el administrador. Te notificaremos pronto.'
              : 'Tu cuenta está pendiente de activación. El proveedor te dará acceso pronto.'}
          </p>
          <Link to="/login" className="btn-primary w-full justify-center">Ir al login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4 py-8">
      <button onClick={toggle} className="fixed top-4 right-4 btn-ghost p-2">
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>

      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <LogoSV size={36} className="text-[var(--ink)]" />
          <span className="font-display font-bold text-2xl tracking-tight text-[var(--ink)]">StreamVault</span>
        </div>

        <div className="card p-7">
          <h1 className="font-display font-bold text-xl text-[var(--ink)] mb-1">Crear cuenta</h1>
          <p className="text-sm text-[var(--ink-muted)] mb-5">Elige tu tipo de cuenta</p>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {['proveedor', 'distribuidor'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all text-left
                  ${role === r
                    ? 'border-[var(--ink)] bg-[var(--surface-overlay)] text-[var(--ink)]'
                    : 'border-[var(--surface-border)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)]'
                  }`}
              >
                <div className="font-semibold capitalize">{r}</div>
                <div className="text-xs text-[var(--ink-faint)] mt-0.5">
                  {r === 'proveedor' ? 'Gestiona tu tienda' : 'Compra y revende'}
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre completo</label>
              <input type="text" className="input" placeholder="Tu nombre" value={fullName}
                onChange={e => setFullName(e.target.value)} required />
            </div>

            <div>
              <label className="label">Correo electrónico</label>
              <input type="email" className="input" placeholder="tu@correo.com" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div>
              <label className="label">WhatsApp / Teléfono <span style={{ fontWeight: 400, color: 'var(--ink-faint)', textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
              <input type="tel" className="input" placeholder="+51 999 999 999" value={phone}
                onChange={e => setPhone(e.target.value)} />
              <p className="text-xs text-[var(--ink-faint)] mt-1">Para que el administrador pueda contactarte</p>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10"
                  placeholder="Mínimo 6 caracteres" value={password}
                  onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]">
                  {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {role === 'distribuidor' && (
              <div>
                <label className="label">Código de proveedor</label>
                <input type="text" className="input" placeholder="Ej: mi-tienda-123" value={providerCode}
                  onChange={e => setProviderCode(e.target.value)} required />
                <p className="text-xs text-[var(--ink-faint)] mt-1 flex items-center gap-1">
                  <IconInfo size={12} />
                  Tu proveedor te dará este código
                </p>
              </div>
            )}

            {error && <Alert type="error">{error}</Alert>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? <Spinner size={18} /> : 'Registrarse'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--ink-muted)] mt-5">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-[var(--ink)] font-semibold hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
