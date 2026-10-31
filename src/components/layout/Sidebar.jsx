import { useEffect, useState } from 'react'
import NotificationCenter from '@/components/shared/NotificationCenter'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useBalance } from '@/hooks/useBalance'
import { APP_NAME } from '@/lib/brand'
import { daysRemaining, getDaysColor, formatUSD } from '@/utils'
import {
  LogoSV, IconHome, IconBox, IconUsers, IconShoppingCart,
  IconHeadphones, IconSettings, IconLogOut, IconSun, IconMoon,
  IconX, IconTrendingUp, IconDatabase, IconChevronLeft, IconWallet,
  IconStore, IconLayers, IconMonitor, IconBook, IconBell, IconDollar, IconClock, IconSend, IconChat
} from '@/assets/icons'

export const ADMIN_NAV = [
  { to: '/admin', label: 'Inicio', icon: IconHome, end: true },
  { to: '/admin/proveedores', label: 'Proveedores', icon: IconUsers },
  { to: '/admin/cobros', label: 'Cobros', icon: IconDollar },
  { to: '/admin/actividad', label: 'Actividad', icon: IconLayers },
  { to: '/admin/plataformas', label: 'Plataformas', icon: IconMonitor },
  { to: '/admin/configuracion', label: 'Configuración', icon: IconSettings },
]

export const PROVEEDOR_NAV = [
  { to: '/proveedor', label: 'Inicio', icon: IconHome, end: true },
  { to: '/proveedor/pendientes', label: 'Pendientes', icon: IconClock, badgeKey: 'pending' },
  { to: '/proveedor/productos', label: 'Productos', icon: IconBox },
  { to: '/proveedor/stock', label: 'Stock', icon: IconDatabase },
  { to: '/proveedor/ventas', label: 'Ventas', icon: IconTrendingUp },
  { to: '/proveedor/distribuidores', label: 'Distribuidores', icon: IconUsers },
  { to: '/proveedor/avisos', label: 'Avisos', icon: IconSend },
  { to: '/proveedor/soporte', label: 'Soporte', icon: IconHeadphones, badgeKey: 'tickets' },
  { to: '/proveedor/configuracion', label: 'Configuración', icon: IconSettings },
  { to: '/proveedor/tutoriales', label: 'Tutoriales', icon: IconBook },
]

export const DISTRIBUIDOR_NAV = [
  { to: '/tienda', label: 'Tienda', icon: IconStore, end: true },
  { to: '/dashboard', label: 'Mis pedidos', icon: IconLayers },
  { to: '/saldo', label: 'Mi saldo', icon: IconWallet },
  { to: '/carrito', label: 'Carrito', icon: IconShoppingCart, badgeKey: 'cart' },
  { to: '/soporte', label: 'Soporte', icon: IconHeadphones },
  { to: '/tutoriales', label: 'Tutoriales', icon: IconBook },
  { to: '/perfil', label: 'Mi perfil', icon: IconSettings },
]

const KEY_TILE = 'w-9 h-9 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center flex-shrink-0 shadow-[inset_0_1px_0_var(--hl),0_3px_0_var(--a-edge)]'

