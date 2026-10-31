import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { IconX, IconLink, IconBell, IconChevronLeft, IconChevronRight } from '@/assets/icons'

const TONE = {
  a: { line: 'var(--a)', soft: 'var(--a-soft)', border: 'var(--a-line)', text: 'var(--a)' },
  b: { line: 'var(--b)', soft: 'var(--b-soft)', border: 'var(--b-line)', text: 'var(--b)' },
  neutral: { line: 'var(--ink-faint)', soft: 'var(--surface-overlay)', border: 'var(--surface-border-strong)', text: 'var(--ink-muted)' },
}

/**
 * Imagen de aviso: SIEMPRE se ve completa (sea cuadrada, vertical u horizontal),
 * sobre un fondo difuminado de la misma imagen que rellena el marco.
 */
export function AnnImage({ src, className = 'aspect-[16/9]' }) {
  const [err, setErr] = useState(false)
  if (!src || err) return null
  return (
    <div className={`ann-img ${className}`}>
      <img src={src} alt="" aria-hidden="true" className="ann-img-bg" />
      <img src={src} alt="" className="ann-img-fg" onError={() => setErr(true)} />
    </div>
  )
}

/** Tarjeta de aviso tal como la ven los distribuidores */
export function AnnouncementCard({ ann, from, compact = false }) {
  const t = TONE[ann.tone] || TONE.a
  return (
    <div className="overflow-hidden rounded-[1.25rem] border bg-[var(--surface-raised)] h-full flex flex-col" style={{ borderColor: t.border }}>
      {ann.image_url
        ? <AnnImage key={ann.image_url} src={ann.image_url} className={compact ? 'aspect-[2/1]' : 'aspect-[16/9]'} />
        : <div className="h-2 flex-shrink-0" style={{ background: `linear-gradient(90deg, ${t.line}, var(--b))` }} />}
      <div className={compact ? 'p-4' : 'p-5'}>
        {from && <p className="eyebrow mb-2 flex items-center gap-1.5" style={{ color: t.text }}><IconBell size={12} />Aviso de {from}</p>}
        <h3 className={`font-display font-semibold leading-tight text-[var(--ink)] ${compact ? 'text-[1.05rem]' : 'text-[1.25rem]'}`}>{ann.title || 'Título del aviso'}</h3>
        {ann.message && <p className="text-[14px] text-[var(--ink-muted)] leading-relaxed mt-2 whitespace-pre-wrap">{ann.message}</p>}
        {ann.link_url && (
          <a href={ann.link_url} target="_blank" rel="noreferrer" className="btn-accent btn-sm mt-4"><IconLink size={14} />{ann.link_label || 'Ver más'}</a>
        )}
      </div>
    </div>
  )
}

// ---- Se recuerda en este navegador ----
// SEEN: ya se mostró en la ventana de bienvenida · OPENED: ya lo abrió desde el botón Avisos
const SEEN = 'sv-ann-seen', OPENED = 'sv-ann-opened'
const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
function mark(key, ids) {
  try { localStorage.setItem(key, JSON.stringify([...new Set([...ids, ...read(key)])].slice(0, 100))) } catch {}
  window.dispatchEvent(new Event('sv-ann-seen'))
}

function useActiveAnnouncements() {
  const { profile, provider } = useAuth()
  const [list, setList] = useState([])
  useEffect(() => {
    if (profile?.role !== 'distribuidor' || !provider?.id) return
    supabase.from('announcements').select('*').eq('provider_id', provider.id).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return
        const now = new Date()
        setList((data || []).filter(a => a.is_active && new Date(a.starts_at) <= now && (!a.ends_at || new Date(a.ends_at) > now)))
      })
  }, [profile?.role, provider?.id])
  return list
}

function useUnseen(list, key = SEEN) {
  const calc = useCallback(() => { const s = read(key); return list.filter(a => !s.includes(a.id)) }, [list, key])
  const [unseen, setUnseen] = useState(calc)
  useEffect(() => {
    setUnseen(calc())
    const on = () => setUnseen(calc())
    window.addEventListener('sv-ann-seen', on)
    return () => window.removeEventListener('sv-ann-seen', on)
  }, [calc])
  return unseen
}

/**
 * Visor de avisos: uno solo se muestra tal cual; varios van en carrusel
 * (flechas, puntos y deslizar con el dedo).
 */
