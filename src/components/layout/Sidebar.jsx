import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { daysRemaining, getDaysColor } from '@/utils'
import {
  LogoSV, IconHome, IconBox, IconUsers, IconShoppingCart, IconDollar,
  IconHeadphones, IconSettings, IconLogOut, IconSun, IconMoon,
  IconBell, IconMenu, IconX, IconTrendingUp, IconDatabase,
  IconStore, IconLayers, IconMonitor, IconBook
} from '@/assets/icons'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: IconHome, end: true },
  { to: '/admin/proveedores', label: 'Proveedores', icon: IconUsers },
  { to: '/admin/plataformas', label: 'Plataformas', icon: IconMonitor },
  { to: '/admin/configuracion', label: 'Configuración', icon: IconSettings },
]

const PROVEEDOR_NAV = [
  { to: '/proveedor', label: 'Dashboard', icon: IconHome, end: true },
  { to: '/proveedor/productos', label: 'Productos', icon: IconBox },
  { to: '/proveedor/stock', label: 'Stock', icon: IconDatabase },
  { to: '/proveedor/distribuidores', label: 'Distribuidores', icon: IconUsers },
  { to: '/proveedor/ventas', label: 'Ventas', icon: IconTrendingUp },
  { to: '/proveedor/soporte', label: 'Soporte', icon: IconHeadphones },
  { to: '/proveedor/configuracion', label: 'Configuración', icon: IconSettings },
  { to: '/proveedor/tutoriales', label: 'Tutoriales', icon: IconBook },
]

const DISTRIBUIDOR_NAV = [
  { to: '/tienda', label: 'Tienda', icon: IconStore, end: true },
  { to: '/dashboard', label: 'Mis Pedidos', icon: IconLayers },
  { to: '/carrito', label: 'Carrito', icon: IconShoppingCart },
  { to: '/soporte', label: 'Soporte', icon: IconHeadphones },
  { to: '/tutoriales', label: 'Tutoriales', icon: IconBook },
  { to: '/perfil', label: 'Mi Perfil', icon: IconSettings },
]

function NavItem({ to, label, icon: Icon, end, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative
        ${isActive
          ? 'bg-[var(--surface-overlay)] text-[var(--ink)] font-semibold'
          : 'text-[var(--ink-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--ink)]'
        }`
      }
    >
      <Icon size={16} />
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-[var(--status-red)] text-white text-[10px] font-bold flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar({ notifCount = 0, ticketCount = 0 }) {
  const { profile, provider, isAdmin, isProveedor, signOut } = useAuth()
  const { toggle, isDark } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = isAdmin ? ADMIN_NAV : isProveedor ? PROVEEDOR_NAV : DISTRIBUIDOR_NAV

  const days = provider?.expires_at ? daysRemaining(provider.expires_at) : null
  const daysColor = days !== null ? getDaysColor(days) : null

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--surface-border)]">
        <LogoSV size={30} className="text-[var(--ink)]" />
        <span className="font-display font-bold text-lg tracking-tight text-[var(--ink)]">
          StreamVault
        </span>
      </div>

      {/* Provider days remaining */}
      {days !== null && (
        <div className={`mx-3 mt-3 px-3 py-2 rounded-lg text-xs font-mono font-medium flex items-center gap-2
          ${daysColor === 'green' ? 'bg-[var(--status-green-bg)] text-[var(--status-green)]' : ''}
          ${daysColor === 'yellow' ? 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)]' : ''}
          ${daysColor === 'red' ? 'bg-[var(--status-red-bg)] text-[var(--status-red)]' : ''}
        `}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
            ${daysColor === 'green' ? 'bg-[var(--status-green)]' : ''}
            ${daysColor === 'yellow' ? 'bg-[var(--status-yellow)]' : ''}
            ${daysColor === 'red' ? 'bg-[var(--status-red)] animate-pulse-soft' : ''}
          `} />
          {days <= 0 ? 'Acceso vencido' : `${days} día${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`}
        </div>
      )}

      {/* Role label */}
      <div className="px-4 pt-4 pb-1">
        <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--ink-faint)]">
          {isAdmin ? 'Administrador' : isProveedor ? 'Proveedor' : 'Distribuidor'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {nav.map(item => (
          <NavItem
            key={item.to}
            {...item}
            badge={item.label === 'Soporte' ? ticketCount : item.label === 'Notificaciones' ? notifCount : 0}
          />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-[var(--surface-border)] space-y-1">
        <button onClick={toggle} className="btn-ghost w-full justify-start text-sm">
          {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
          {isDark ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button onClick={handleSignOut} className="btn-ghost w-full justify-start text-sm text-[var(--status-red)]">
          <IconLogOut size={16} />
          Cerrar sesión
        </button>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-t border-[var(--surface-border)] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[var(--surface-overlay)] flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[var(--ink-muted)] uppercase">
            {profile?.email?.[0] || '?'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--ink)] truncate">{profile?.full_name || profile?.email?.split('@')[0]}</p>
          <p className="text-[10px] text-[var(--ink-faint)] truncate">{profile?.email}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden btn-secondary p-2"
        onClick={() => setMobileOpen(o => !o)}
      >
        {mobileOpen ? <IconX size={18} /> : <IconMenu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {sidebarContent}
      </aside>
    </>
  )
} 