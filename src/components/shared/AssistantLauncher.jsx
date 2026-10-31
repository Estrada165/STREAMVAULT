import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useBalance } from '@/hooks/useBalance'
import { useAssistantData } from '@/hooks/useAssistantData'
import { Spinner, useToast } from '@/components/ui'
import AssistantChat from './AssistantChat'
import AssistantIcon from './AssistantIcon'
import { IconX } from '@/assets/icons'

/**
 * Botón flotante del asistente (abajo a la derecha) para el distribuidor.
 * Abre el chat encima de la página actual, sin cambiar de pantalla.
 * Se acomoda para no tapar el botón del carrito.
 */
export default function AssistantLauncher() {
  const { provider, profile } = useAuth()
  const { addItem, count } = useCart()
  const { balance } = useBalance()
  const toast = useToast()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  const [hint, setHint] = useState(false)
  const data = useAssistantData(everOpened ? provider?.id : null)
  const config = provider?.assistant || {}
  const name = config.name || 'Asistente'

  // Pista "¿Dudas? Pregúntame" una vez por sesión
  useEffect(() => {
    let shown = false
    try { shown = sessionStorage.getItem('sv-bot-hint') === '1' } catch {}
    if (shown) return
    const a = setTimeout(() => setHint(true), 1800)
    const b = setTimeout(() => { setHint(false); try { sessionStorage.setItem('sv-bot-hint', '1') } catch {} }, 8800)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])

  // Cerrar al cambiar de página y con Escape
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const mobile = window.matchMedia('(max-width: 639px)').matches
    const prev = document.body.style.overflow
    if (mobile) document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  if (config.enabled === false || location.pathname === '/asistente') return null

  // No tapar el carrito: en la tienda (con productos) y en el carrito (móvil) sube un poco
  const lifted = (location.pathname === '/tienda' && count > 0) || location.pathname === '/carrito'
  const bottom = lifted
    ? (location.pathname === '/carrito' ? 'bottom-[6.25rem] lg:bottom-6' : 'bottom-[6.25rem]')
    : 'bottom-5 sm:bottom-6'

  function toggle() {
    setOpen(o => !o); setEverOpened(true); setHint(false)
    try { sessionStorage.setItem('sv-bot-hint', '1') } catch {}
  }
  function onAdd(items) {
    items.forEach(p => addItem(p))
    toast.success(items.length === 1 ? `${items[0].name} agregado al carrito` : `Combo de ${items.length} agregado al carrito`)
  }

  return createPortal(
    <>
      {open && <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] sm:hidden animate-fade-in" onClick={() => setOpen(false)} />}

      {open && (
        <section
          role="dialog" aria-label={`Asistente ${name}`}
          className={`fixed z-[75] flex flex-col bg-[var(--surface-raised)] border border-[var(--surface-border)] shadow-[0_30px_80px_rgba(0,0,0,.35)]
            inset-x-0 bottom-0 h-[88dvh] rounded-t-[1.4rem] animate-[sheetUp_.32s_var(--ease)]
            sm:inset-x-auto sm:right-6 sm:h-[min(640px,calc(100dvh-8.5rem))] sm:w-[400px] sm:rounded-[1.4rem] sm:animate-pop sm:origin-bottom-right
            ${lifted ? 'sm:bottom-[10.5rem]' : 'sm:bottom-[6.25rem]'}`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-[var(--surface-border)]">
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)]"><AssistantIcon size={18} /></span>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-[var(--ink)] leading-tight truncate">{name}</p>
              <p className="text-[11px] text-[var(--ink-faint)] flex items-center gap-1.5"><span className="dot dot-glow" style={{ color: 'var(--a)' }} />Responde al instante · {provider?.display_name}</p>
            </div>
            <button onClick={() => setOpen(false)} className="btn-ghost p-2" aria-label="Cerrar asistente"><IconX size={18} /></button>
          </header>
          <div className="flex-1 min-h-0 p-3 sm:p-4">
            {!data ? <div className="h-full grid place-items-center"><Spinner size={22} /></div> : (
              <AssistantChat ctx={{ ...data, provider, balance, config }} storageKey={`sv-bot-${profile?.id}`} onAdd={onAdd} />
            )}
          </div>
        </section>
      )}

      {/* Botón flotante */}
      <div className={`fixed right-4 sm:right-6 z-[76] ${bottom} transition-[bottom] duration-300 ${open ? 'max-sm:hidden' : ''}`}>
        {hint && !open && (
          <button onClick={toggle} className="absolute bottom-full right-0 mb-3 whitespace-nowrap rounded-2xl rounded-br-md px-3.5 py-2 text-[12.5px] font-semibold bg-[var(--surface-raised)] text-[var(--ink)] border border-[var(--surface-border)] shadow-[0_10px_28px_var(--shadow)] animate-slide-up">
            ¿Dudas con precios o recargas? <span className="text-[var(--a)]">Pregúntale a {name}</span>
          </button>
        )}
        <button
          onClick={toggle}
          aria-label={open ? 'Cerrar asistente' : `Abrir asistente ${name}`}
          aria-expanded={open}
          title={open ? 'Cerrar' : `Pregúntale a ${name}`}
          className="btn-primary !rounded-full !w-14 !h-14 !p-0 relative"
          style={!open && hint ? { animation: 'ringPulse 1.6s ease-out infinite' } : undefined}
        >
          <span className="transition-transform duration-300" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
            {open ? <IconX size={22} /> : <AssistantIcon size={24} />}
          </span>
        </button>
      </div>
    </>,
    document.body
  )
}