function AnnouncementsViewer({ list, from, onClose, closeLabel = 'Entendido' }) {
  const [i, setI] = useState(0)
  const startX = useRef(null)
  const n = list.length
  const go = d => setI(x => Math.min(n - 1, Math.max(0, x + d)))

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  })

  return createPortal(
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative w-full max-w-md animate-pop" role="dialog" aria-modal="true" aria-label="Avisos">
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 btn-secondary btn-icon btn-sm !rounded-full" aria-label="Cerrar avisos"><IconX size={15} /></button>
        <div
          className="overflow-hidden rounded-[1.25rem] touch-pan-y"
          onPointerDown={e => { startX.current = e.clientX }}
          onPointerUp={e => { if (startX.current === null) return; const dx = e.clientX - startX.current; if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); startX.current = null }}
        >
          <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${i * 100}%)`, transitionTimingFunction: 'var(--ease)' }}>
            {list.map(a => (
              <div key={a.id} className="w-full flex-shrink-0 max-h-[78dvh] overflow-y-auto"><AnnouncementCard ann={a} from={from} /></div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5 mt-3">
          {n > 1 && (
            <div className="flex items-center gap-1.5 rounded-2xl px-2 py-1.5 bg-[var(--surface-raised)] border border-[var(--surface-border)]">
              <button onClick={() => go(-1)} disabled={i === 0} className="btn-ghost p-1.5 disabled:opacity-30" aria-label="Aviso anterior"><IconChevronLeft size={16} /></button>
              <div className="flex gap-1.5" role="tablist">
                {list.map((a, k) => (
                  <button key={a.id} onClick={() => setI(k)} aria-label={`Aviso ${k + 1} de ${n}`} aria-selected={k === i}
                    className="h-2 rounded-full transition-all duration-300" style={{ width: k === i ? 18 : 8, background: k === i ? 'var(--a)' : 'var(--surface-border-strong)' }} />
                ))}
              </div>
              <button onClick={() => go(1)} disabled={i === n - 1} className="btn-ghost p-1.5 disabled:opacity-30" aria-label="Aviso siguiente"><IconChevronRight size={16} /></button>
            </div>
          )}
          <button onClick={() => (i < n - 1 ? go(1) : onClose())} className="btn-primary flex-1">{i < n - 1 ? 'Siguiente' : closeLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Al entrar: muestra los avisos que aún no vio (todos juntos en carrusel) */
export function AnnouncementPopup() {
  const { provider } = useAuth()
  const all = useActiveAnnouncements()
  const unseen = useUnseen(all)
  const [dismissed, setDismissed] = useState(false)
  if (!unseen.length || dismissed) return null
  return <AnnouncementsViewer list={unseen} from={provider?.display_name} onClose={() => { mark(SEEN, unseen.map(a => a.id)); setDismissed(true) }} />
}

/**
 * Botón "Avisos" para la tienda. Si hay avisos sin ver, la campana se mueve
 * y lleva un contador que late. Al tocarlo se abren todos los avisos vigentes.
 */
export function AnnouncementsButton({ className = '' }) {
  const { provider } = useAuth()
  const all = useActiveAnnouncements()
  const unseen = useUnseen(all, OPENED)
  const [open, setOpen] = useState(false)
  if (!all.length) return null
  const fresh = unseen.length > 0
  return (
    <>
      <button onClick={() => setOpen(true)} className={`btn-secondary relative ${fresh ? 'ann-btn-fresh !border-[var(--b-line)]' : ''} ${className}`} aria-label={`Avisos de ${provider?.display_name || 'tu proveedor'}${fresh ? `, ${unseen.length} nuevo${unseen.length === 1 ? '' : 's'}` : ''}`}>
        <span className={fresh ? 'ann-bell text-[var(--b)]' : 'text-[var(--ink-muted)]'}><IconBell size={16} /></span>
        Avisos
        {fresh
          ? <span className="ann-count">{unseen.length}</span>
          : <span className="font-mono text-[11px] text-[var(--ink-faint)]">{all.length}</span>}
      </button>
      {open && <AnnouncementsViewer list={all} from={provider?.display_name} closeLabel="Cerrar" onClose={() => { mark(OPENED, all.map(a => a.id)); mark(SEEN, all.map(a => a.id)); setOpen(false) }} />}
    </>
  )
}
