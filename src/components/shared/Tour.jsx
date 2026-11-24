// StreamVault · Guías paso a paso (se sombrea la pantalla y se ilumina una parte)
// - Cada paso apunta a un elemento con data-tour="…" (si no está visible, sale al centro).
// - Sale sola la primera vez que el usuario entra a la sección (por usuario, en este navegador).
// - Se cierra con ✕, Esc o «Saltar», y se vuelve a abrir con el botón de guía.
// Trae sus propios estilos (no depende de globals.css).
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { IconX, IconBook } from '@/assets/icons'
import { TOURS } from '@/lib/tours'

/* ══ Estado global mínimo ═════════════════════════════════ */
let state = { id: null, step: 0, userId: null }
const subs = new Set()
const set = (patch) => { state = { ...state, ...patch }; subs.forEach(f => f()) }
const useTourState = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)

const KEY = (userId, id) => `sv-tour:${userId || 'anon'}:${id}`
const wasSeen = (userId, id) => { try { return localStorage.getItem(KEY(userId, id)) === '1' } catch { return true } }
const markSeen = (userId, id) => { try { localStorage.setItem(KEY(userId, id), '1') } catch { /* ignore */ } }

export function startTour(id, userId) { if (TOURS[id]) set({ id, step: 0, userId: userId ?? state.userId }) }
function finish() { if (state.id) markSeen(state.userId, state.id); set({ id: null, step: 0 }) }
function next() { const steps = TOURS[state.id]; if (!steps) return; state.step + 1 >= steps.length ? finish() : set({ step: state.step + 1 }) }
function prev() { set({ step: Math.max(0, state.step - 1) }) }

// Abre la guía la primera vez (espera a que la página esté lista y no haya un modal encima)
export function useAutoTour(id, user, opts = {}) {
  const { ready = true, delay = 700 } = opts
  useEffect(() => {
    if (!user?.id || !ready || !TOURS[id] || wasSeen(user.id, id)) return
    // Si hay algo abierto encima (un aviso, un modal), espera a que se cierre
    let tries = 0, iv = null
    const t = setTimeout(() => {
      iv = setInterval(() => {
        if (state.id || ++tries > 40) return clearInterval(iv)
        if ((!opts.inModal && document.querySelector('[role="dialog"], .modal-overlay'))) return
        clearInterval(iv); startTour(id, user.id)
      }, 400)
    }, delay)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [id, user?.id, ready])
}

export function TourButton({ id, user, label = 'Ver guía' }) {
  useStyles()
  return (
    <button type="button" className="tour-btn" onClick={() => startTour(id, user?.id)} aria-label={label} title={label}>
      <IconBook size={15} />
    </button>
  )
}

/* ══ Host (uno solo, en el Layout) ════════════════════════ */
const PAD = 8, GAP = 14, M = 16

function findVisible(selector) {
  if (!selector) return null
  for (const sel of [].concat(selector)) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
    }
  }
  return null
}

