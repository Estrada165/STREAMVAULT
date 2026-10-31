import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'

const ThemeContext = createContext(null)
const META = { dark: '#0A0A0C', light: '#F3F4F6' }

function paint(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme] || META.light)
}

/** Punto desde donde nace el círculo: el clic, o el centro del botón si se usó teclado */
function originOf(e) {
  if (e && typeof e.clientX === 'number' && (e.clientX || e.clientY)) return { x: e.clientX, y: e.clientY }
  const r = e?.currentTarget?.getBoundingClientRect?.()
  if (r) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  return { x: window.innerWidth - 40, y: 40 }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('sv-theme')
      if (saved) return saved
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const themeRef = useRef(theme)
  themeRef.current = theme

  useEffect(() => {
    paint(theme)
    try { localStorage.setItem('sv-theme', theme) } catch {}
  }, [theme])

  /** Cambia el tema con un círculo que se expande desde donde hiciste clic */
  const setTheme = useCallback((next, e) => {
    if (next === themeRef.current) return
    const apply = () => {
      flushSync(() => setThemeState(next))
      paint(next)
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) return apply()

    const { x, y } = originOf(e)
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const root = document.documentElement
    root.classList.add('vt-theme')
    const vt = document.startViewTransition(apply)
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
      )
    }).catch(() => {})
    vt.finished.finally(() => root.classList.remove('vt-theme'))
  }, [])

  const toggle = useCallback(e => setTheme(themeRef.current === 'dark' ? 'light' : 'dark', e), [setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
