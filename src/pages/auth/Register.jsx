import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { APP_FULL_NAME } from '@/lib/brand'
import { Alert, Spinner } from '@/components/ui'
import { IconEyeOff, IconEye, IconInfo } from '@/assets/icons'

export default function Register() {
  const { signUp } = useAuth()
  const [params] = useSearchParams()
  const [role, setRole] = useState('distribuidor')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [providerCode, setProviderCode] = useState(params.get('codigo') || '')
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
      <>
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)] animate-pop">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 className="font-display text-2xl text-[var(--ink)] mb-2">¡Listo, <span className="grad">registrado</span>!</h2>
          <p className="text-sm text-[var(--ink-muted)] mb-6 leading-relaxed">
            {role === 'proveedor'
              ? 'Tu cuenta está pendiente de activación por el administrador. Te avisaremos pronto.'
              : 'Tu cuenta está pendiente de activación. Tu proveedor te dará acceso pronto.'}
          </p>
          <Link to="/login" className="btn-primary w-full">Ir a iniciar sesión</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="font-display text-[1.6rem] font-semibold leading-tight text-[var(--ink)]">Crea tu <span className="grad">cuenta</span></h1>
      <p className="text-sm text-[var(--ink-muted)] mt-0.5 mb-3.5">¿Cómo vas a usar {APP_FULL_NAME}?</p>

      <div className="grid grid-cols-2 gap-2.5 mb-3.5" role="radiogroup" aria-label="Tipo de cuenta">
        {[['distribuidor', 'Distribuidor', 'Compro y revendo'], ['proveedor', 'Proveedor', 'Tengo mi tienda']].map(([r, label, sub]) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
            className={`btn-secondary !h-auto !py-2 !justify-start text-left !whitespace-normal ${role === r ? 'is-down !border-[var(--a-line)]' : ''}`}>
            <span className="dot flex-shrink-0" style={{ color: role === r ? 'var(--a)' : 'var(--surface-border-strong)', boxShadow: role === r ? '0 0 8px var(--a)' : 'none' }} />
            <span><span className="block text-sm">{label}</span><span className="block text-[11px] font-medium text-[var(--ink-faint)]">{sub}</span></span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {role === 'distribuidor' && (
          <div className="animate-fade-in">
            <label className="label !flex items-center justify-between gap-2" htmlFor="code">
              Código de tu proveedor
              <span className="font-normal text-[11px] text-[var(--ink-faint)] inline-flex items-center gap-1"><IconInfo size={11} />Te lo da tu proveedor</span>
            </label>
            <input id="code" type="text" className="input !min-h-[2.6rem] font-mono" placeholder="mi-tienda" value={providerCode} onChange={e => setProviderCode(e.target.value)} required />
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="name">Nombre completo</label>
            <input id="name" type="text" className="input !min-h-[2.6rem]" placeholder="Tu nombre" value={fullName} onChange={e => setFullName(e.target.value)} required autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="phone">WhatsApp <span className="font-normal text-[var(--ink-faint)]">(opcional)</span></label>
            <input id="phone" type="tel" className="input !min-h-[2.6rem]" placeholder="+51 999 999 999" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="remail">Correo electrónico</label>
          <input id="remail" type="email" className="input !min-h-[2.6rem]" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="rpass">Contraseña</label>
          <div className="relative">
            <input id="rpass" type={showPass ? 'text' : 'password'} className="input !min-h-[2.6rem] !pr-11" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-2" aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
          {password && (
            <div className="flex gap-1 mt-2" aria-hidden="true">
              {[0, 1, 2].map(i => <span key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: password.length >= [6, 9, 12][i] ? 'var(--a)' : 'var(--surface-border)' }} />)}
            </div>
          )}
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full !mt-3.5">{loading ? <Spinner size={18} /> : 'Crear cuenta'}</button>
      </form>

      <p className="text-center text-sm text-[var(--ink-muted)] mt-4">
        ¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-[var(--a)] hover:underline">Inicia sesión</Link>
      </p>
    </>
  )
}
