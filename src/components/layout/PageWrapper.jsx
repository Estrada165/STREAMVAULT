import { useState, useEffect, useCallback, Suspense } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Sidebar, { BrandMark } from './Sidebar'
import ErrorBoundary from '@/components/ErrorBoundary'
import { AnnouncementPopup } from '@/components/shared/Announcements'
import AssistantLauncher from '@/components/shared/AssistantLauncher'
import { PageLoader } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { IconMenu, IconShoppingCart, IconBell } from '@/assets/icons'

export default function PageWrapper({ children }) {
  const { profile, provider, isDistribuidor, isProveedor } = useAuth()
  const { count: cartCount } = useCart()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // Menú contraído en escritorio (se recuerda en este navegador)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('sv-sidebar') === 'mini' } catch { return false } })
  const toggleCollapse = useCallback(() => setCollapsed(c => {
    try { localStorage.setItem('sv-sidebar', c ? 'full' : 'mini') } catch {}
    return !c
  }), [])
  const [ticketCount, setTicketCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  const fetchCounts = useCallback(async () => {
    if (!profile) return
    const { count: n } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setNotifCount(n || 0)

    if (profile.role === 'proveedor' && provider?.id) {
      const { count: t } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', provider.id)
        .eq('status', 'abierto')
      setTicketCount(t || 0)
      // Bandeja de pendientes: pedidos por entregar + distribuidores por activar + tickets abiertos
      const [{ count: po }, { count: pd }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pendiente_credenciales'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('provider_id', provider.id).eq('role', 'distribuidor').eq('is_active', false),
      ])
      setPendingCount((po || 0) + (pd || 0) + (t || 0))
    }
  }, [profile?.id, provider?.id])

  useEffect(() => {
    if (!profile) return
    fetchCounts()
    const channel = supabase
      .channel(`realtime-counts-${profile.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, isProveedor ? fetchCounts : () => {})
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchCounts])

  // Volver arriba al cambiar de página
  useEffect(() => { window.scrollTo({ top: 0 }) }, [location.pathname])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <div className={`layout-with-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {menuOpen && <div className="scrim lg:hidden" onClick={closeMenu} />}
      <Sidebar open={menuOpen} onClose={closeMenu} badges={{ tickets: ticketCount, cart: cartCount, notifs: notifCount, pending: pendingCount }} collapsed={collapsed} onToggleCollapse={toggleCollapse} onCountsChange={fetchCounts} />
      {isDistribuidor && <AnnouncementPopup />}
      {isDistribuidor && <AssistantLauncher />}

      <main className="main-content">
        {/* Barra superior en móvil y tablet */}
        <header className="topbar">
          <button className="btn-secondary btn-icon" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <IconMenu size={18} />
          </button>
          <div className="min-w-0 flex-1 flex justify-center"><BrandMark compact /></div>
          {isDistribuidor ? (
            <Link to="/carrito" className="btn-secondary btn-icon relative" aria-label={`Carrito, ${cartCount} productos`}>
              <IconShoppingCart size={18} />
              {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[var(--b)] text-white text-[11px] font-mono grid place-items-center animate-pop">{cartCount}</span>}
            </Link>
          ) : isProveedor ? (
            <Link to="/proveedor/soporte" className="btn-secondary btn-icon relative" aria-label="Soporte">
              <IconBell size={18} />
              {ticketCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[var(--b)] text-white text-[11px] font-mono grid place-items-center">{ticketCount}</span>}
            </Link>
          ) : <span className="w-[2.625rem]" />}
        </header>

        <div key={location.pathname} className="px-4 py-6 sm:px-6 md:px-8 md:py-8 max-w-[1320px] mx-auto animate-fade-in">
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
