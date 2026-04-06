import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui'
import PageWrapper from '@/components/layout/PageWrapper'

// Auth pages
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminProveedores from '@/pages/admin/Proveedores'
import AdminPlataformas from '@/pages/admin/Plataformas'
import AdminConfiguracion from '@/pages/admin/Configuracion'

// Proveedor pages
import ProveedorDashboard from '@/pages/proveedor/Dashboard'
import ProveedorProductos from '@/pages/proveedor/Productos'
import ProveedorStock from '@/pages/proveedor/Stock'
import ProveedorDistribuidores from '@/pages/proveedor/Distribuidores'
import ProveedorVentas from '@/pages/proveedor/Ventas'
import ProveedorSoporte from '@/pages/proveedor/Soporte'
import ProveedorConfiguracion from '@/pages/proveedor/Configuracion'

// Distribuidor pages
import Tienda from '@/pages/distribuidor/Tienda'
import DistDashboard from '@/pages/distribuidor/Dashboard'
import Carrito from '@/pages/distribuidor/Carrito'
import DistSoporte from '@/pages/distribuidor/Soporte'
import DistPerfil from '@/pages/distribuidor/Perfil'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={32} />
        <p className="text-sm text-[var(--ink-faint)]">Cargando StreamVault...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, allowedRoles }) {
  const { profile, loading, isActive, isProviderActive, isAdmin } = useAuth()

  if (loading) return <LoadingScreen />
  if (!profile) return <Navigate to="/login" replace />

  // Check role
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/login" replace />
  }

  // Check account active (admin is always active)
  if (!isAdmin && !isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] px-4">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--status-yellow-bg)] flex items-center justify-center mx-auto mb-4">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--status-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-[var(--ink)] mb-2">Cuenta pendiente</h2>
          <p className="text-sm text-[var(--ink-muted)]">Tu cuenta está pendiente de activación. El administrador la revisará pronto.</p>
        </div>
      </div>
    )
  }

  // Distribuidor: check if provider is active
  if (profile.role === 'distribuidor' && !isProviderActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] px-4">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--status-red-bg)] flex items-center justify-center mx-auto mb-4">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--status-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-[var(--ink)] mb-2">Servicio suspendido</h2>
          <p className="text-sm text-[var(--ink-muted)]">El acceso a la plataforma está temporalmente suspendido. Contacta a tu proveedor para más información.</p>
        </div>
      </div>
    )
  }

  return <PageWrapper>{children}</PageWrapper>
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
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<RoleRedirect />} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/proveedores" element={<ProtectedRoute allowedRoles={['admin']}><AdminProveedores /></ProtectedRoute>} />
      <Route path="/admin/plataformas" element={<ProtectedRoute allowedRoles={['admin']}><AdminPlataformas /></ProtectedRoute>} />
      <Route path="/admin/configuracion" element={<ProtectedRoute allowedRoles={['admin']}><AdminConfiguracion /></ProtectedRoute>} />

      {/* Proveedor */}
      <Route path="/proveedor" element={<ProtectedRoute allowedRoles={['proveedor']}><ProveedorDashboard /></ProtectedRoute>} />
      <Route path="/proveedor/productos" element={<ProtectedRoute allowedRoles={['proveedor']}><ProveedorProductos /></ProtectedRoute>} />
      <Route path="/proveedor/stock" element={<ProtectedRoute allowedRoles={['proveedor']}><ProveedorStock /></ProtectedRoute>} />
      <Route path="/proveedor/distribuidores" element={<ProtectedRoute allowedRoles={['proveedor']}><ProveedorDistribuidores /></ProtectedRoute>} />
      <Route path="/proveedor/ventas" element={<ProtectedRoute allowedRoles={['proveedor']}><ProveedorVentas /></ProtectedRoute>} />
      <Route path="/proveedor/soporte" element={<ProtectedRoute allowedRoles={['proveedor']}><ProveedorSoporte /></ProtectedRoute>} />
      <Route path="/proveedor/configuracion" element={<ProtectedRoute allowedRoles={['proveedor']}><ProveedorConfiguracion /></ProtectedRoute>} />

      {/* Distribuidor */}
      <Route path="/tienda" element={<ProtectedRoute allowedRoles={['distribuidor']}><Tienda /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['distribuidor']}><DistDashboard /></ProtectedRoute>} />
      <Route path="/carrito" element={<ProtectedRoute allowedRoles={['distribuidor']}><Carrito /></ProtectedRoute>} />
      <Route path="/soporte" element={<ProtectedRoute allowedRoles={['distribuidor']}><DistSoporte /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute allowedRoles={['distribuidor']}><DistPerfil /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
