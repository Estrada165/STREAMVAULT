import { useState, useEffect } from 'react'
import { BRAND_DUOS, COLOR_USES, parseCustom, encodeCustom, resolveBrand } from '@/lib/brand'
import { useTheme } from '@/context/ThemeContext'
import { IconCheck, IconStore, IconPalette, IconRefreshCw } from '@/assets/icons'

// Selector de colores (dúos + personalizado) con explicación de usos y vista previa.
// Lo usan el proveedor (colores de su tienda) y el distribuidor (colores de su panel).

const HEX_RE = /^#[0-9a-f]{6}$/i

/** Un color personalizable: muestra, selector, código y para qué se usa */
function ColorPicker({ label, hint, value, onChange, uses, tone }) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-side)] p-3.5">
      <div className="flex items-center gap-3">
        <label className="relative w-12 h-12 rounded-xl flex-shrink-0 cursor-pointer border border-[var(--surface-border-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_3px_0_var(--key-edge)] overflow-hidden" style={{ background: value }}>
          <input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={`Elegir ${label.toLowerCase()}`} />
        </label>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--ink)]">{label}</p>
          <p className="text-[11px] text-[var(--ink-faint)]">{hint}</p>
        </div>
        <input
          className="input !w-[104px] !min-h-[2.4rem] font-mono text-[13px] uppercase"
          value={text}
          maxLength={7}
          onChange={e => {
            let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v
            setText(v)
            if (HEX_RE.test(v)) onChange(v.toUpperCase())
          }}
          aria-label={`Código de ${label.toLowerCase()}`}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {uses.map(u => <li key={u} className={`badge ${tone === 'a' ? 'badge-green' : 'badge-violet'} !h-auto !py-1 !text-[11px] !font-medium`}>{u}</li>)}
      </ul>
    </div>
  )
}

/** Vista previa en miniatura de cómo se ven los colores en el panel */
function BrandPreview() {
  return (
    <div className="inset p-4 space-y-3" aria-label="Vista previa">
      <div className="flex items-center justify-between gap-3">
        <span className="nav-item active !min-h-[2.4rem] !text-[13px] flex-1 pointer-events-none"><IconStore size={16} />Tienda<span className="nav-ind" /></span>
        <span className="font-mono text-lg grad font-medium">$ 48.50</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="btn-primary btn-sm pointer-events-none">Comprar</span>
        <span className="badge badge-green"><span className="dot dot-glow" />12 disp.</span>
        <span className="badge badge-violet">A pedido</span>
        <span className="badge badge-violet"><IconRefreshCw size={11} />Renovable</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, var(--a), var(--b))' }} />
    </div>
  )
}

