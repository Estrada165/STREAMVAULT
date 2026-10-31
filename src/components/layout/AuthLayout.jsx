import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BrandMark } from './Sidebar'
import { useTheme } from '@/context/ThemeContext'
import { APP_FULL_NAME } from '@/lib/brand'
import { Spinner } from '@/components/ui'
import { IconSun, IconMoon, IconZap, IconWallet, IconDatabase, IconRefreshCw, IconWhatsApp } from '@/assets/icons'

const FEATURES = [
  { icon: IconZap, title: 'Entrega automática', text: 'Las credenciales llegan al instante, las 24 horas, sin que intervengas.' },
  { icon: IconWallet, title: 'Saldo en tiempo real', text: 'Recargas con Yape, Plin o Binance que se reflejan al momento.' },
  { icon: IconDatabase, title: 'Stock bajo control', text: 'Carga cuentas en lote y recibe alertas cuando algo se agota.' },
  { icon: IconRefreshCw, title: 'Renovaciones sin olvidos', text: 'Cada pedido muestra sus días restantes y se renueva en un clic.' },
  { icon: IconWhatsApp, title: 'Avisos por WhatsApp', text: 'Credenciales y recordatorios listos para enviar a cada cliente.' },
]

function FeatureList({ compact = false }) {
  return (
    <ul className={compact ? 'grid gap-2' : 'grid gap-1'}>
      {FEATURES.map(({ icon: Icon, title, text }, i) => (
        <li
          key={title}
          className={`flex items-center gap-3 rounded-2xl animate-slide-up ${compact ? 'p-3 card !rounded-2xl' : 'px-2.5 py-2 -mx-2.5 hover:bg-[var(--surface-raised)] transition-colors duration-300'}`}
          style={{ animationDelay: `${0.1 + i * 0.05}s` }}
        >
          <span className={`w-9 h-9 rounded-xl grid place-items-center flex-shrink-0 border shadow-[inset_0_1px_0_var(--hl),0_2px_0_var(--key-edge)] ${i % 2 ? 'bg-[var(--b-soft)] border-[var(--b-line)] text-[var(--b)]' : 'bg-[var(--a-soft)] border-[var(--a-line)] text-[var(--a)]'}`}>
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--ink)] leading-tight">{title}</p>
            <p className="text-[12.5px] text-[var(--ink-muted)] leading-snug mt-0.5">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Login y registro comparten este marco: al cambiar de uno a otro solo cambia el formulario */
export default function AuthLayout() {
  const { isDark, toggle } = useTheme()
  const location = useLocation()

  return (
    <div className="relative min-h-screen min-h-[100dvh] bg-[var(--surface)] overflow-hidden">
      {/* Luces ambientales suaves con los colores de marca */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-48 -left-40 w-[620px] h-[620px] rounded-full blur-[110px] opacity-[.16] dark:opacity-[.12]" style={{ background: 'var(--a)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 right-[-10%] w-[620px] h-[620px] rounded-full blur-[120px] opacity-[.12] dark:opacity-[.10]" style={{ background: 'var(--b)' }} />

      {/* Tema: un solo botón pequeño en la esquina, no ocupa espacio */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-20 btn-secondary btn-icon btn-sm !rounded-full"
        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={isDark ? 'Modo claro' : 'Modo oscuro'}
      >
        {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </button>

      <div className="relative mx-auto max-w-[1120px] min-h-screen min-h-[100dvh] grid lg:grid-cols-[1fr_1fr] lg:items-center gap-8 xl:gap-14 px-4 sm:px-8 py-5 lg:py-3">
        {/* Presentación (escritorio) */}
        <section className="hidden lg:block">
          <BrandMark />
          <h2 className="font-display text-[2.15rem] xl:text-[2.5rem] font-semibold leading-[1.06] tracking-tight text-[var(--ink)] mt-8 animate-slide-up">
            Tu tienda de <span className="grad">streaming</span>,<br />lista para vender.
          </h2>
          <p className="text-[14.5px] text-[var(--ink-muted)] leading-relaxed mt-3 max-w-[460px] animate-slide-up" style={{ animationDelay: '.05s' }}>
            Catálogo, stock, saldo, renovaciones y soporte de toda tu red en un solo panel.
          </p>
          <div className="mt-6 max-w-[480px]"><FeatureList /></div>
          <p className="text-xs text-[var(--ink-faint)] mt-6">© {new Date().getFullYear()} {APP_FULL_NAME}</p>
        </section>

        {/* Formulario */}
        <main className="flex flex-col items-center">
          <div className="lg:hidden self-start mb-5 pr-12"><BrandMark /></div>

          <div className="card w-full max-w-[430px] p-6 animate-slide-up">
            <Suspense fallback={<div className="h-72 grid place-items-center"><Spinner size={24} /></div>}>
              {/* Solo el formulario se renueva (con un fundido suave) al ir de login a registro */}
              <div key={location.pathname} className="animate-fade-in">
                <Outlet />
              </div>
            </Suspense>
          </div>

          {/* En móvil las ventajas van debajo del formulario */}
          <section className="lg:hidden w-full mt-8">
            <p className="eyebrow mb-3">Por qué {APP_FULL_NAME}</p>
            <FeatureList compact />
            <p className="text-xs text-[var(--ink-faint)] text-center mt-6">© {new Date().getFullYear()} {APP_FULL_NAME}</p>
          </section>
        </main>
      </div>
    </div>
  )
}
