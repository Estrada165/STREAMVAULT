import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui'
import PageWrapper from '@/components/layout/PageWrapper'
import AuthLayout from '@/components/layout/AuthLayout'
import { BrandMark, ThemeSwitch } from '@/components/layout/Sidebar'

// Cada pantalla se descarga solo cuando se abre (antes iba todo en un solo archivo)
const authPages = () => import('@/pages/auth')
const pages = {
  adminDashboard: () => import('@/pages/admin/Dashboard'),
  adminProveedores: () => import('@/pages/admin/Proveedores'),
  adminPlataformas: () => import('@/pages/admin/Plataformas'),
  adminConfiguracion: () => import('@/pages/admin/Configuracion'),
  adminCobros: () => import('@/pages/admin/Cobros'),
  adminActividad: () => import('@/pages/admin/Actividad'),
  provPendientes: () => import('@/pages/proveedor/Pendientes'),
  provAvisos: () => import('@/pages/proveedor/Avisos'),
  distSaldo: () => import('@/pages/distribuidor/Saldo'),
  distAsistente: () => import('@/pages/distribuidor/Asistente'),
  provDashboard: () => import('@/pages/proveedor/Dashboard'),
  provProductos: () => import('@/pages/proveedor/Productos'),
  provStock: () => import('@/pages/proveedor/Stock'),
  provDistribuidores: () => import('@/pages/proveedor/Distribuidores'),
  provVentas: () => import('@/pages/proveedor/Ventas'),
  provSoporte: () => import('@/pages/proveedor/Soporte'),
  provConfiguracion: () => import('@/pages/proveedor/Configuracion'),
  provTutoriales: () => import('@/pages/proveedor/Tutoriales'),
  tienda: () => import('@/pages/distribuidor/Tienda'),
  distDashboard: () => import('@/pages/distribuidor/Dashboard'),
  carrito: () => import('@/pages/distribuidor/Carrito'),
  distSoporte: () => import('@/pages/distribuidor/Soporte'),
  distPerfil: () => import('@/pages/distribuidor/Perfil'),
  distTutoriales: () => import('@/pages/distribuidor/Tutoriales'),
}
const L = Object.fromEntries(Object.entries(pages).map(([k, f]) => [k, lazy(f)]))
const Login = lazy(() => authPages().then(m => ({ default: m.Login })))
const Register = lazy(() => authPages().then(m => ({ default: m.Register })))
const Recuperar = lazy(() => authPages().then(m => ({ default: m.Recuperar })))
const NuevaContrasena = lazy(() => authPages().then(m => ({ default: m.NuevaContrasena })))

// Precarga en segundo plano las pantallas del rol, para que el menú abra al instante
const ROLE_PAGES = {
  admin: ['adminDashboard', 'adminProveedores', 'adminCobros', 'adminActividad', 'adminPlataformas', 'adminConfiguracion'],
  proveedor: ['provDashboard', 'provPendientes', 'provVentas', 'provProductos', 'provStock', 'provDistribuidores', 'provAvisos', 'provSoporte', 'provConfiguracion', 'provTutoriales'],
  distribuidor: ['tienda', 'distDashboard', 'distSaldo', 'distAsistente', 'carrito', 'distSoporte', 'distPerfil', 'distTutoriales'],
}
function usePrefetch(role) {
  useEffect(() => {
    if (!role) return
    const run = () => ROLE_PAGES[role]?.forEach(k => pages[k]().catch(() => {}))
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 2500 }) : setTimeout(run, 1200)
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : clearTimeout(id))
  }, [role])
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <BrandMark />
        <Spinner size={26} />
      </div>
    </div>
  )
}

function BlockedScreen({ tone, title, children }) {
  const { signOut } = useAuth()
  const color = tone === 'red' ? 'var(--status-red)' : 'var(--status-yellow)'
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] px-4">
      <div className="card p-8 max-w-md w-full text-center animate-slide-up">
        <div className="w-14 h-14 rounded-2xl inset flex items-center justify-center mx-auto mb-5">
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-[var(--ink)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--ink-muted)] leading-relaxed">{children}</p>
        <div className="mt-6 space-y-3">
          <ThemeSwitch />
          <button className="btn-ghost w-full justify-center" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}

function RoleLayout({ roles }) {
  const { profile, loading, isActive, isProviderActive, isAdmin } = useAuth()
  usePrefetch(profile?.role)

  if (loading) return <LoadingScreen />
  if (!profile) return <Navigate to="/login" replace />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />

  if (!isAdmin && !isActive) {
    return <BlockedScreen tone="yellow" title="Cuenta pendiente">Tu cuenta está pendiente de activación. {profile.role === 'distribuidor' ? 'Tu proveedor' : 'El administrador'} la revisará pronto.</BlockedScreen>
  }
  if (profile.role === 'distribuidor' && !isProviderActive) {
    return <BlockedScreen tone="red" title="Servicio suspendido">El acceso a la plataforma está temporalmente suspendido. Contacta a tu proveedor para más información.</BlockedScreen>
  }

  return <PageWrapper><Outlet /></PageWrapper>
}

function RoleRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  if (profile.role === 'proveedor') return <Navigate to="/proveedor" replace />
  return <Navigate to="/tienda" replace />
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/nueva-contrasena" element={<NuevaContrasena />} />
        </Route>
        <Route path="/" element={<RoleRedirect />} />

        <Route element={<RoleLayout roles={['admin']} />}>
          <Route path="/admin" element={<L.adminDashboard />} />
          <Route path="/admin/proveedores" element={<L.adminProveedores />} />
          <Route path="/admin/cobros" element={<L.adminCobros />} />
          <Route path="/admin/actividad" element={<L.adminActividad />} />
          <Route path="/admin/plataformas" element={<L.adminPlataformas />} />
          <Route path="/admin/configuracion" element={<L.adminConfiguracion />} />
        </Route>

        <Route element={<RoleLayout roles={['proveedor']} />}>
          <Route path="/proveedor" element={<L.provDashboard />} />
          <Route path="/proveedor/pendientes" element={<L.provPendientes />} />
          <Route path="/proveedor/avisos" element={<L.provAvisos />} />
          <Route path="/proveedor/productos" element={<L.provProductos />} />
          <Route path="/proveedor/stock" element={<L.provStock />} />
          <Route path="/proveedor/distribuidores" element={<L.provDistribuidores />} />
          <Route path="/proveedor/ventas" element={<L.provVentas />} />
          <Route path="/proveedor/soporte" element={<L.provSoporte />} />
          <Route path="/proveedor/configuracion" element={<L.provConfiguracion />} />
          <Route path="/proveedor/tutoriales" element={<L.provTutoriales />} />
        </Route>

        <Route element={<RoleLayout roles={['distribuidor']} />}>
          <Route path="/tienda" element={<L.tienda />} />
          <Route path="/dashboard" element={<L.distDashboard />} />
          <Route path="/saldo" element={<L.distSaldo />} />
          <Route path="/asistente" element={<L.distAsistente />} />
          <Route path="/carrito" element={<L.carrito />} />
          <Route path="/soporte" element={<L.distSoporte />} />
          <Route path="/perfil" element={<L.distPerfil />} />
          <Route path="/tutoriales" element={<L.distTutoriales />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
