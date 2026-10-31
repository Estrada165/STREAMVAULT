import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconX, IconAlertCircle, IconCheck, IconInfo, IconCopy } from '@/assets/icons'
import { copyToClipboard } from '@/utils'

export { ToastProvider, useToast, useConfirm } from './feedback'

// ============================================================
// BADGE
// ============================================================
export function Badge({ color = 'neutral', children, dot = false, className = '' }) {
  return (
    <span className={`badge badge-${color} ${className}`}>
      {dot && <span className={`dot ${color === 'green' ? 'dot-glow' : ''}`} />}
      {children}
    </span>
  )
}

// ============================================================
// MODAL — en escritorio centrado, en móvil hoja desde abajo
// ============================================================
export function Modal({ open, onClose, title, subtitle, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal-content ${maxWidth} w-full`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-[1.15rem] leading-tight text-[var(--ink)]">{title}</h2>
            {subtitle && <p className="text-sm text-[var(--ink-muted)] mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost p-2 -mr-2 -mt-1 flex-shrink-0" aria-label="Cerrar">
            <IconX size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2.5 mt-6">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// ============================================================
// STAT CARD
// ============================================================
const STAT_TONE = {
  green: 'text-[var(--a)] bg-[var(--a-soft)] border-[var(--a-line)]',
  violet: 'text-[var(--b)] bg-[var(--b-soft)] border-[var(--b-line)]',
  yellow: 'text-[var(--status-yellow)] bg-[var(--status-yellow-bg)] border-[var(--status-yellow-border)]',
  red: 'text-[var(--status-red)] bg-[var(--status-red-bg)] border-[var(--status-red-border)]',
  neutral: 'text-[var(--ink-muted)] bg-[var(--surface-overlay)] border-[var(--surface-border)]',
}
export function StatCard({ label, value, icon: Icon, color = 'neutral', sub, highlight = false, loading = false }) {
  return (
    <div className={`card card-hover p-5 flex flex-col gap-3 min-w-0 ${highlight ? 'card-sig' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow truncate">{label}</span>
        {Icon && (
          <span className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${STAT_TONE[color] || STAT_TONE.neutral}`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      {loading
        ? <div className="sk h-8 w-24" />
        : <p className={`font-mono text-[1.75rem] leading-none font-medium tracking-tight truncate ${highlight ? 'grad' : 'text-[var(--ink)]'}`}>{value}</p>}
      {sub && <p className="text-xs text-[var(--ink-muted)] truncate">{sub}</p>}
    </div>
  )
}

// ============================================================
// EMPTY STATE
// ============================================================
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4 animate-fade-in">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl inset flex items-center justify-center mb-4 text-[var(--ink-faint)]">
          <Icon size={26} />
        </div>
      )}
      <h3 className="font-display font-semibold text-[var(--ink)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--ink-muted)] max-w-sm mb-5">{description}</p>}
      {action}
    </div>
  )
}

// ============================================================
// SPINNER y SILUETAS
// ============================================================
export function Spinner({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin-slow" aria-label="Cargando">
      <circle cx="12" cy="12" r="9" stroke="var(--surface-border-strong)" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--a)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function Skeleton({ className = '', style }) {
  return <div className={`sk ${className}`} style={style} />
}

/** Bloque de carga genérico para listas/tablas */
export function SkeletonList({ rows = 5, avatar = true }) {
  return (
    <div className="card p-2 divide-y divide-[var(--surface-border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          {avatar && <div className="sk w-10 h-10 rounded-xl flex-shrink-0" />}
          <div className="flex-1 space-y-2">
            <div className="sk h-3" style={{ width: `${60 - (i % 3) * 12}%` }} />
            <div className="sk h-2.5" style={{ width: `${35 + (i % 2) * 10}%` }} />
          </div>
          <div className="sk h-7 w-20 rounded-full hidden sm:block" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 8, height = 260 }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="sk rounded-none" style={{ height: height * 0.45 }} />
          <div className="p-4 space-y-3">
            <div className="sk h-4 w-3/4" />
            <div className="sk h-3 w-1/2" />
            <div className="sk h-10 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Carga a pantalla completa de una página (reemplaza el spinner centrado) */
export function PageLoader({ variant = 'list' }) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-2">
        <div className="sk h-8 w-56" />
        <div className="sk h-4 w-72 max-w-full" />
      </div>
      {variant === 'grid' ? <SkeletonGrid /> : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map(i => <div key={i} className="card p-5 space-y-3"><div className="sk h-3 w-20" /><div className="sk h-7 w-16" /></div>)}
          </div>
          <SkeletonList />
        </>
      )}
    </div>
  )
}

// ============================================================
// ALERT
// ============================================================
export function Alert({ type = 'info', children }) {
  const styles = {
    info: 'bg-[var(--surface-overlay)] text-[var(--ink-muted)] border-[var(--surface-border)]',
    success: 'bg-[var(--a-soft)] text-[var(--a)] border-[var(--a-line)]',
    warning: 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)] border-[var(--status-yellow-border)]',
    error: 'bg-[var(--status-red-bg)] text-[var(--status-red)] border-[var(--status-red-border)]',
  }
  const Icon = type === 'success' ? IconCheck : type === 'error' || type === 'warning' ? IconAlertCircle : IconInfo
  return (
    <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm leading-relaxed animate-fade-in ${styles[type]}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ============================================================
// PAGE HEADER
// ============================================================
export function PageHeader({ title, accent, subtitle, action, eyebrow }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6 md:mb-8 animate-slide-up">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[1.75rem] md:text-[2.125rem] leading-[1.05] text-[var(--ink)]">
          {title}{accent && <> <span className="ser grad">{accent}</span></>}
        </h1>
        {subtitle && <p className="text-sm text-[var(--ink-muted)] mt-1.5">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2.5">{action}</div>}
    </div>
  )
}

// ============================================================
// SECTION
// ============================================================
export function Section({ title, children, action }) {
  return (
    <div className="mb-6">
      {title && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display font-semibold text-[1.05rem] text-[var(--ink)]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ============================================================
// TOGGLE
// ============================================================
export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`inline-flex items-center gap-2.5 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className="relative flex-shrink-0 rounded-full border transition-colors duration-200"
        style={{
          width: 46, height: 26,
          background: checked ? 'var(--a-soft)' : 'var(--surface-overlay)',
          borderColor: checked ? 'var(--a-line)' : 'var(--surface-border)',
          boxShadow: 'inset 0 2px 4px var(--shadow-in)',
        }}
      >
        <span
          className="absolute top-[2px] left-[2px] rounded-full"
          style={{
            width: 20, height: 20,
            background: checked ? 'var(--a)' : 'var(--key)',
            boxShadow: checked ? '0 0 10px var(--a-glow), inset 0 1px 0 rgba(255,255,255,.35)' : 'inset 0 1px 0 var(--hl), 0 2px 0 var(--key-edge), 0 2px 5px var(--shadow)',
            transform: checked ? 'translateX(20px)' : 'none',
            transition: 'transform .3s cubic-bezier(.3,1.5,.5,1), background .2s',
          }}
        />
      </button>
      {label && <span className="text-sm text-[var(--ink-muted)]">{label}</span>}
    </label>
  )
}

// ============================================================
// TABS — pestañas tipo tecla, desplazables en móvil
// ============================================================
export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`inset flex gap-1 p-1 w-full sm:w-fit max-w-full overflow-x-auto no-scrollbar ${className}`} role="tablist">
      {tabs.map(tab => {
        const on = active === tab.value
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.value)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-[.6rem] text-[.8125rem] font-semibold transition-all duration-150 border
              ${on
                ? 'bg-[var(--key)] text-[var(--ink)] border-[var(--surface-border-strong)] shadow-[inset_0_1px_0_var(--hl),0_2px_0_var(--key-edge),0_4px_10px_var(--shadow)]'
                : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`font-mono text-[11px] ${on ? 'text-[var(--a)]' : 'text-[var(--ink-faint)]'}`}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// COPY FIELD
// ============================================================
export function CopyField({ label, value, icon: FieldIcon, hidden = false }) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(!hidden)

  async function handleCopy() {
    await copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (!value) return null

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="inset flex items-center gap-2 pl-3 pr-1.5 py-1.5">
        {FieldIcon && <FieldIcon size={14} className="text-[var(--ink-faint)] flex-shrink-0" />}
        <span className={`flex-1 min-w-0 text-sm font-mono text-[var(--ink)] truncate transition-[filter] ${!visible ? 'blur-[5px] select-none' : ''}`}>
          {value}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hidden && (
            <button onClick={() => setVisible(v => !v)} className="btn-ghost p-2" aria-label={visible ? 'Ocultar' : 'Mostrar'}>
              <IconEyeToggle visible={visible} />
            </button>
          )}
          <button
            onClick={handleCopy}
            aria-label="Copiar"
            className={`btn-secondary btn-sm btn-icon ${copied ? '!text-[var(--a)] !border-[var(--a-line)]' : ''}`}
          >
            {copied ? <IconCheck size={14} className="animate-pop" /> : <IconCopy size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function IconEyeToggle({ visible }) {
  if (visible) return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