export function TourHost() {
  useStyles()
  const { id, step } = useTourState()
  const steps = id ? TOURS[id] : null
  const cur = steps?.[step]
  const { pathname } = useLocation()
  const route = useRef(pathname)
  const cardRef = useRef(null)
  const [rect, setRect] = useState(null)
  const [cardH, setCardH] = useState(200)
  const [, force] = useState(0)

  // Cambiar de página cierra la guía (sin marcarla como vista)
  useEffect(() => { if (route.current !== pathname && state.id) set({ id: null, step: 0 }); route.current = pathname }, [pathname])
  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight) })

  useLayoutEffect(() => {
    if (!cur) return
    let el = null, alive = true, tries = 0, iv = null
    const measure = () => { if (el && alive) setRect(el.getBoundingClientRect()) }
    const onResize = () => { measure(); force(n => n + 1) }
    const hook = (e) => {
      el = e
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      measure(); setTimeout(measure, 380)
    }
    setRect(null)
    const first = findVisible(cur.target)
    if (first) hook(first)
    else if (cur.target) {
      // La sección puede estar cargando: se espera un momento
      iv = setInterval(() => { const e = findVisible(cur.target); if (e || ++tries > 12) { clearInterval(iv); if (e) hook(e) } }, 150)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', measure, true)
    return () => { alive = false; clearInterval(iv); window.removeEventListener('resize', onResize); window.removeEventListener('scroll', measure, true) }
  }, [id, step])

  useEffect(() => {
    if (!id) return
    const onKey = (e) => { if (e.key === 'Escape') finish(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id])

  if (!cur) return null

  const vw = window.innerWidth, vh = window.innerHeight
  const w = Math.min(340, vw - M * 2)
  const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))
  let pos
  if (rect) {
    const hx = rect.left - PAD, hy = rect.top - PAD, hw = rect.width + PAD * 2, hh = rect.height + PAD * 2
    const cx = clamp(hx + hw / 2 - w / 2, M, vw - w - M), cy = clamp(hy + hh / 2 - cardH / 2, M, vh - cardH - M)
    if (hy + hh + GAP + cardH <= vh - M)      pos = { left: cx, top: hy + hh + GAP }
    else if (hy - GAP - cardH >= M)           pos = { left: cx, top: hy - GAP - cardH }
    else if (hx + hw + GAP + w <= vw - M)     pos = { left: hx + hw + GAP, top: cy }
    else if (hx - GAP - w >= M)               pos = { left: hx - GAP - w, top: cy }
    else                                      pos = { left: cx, top: vh - cardH - M }
  } else pos = { left: (vw - w) / 2, top: Math.max(M, (vh - cardH) / 2) }

  const last = step === steps.length - 1
  return createPortal(
    <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect
        ? <div className="tour-hole" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
        : <div className="tour-veil" />}
      <div key={`${id}-${step}`} ref={cardRef} className="tour-card" style={{ ...pos, width: w }}>
        <button className="tour-x" onClick={finish} aria-label="Cerrar guía"><IconX size={15} /></button>
        <p className="tour-step">PASO {step + 1} DE {steps.length}</p>
        <h2 id="tour-title" className="tour-title">{cur.title}</h2>
        <p className="tour-text" dangerouslySetInnerHTML={{ __html: cur.text }} />
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">{steps.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
          {step === 0
            ? <button className="btn-ghost btn-sm" onClick={finish}>Saltar</button>
            : <button className="btn-ghost btn-sm" onClick={prev}>Atrás</button>}
          <button className="btn-primary btn-sm" onClick={next}>{last ? '¡Listo!' : 'Siguiente'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ══ Estilos ══════════════════════════════════════════════ */
const CSS = `
.tour-layer { position: fixed; inset: 0; z-index: 9000; }
.tour-hole {
  position: absolute; border-radius: 16px; pointer-events: none;
  box-shadow: 0 0 0 2px var(--a), 0 0 0 9999px rgba(10,12,18,.55);
  transition: left .32s var(--ease, cubic-bezier(.2,.8,.2,1)), top .32s var(--ease, cubic-bezier(.2,.8,.2,1)), width .32s var(--ease, cubic-bezier(.2,.8,.2,1)), height .32s var(--ease, cubic-bezier(.2,.8,.2,1));
}
.dark .tour-hole { box-shadow: 0 0 0 2px var(--a), 0 0 26px 4px color-mix(in srgb, var(--a) 40%, transparent), 0 0 0 9999px rgba(0,0,0,.78); }
.tour-veil { position: absolute; inset: 0; background: rgba(10,12,18,.55); }
.dark .tour-veil { background: rgba(0,0,0,.78); }
.tour-card {
  position: absolute; padding: 18px 18px 16px; border-radius: 1.25rem; max-height: calc(100dvh - 32px); overflow-y: auto;
  background: var(--surface-raised); border: 1px solid var(--a-line);
  box-shadow: 0 22px 60px var(--shadow), 0 0 0 1px var(--surface-border);
  animation: tourIn .22s ease both;
}
.dark .tour-card { box-shadow: 0 22px 60px rgba(0,0,0,.7), 0 0 40px color-mix(in srgb, var(--a) 18%, transparent); }
@keyframes tourIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.tour-x { position: absolute; top: 10px; right: 10px; padding: 6px; display: flex; border-radius: 9px; cursor: pointer; background: none; border: 1px solid transparent; color: var(--ink-faint); }
.tour-x:hover { color: var(--ink); border-color: var(--surface-border); }
.tour-step { margin: 0 0 4px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; color: var(--a); }
.tour-title { margin: 0 28px 6px 0; font-size: 1rem; font-weight: 700; color: var(--ink); }
.tour-text { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--ink-muted); }
.tour-text b { color: var(--ink); font-weight: 600; }
.tour-foot { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.tour-dots { display: flex; gap: 4px; margin-right: auto; }
.tour-dots span { width: 6px; height: 6px; border-radius: 99px; background: var(--surface-border-strong); transition: width .2s; }
.tour-dots span.on { width: 16px; background: var(--a); }
.tour-btn {
  width: 34px; height: 34px; border-radius: .75rem; flex-shrink: 0; cursor: pointer; display: inline-grid; place-items: center;
  color: var(--ink-muted); background: var(--key, var(--surface-raised)); border: 1px solid var(--surface-border-strong);
  box-shadow: inset 0 1px 0 var(--hl, transparent), 0 2px 0 var(--key-edge, rgba(0,0,0,.12)); transition: color .15s, border-color .15s;
}
.tour-btn:hover { color: var(--a); border-color: var(--a-line); }
.tour-btn:active { transform: translateY(2px); box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .tour-hole, .tour-card { transition: none; animation: none; } }
`
let injected = false
function useStyles() {
  useEffect(() => {
    if (injected || typeof document === 'undefined') return
    const el = document.createElement('style'); el.dataset.tour = '1'; el.textContent = CSS
    document.head.appendChild(el); injected = true
  }, [])
}