/** Marca: el logo del proveedor (para él y sus distribuidores) o la de la plataforma */
export function BrandMark({ compact = false }) {
  const { provider, profile, isAdmin } = useAuth()
  const name = profile && !isAdmin && provider?.display_name
  if (name) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        {provider.logo_url
          ? <img src={provider.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-[var(--surface-border)]" />
          : <span className={`${KEY_TILE} font-display font-bold`}>{name[0]}</span>}
        <div className="min-w-0 leading-tight sb-hide">
          <p className="font-display font-semibold text-[1.02rem] tracking-tight text-[var(--ink)] truncate">{name}</p>
          {!compact && <p className="text-[11px] text-[var(--ink-faint)]">con {APP_NAME.first}{APP_NAME.second}</p>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5">
      <span className={KEY_TILE}><LogoSV size={20} /></span>
      <span className="font-display font-semibold text-[1.2rem] tracking-tight text-[var(--ink)] sb-hide">
        {APP_NAME.first}<span className="grad">{APP_NAME.second}</span>
      </span>
    </div>
  )
}

/** Interruptor claro / oscuro con pastilla deslizante */
export function ThemeSwitch() {
  const { isDark, setTheme } = useTheme()
  return (
    <div className={`inset theme-switch ${isDark ? 'is-dark' : ''}`} role="group" aria-label="Tema">
      <span className="thumb" aria-hidden="true" />
      <button type="button" aria-pressed={!isDark} onClick={e => setTheme('light', e)}><IconSun size={14} />Claro</button>
      <button type="button" aria-pressed={isDark} onClick={e => setTheme('dark', e)}><IconMoon size={14} />Oscuro</button>
    </div>
  )
}

function ThemeIconButton() {
  const { isDark, toggle } = useTheme()
  return (
    <button onClick={toggle} className="btn-secondary btn-icon w-full sb-tip" data-tip={isDark ? 'Modo claro' : 'Modo oscuro'} aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}>
      {isDark ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  )
}

function DistributorBalance() {
  const { balance } = useBalance()
  const navigate = useNavigate()
  const go = () => navigate('/tienda?recargar=1')
  return (
    <>
      <div className="sb-hide mb-3 rounded-2xl border border-[var(--a-line)] bg-[var(--a-soft)] px-3.5 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/saldo')} className="min-w-0 flex-1 text-left group" title="Ver movimientos">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-[var(--ink-faint)] group-hover:text-[var(--a)] transition-colors">Tu saldo →</p>
          <p className="font-mono text-[1.3rem] font-medium text-[var(--ink)] leading-tight mt-0.5 truncate">{formatUSD(balance)}</p>
        </button>
        <button onClick={go} className="btn-primary btn-sm flex-shrink-0">Recargar</button>
      </div>
      <button onClick={go} className="sb-only-collapsed btn-accent btn-icon w-full mb-2 sb-tip" data-tip={`Saldo ${formatUSD(balance)}`} aria-label={`Saldo ${formatUSD(balance)}. Recargar`}>
        <IconWallet size={17} />
      </button>
    </>
  )
}

export default function Sidebar({ open, onClose, badges = {}, collapsed = false, onToggleCollapse, onCountsChange }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const { profile, provider, isAdmin, isProveedor, isDistribuidor, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Cerrar el menú móvil al navegar
  useEffect(() => { onClose?.() }, [location.pathname])

  const nav = (isAdmin ? ADMIN_NAV : isProveedor ? PROVEEDOR_NAV : DISTRIBUIDOR_NAV)
    .filter(i => !i.assistant || provider?.assistant?.enabled !== false)
  const days = isProveedor && provider?.expires_at ? daysRemaining(provider.expires_at) : null
  const daysColor = days !== null ? getDaysColor(days) : null

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const roleLabel = isAdmin ? 'Administrador' : isProveedor ? 'Proveedor' : 'Distribuidor'
  const display = profile?.full_name || profile?.email?.split('@')[0] || ''
  const daysText = days === null ? '' : days <= 0 ? 'Acceso vencido' : `${days} día${days !== 1 ? 's' : ''} de acceso`

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Menú principal">
      <button className="sb-toggle" onClick={onToggleCollapse} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : 'Contraer menú'}>
        <IconChevronLeft size={14} />
      </button>

      <div className={`flex items-center justify-between gap-2 pt-5 pb-4 ${collapsed ? 'lg:justify-center lg:px-0 px-5' : 'px-5'}`}>
        <BrandMark />
        <button className="btn-ghost p-2 lg:hidden" onClick={onClose} aria-label="Cerrar menú"><IconX size={18} /></button>
      </div>

      {days !== null && (
        <div className={`mx-4 mb-2 days-pill ${daysColor} !rounded-xl !px-3 !py-2 !text-xs justify-between sb-tip ${collapsed ? 'lg:!justify-center lg:mx-auto lg:!px-0 lg:w-11' : ''}`} data-tip={daysText}>
          <span className="inline-flex items-center gap-2">
            <span className={`dot ${daysColor === 'red' ? 'animate-pulse-soft' : ''}`} />
            <span className="sb-hide">{daysText}</span>
          </span>
          {provider?.renewal_cost && <span className="opacity-70 sb-hide">{provider.renewal_cost}</span>}
        </div>
      )}

      <p className="eyebrow px-6 pt-3 pb-2 sb-hide">{roleLabel}</p>
      {collapsed && <div className="hidden lg:block h-3" />}

      <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-visible pb-3 ${collapsed ? 'lg:px-4 px-3' : 'px-3'}`}>
        {nav.map(({ to, label, icon: Icon, end, badgeKey }) => {
          const badge = badgeKey ? badges[badgeKey] || 0 : 0
          return (
            <NavLink key={to} to={to} end={end} data-tip={label} aria-label={label} className={({ isActive }) => `nav-item sb-tip ${isActive ? 'active' : ''}`}>
              {({ isActive }) => (
                <>
                  <Icon size={18} />
                  <span className="truncate sb-hide">{label}</span>
                  {badge > 0
                    ? <span className={`nav-badge ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-mono font-semibold grid place-items-center ${badgeKey === 'tickets' || badgeKey === 'pending' ? 'bg-[var(--b)] text-white' : 'bg-[var(--surface-overlay)] text-[var(--ink)] border border-[var(--surface-border)]'}`}>{badge > 99 ? '99+' : badge}</span>
                    : isActive && <span className="nav-ind" />}
                </>
              )}
            </NavLink>
          )
        })}
        <div className="pt-2 mt-2 border-t border-[var(--surface-border)]">
          <button onClick={() => setNotifOpen(true)} data-tip="Notificaciones" aria-label="Notificaciones" className="nav-item sb-tip w-full">
            <IconBell size={18} />
            <span className="truncate sb-hide">Notificaciones</span>
            {badges.notifs > 0 && <span className="nav-badge ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-mono font-semibold grid place-items-center bg-[var(--b)] text-white">{badges.notifs > 99 ? '99+' : badges.notifs}</span>}
          </button>
        </div>
      </nav>
      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} onChange={onCountsChange} />

      <div className={`pb-4 pt-3 border-t border-[var(--surface-border)] ${collapsed ? 'lg:px-4 px-4' : 'px-4'}`}>
        {isDistribuidor && <DistributorBalance />}
        <div className="sb-hide"><ThemeSwitch /></div>
        <div className="sb-only-collapsed"><ThemeIconButton /></div>

        <div className={`flex items-center gap-3 mt-3 ${collapsed ? 'lg:flex-col lg:gap-2 pl-1 lg:pl-0' : 'pl-1'}`}>
          <span className="w-9 h-9 rounded-full inset grid place-items-center text-xs font-bold text-[var(--ink-muted)] uppercase flex-shrink-0 sb-tip" data-tip={display}>
            {display[0] || '?'}
          </span>
          <div className="min-w-0 flex-1 sb-hide">
            <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{display}</p>
            <p className="text-[11px] text-[var(--ink-faint)] truncate">{profile?.email}</p>
          </div>
          <button onClick={handleSignOut} className="btn-ghost p-2 hover:!text-[var(--status-red)] sb-tip" data-tip="Cerrar sesión" aria-label="Cerrar sesión">
            <IconLogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}
