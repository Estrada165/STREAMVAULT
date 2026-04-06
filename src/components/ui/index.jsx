import { IconX, IconAlertCircle, IconCheck, IconInfo } from '@/assets/icons'

// ============================================================
// BADGE
// ============================================================
export function Badge({ color = 'neutral', children, dot = false }) {
  return (
    <span className={`badge badge-${color}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full bg-current`} />}
      {children}
    </span>
  )
}

// ============================================================
// MODAL
// ============================================================
import { createPortal } from 'react-dom'

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${maxWidth} w-full`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-lg text-[var(--ink)]">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <IconX size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body  // 👈 se renderiza directo en el body, fuera del stagger
  )
} 

// ============================================================
// STAT CARD
// ============================================================
export function StatCard({ label, value, icon: Icon, color = 'neutral', sub }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
        ${color === 'green' ? 'bg-[var(--status-green-bg)] text-[var(--status-green)]' : ''}
        ${color === 'yellow' ? 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)]' : ''}
        ${color === 'red' ? 'bg-[var(--status-red-bg)] text-[var(--status-red)]' : ''}
        ${color === 'neutral' ? 'bg-[var(--surface-overlay)] text-[var(--ink-muted)]' : ''}
      `}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-[var(--ink)] leading-none mb-1">{value}</p>
        <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
        {sub && <p className="text-xs text-[var(--ink-faint)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ============================================================
// EMPTY STATE
// ============================================================
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-overlay)] flex items-center justify-center mb-4 text-[var(--ink-faint)]">
        <Icon size={28} />
      </div>
      <h3 className="font-display font-semibold text-[var(--ink)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--ink-muted)] max-w-sm mb-5">{description}</p>
      {action}
    </div>
  )
}

// ============================================================
// SPINNER
// ============================================================
export function Spinner({ size = 20 }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin-slow text-[var(--ink-faint)]"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  )
}

// ============================================================
// ALERT
// ============================================================
export function Alert({ type = 'info', children }) {
  const styles = {
    info: 'bg-[var(--surface-overlay)] text-[var(--ink-muted)] border-[var(--surface-border)]',
    success: 'bg-[var(--status-green-bg)] text-[var(--status-green)] border-[var(--status-green)]',
    warning: 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)] border-[var(--status-yellow)]',
    error: 'bg-[var(--status-red-bg)] text-[var(--status-red)] border-[var(--status-red)]',
  }
  const Icon = type === 'success' ? IconCheck : type === 'error' ? IconAlertCircle : IconInfo
  return (
    <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${styles[type]}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

// ============================================================
// PAGE HEADER
// ============================================================
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl text-[var(--ink)] mb-0.5">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--ink-muted)]">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-[var(--ink)]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ============================================================
// TOGGLE SWITCH
// ============================================================
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 flex-shrink-0
          ${checked ? 'bg-[var(--ink)]' : 'bg-[var(--surface-border)]'}`}
        style={{ height: '22px', width: '40px' }}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
      {label && <span className="text-sm text-[var(--ink-muted)]">{label}</span>}
    </label>
  )
}

// ============================================================
// TABS
// ============================================================
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-[var(--surface-overlay)] rounded-xl w-fit">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
            ${active === tab.value
              ? 'bg-[var(--surface-raised)] text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 text-xs ${active === tab.value ? 'text-[var(--ink-muted)]' : 'text-[var(--ink-faint)]'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ============================================================
// COPY FIELD
// ============================================================
import { useState } from 'react'
import { copyToClipboard } from '@/utils'
import { IconCopy, IconCheck as ICheck } from '@/assets/icons'

export function CopyField({ label, value, icon: FieldIcon, hidden = false }) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(!hidden)

  async function handleCopy() {
    await copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!value) return null

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-2 bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-xl px-3 py-2.5">
        {FieldIcon && <FieldIcon size={14} className="text-[var(--ink-faint)] flex-shrink-0" />}
        <span className={`flex-1 text-sm font-mono text-[var(--ink)] truncate ${!visible ? 'blur-sm select-none' : ''}`}>
          {value}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hidden && (
            <button onClick={() => setVisible(v => !v)} className="btn-ghost p-1 text-[var(--ink-faint)]">
              <IconEyeToggle visible={visible} />
            </button>
          )}
          <button onClick={handleCopy} className={`btn-ghost p-1 transition-colors ${copied ? 'text-[var(--status-green)]' : 'text-[var(--ink-faint)]'}`}>
            {copied ? <ICheck size={14} /> : <IconCopy size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function IconEyeToggle({ visible }) {
  if (visible) return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