export default function BrandColors({ value, onChange, inheritLabel = null, inheritValue = null }) {
  const custom = parseCustom(value)
  const isCustom = !!custom
  const { isDark } = useTheme()
  // Al pasar a personalizado se parte del dúo que estaba elegido
  const startCustom = () => {
    const base = resolveBrand(value || inheritValue)
    onChange(encodeCustom(base.a.l, base.b.l))
  }
  return (
    <div>
      <p className="label !flex items-center gap-1.5"><IconPalette size={13} />Colores de tu tienda</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {inheritLabel && (() => {
          const on = !value
          const base = resolveBrand(inheritValue)
          return (
            <button type="button" onClick={() => onChange(null)} aria-pressed={on}
              className={`btn-secondary btn-sm !justify-start !h-auto !py-2.5 !whitespace-normal text-left col-span-full ${on ? 'is-down !border-[var(--a-line)]' : ''}`}>
              <span className="flex -space-x-1.5 flex-shrink-0">
                <span className="w-5 h-5 rounded-full border-2 border-[var(--surface-raised)]" style={{ background: isDark ? base.a.d : base.a.l }} />
                <span className="w-5 h-5 rounded-full border-2 border-[var(--surface-raised)]" style={{ background: isDark ? base.b.d : base.b.l }} />
              </span>
              <span className="text-[12px] leading-tight">{inheritLabel}<span className="block text-[10.5px] font-medium text-[var(--ink-faint)]">Si tu proveedor cambia sus colores, tú también</span></span>
              {on && <IconCheck size={13} className="ml-auto text-[var(--a)] flex-shrink-0" />}
            </button>
          )
        })()}
        {Object.entries(BRAND_DUOS).map(([key, duo]) => {
          const on = value === key
          return (
            <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={on}
              className={`btn-secondary btn-sm !justify-start !h-auto !py-2.5 !whitespace-normal text-left ${on ? 'is-down !border-[var(--a-line)]' : ''}`}>
              <span className="flex -space-x-1.5 flex-shrink-0">
                <span className="w-5 h-5 rounded-full border-2 border-[var(--surface-raised)]" style={{ background: isDark ? duo.a.d : duo.a.l }} />
                <span className="w-5 h-5 rounded-full border-2 border-[var(--surface-raised)]" style={{ background: isDark ? duo.b.d : duo.b.l }} />
              </span>
              <span className="text-[12px] leading-tight">{duo.label}</span>
              {on && <IconCheck size={13} className="ml-auto text-[var(--a)] flex-shrink-0" />}
            </button>
          )
        })}
        <button type="button" onClick={() => !isCustom && startCustom()} aria-pressed={isCustom}
          className={`btn-secondary btn-sm !justify-start !h-auto !py-2.5 !whitespace-normal text-left col-span-full ${isCustom ? 'is-down !border-[var(--a-line)]' : ''}`}>
          <span className="w-[30px] h-5 rounded-full flex-shrink-0 border-2 border-[var(--surface-raised)]" style={{ background: 'conic-gradient(from 90deg, #F43F5E, #F59E0B, #22C55E, #06B6D4, #6366F1, #D946EF, #F43F5E)' }} />
          <span className="text-[12px] leading-tight">Personalizado<span className="block text-[10.5px] font-medium text-[var(--ink-faint)]">Elige tus dos colores</span></span>
          {isCustom && <IconCheck size={13} className="ml-auto text-[var(--a)] flex-shrink-0" />}
        </button>
      </div>

      {isCustom && (
        <div className="mt-3 space-y-2.5 animate-fade-in">
          <ColorPicker label="Color principal" hint="El protagonista de tu panel" tone="a" uses={COLOR_USES.a} value={custom.a} onChange={a => onChange(encodeCustom(a, custom.b))} />
          <ColorPicker label="Color secundario" hint="Acompaña y resalta detalles" tone="b" uses={COLOR_USES.b} value={custom.b} onChange={b => onChange(encodeCustom(custom.a, b))} />
          <p className="text-[11px] text-[var(--ink-faint)] leading-relaxed">Ajustamos el brillo de cada color automáticamente para que se lea bien en modo claro y en modo oscuro.</p>
        </div>
      )}

      {!isCustom && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2 text-[11.5px] text-[var(--ink-muted)]">
          <p className="flex gap-2"><span className="dot mt-1.5" style={{ color: 'var(--a)' }} /><span><b className="text-[var(--ink)] font-semibold">Principal:</b> {COLOR_USES.a.slice(0, 3).join(', ').toLowerCase()}.</span></p>
          <p className="flex gap-2"><span className="dot mt-1.5" style={{ color: 'var(--b)' }} /><span><b className="text-[var(--ink)] font-semibold">Secundario:</b> {COLOR_USES.b.slice(0, 3).join(', ').toLowerCase()}.</span></p>
        </div>
      )}

      <div className="mt-3"><BrandPreview /></div>
      <p className="text-[11px] text-[var(--ink-faint)] mt-2">Lo ves aplicado al instante. Tus distribuidores lo verán cuando guardes.</p>
    </div>
  )
}

