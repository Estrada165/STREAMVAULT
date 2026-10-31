import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { applyBrand } from '@/lib/brand'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)
  const currentUserRef = useRef(null) // usuario cuya sesión está vigente

  // Colores: el distribuidor puede elegir los suyos; si no, usa los de su proveedor.
  // El proveedor usa los de su tienda y el admin los de la plataforma.
  const ownAccent = profile?.role === 'distribuidor' ? profile?.ui_accent : null
  useEffect(() => { applyBrand(ownAccent || provider?.brand_accent) }, [ownAccent, provider?.brand_accent])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // ── Ignorar TOKEN_REFRESHED — evita el parpadeo al cambiar de pestaña ──
      if (event === 'TOKEN_REFRESHED') return

      if (event === 'SIGNED_OUT') {
        currentUserRef.current = null
        setSession(null)
        setProfile(null)
        setProvider(null)
        setLoading(false)
        fetchingRef.current = false
        return
      }

      if (event === 'SIGNED_IN' && session?.user) {
        setSession(session)
        // Usuario nuevo en esta pestaña: mostrar carga hasta tener perfil Y proveedor
        // (evita el destello de "Servicio suspendido" al cambiar de cuenta)
        if (currentUserRef.current !== session.user.id) setLoading(true)
        fetchingRef.current = false
        fetchProfile(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    if (fetchingRef.current && currentUserRef.current === userId) return
    fetchingRef.current = true
    currentUserRef.current = userId
    const stale = () => currentUserRef.current !== userId
    try {
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (stale()) return
      if (error) { console.error('fetchProfile error:', error); return }
      if (!profileData) { console.warn('No profile found for', userId); return }

      // Se cargan perfil y proveedor y se publican juntos, nunca uno sin el otro
      let prov = null
      if (profileData.role === 'proveedor') {
        const { data } = await supabase
          .from('providers').select('*').eq('user_id', userId).maybeSingle()
        prov = data
      } else if (profileData.role === 'distribuidor' && profileData.provider_id) {
        const { data } = await supabase
          .from('providers').select('*').eq('id', profileData.provider_id).maybeSingle()
        prov = data
      }
      if (stale()) return
      setProvider(prov)
      setProfile(profileData)
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      if (!stale()) {
        setLoading(false)
        fetchingRef.current = false
      }
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, role, providerCode = null, phone = null, fullName = null) {
    let provider_id = null

    if (role === 'distribuidor' && providerCode) {
      const { data: provRows } = await supabase
        .rpc('lookup_provider_code', { p_code: providerCode.trim() })
      const prov = provRows?.[0]
      if (!prov) throw new Error('Código de proveedor inválido')
      if (!prov.is_active) throw new Error('Este proveedor no está activo actualmente')
      provider_id = prov.id
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          provider_id: provider_id || null,
          phone: phone || null,
          full_name: fullName || null,
        }
      }
    })
    if (error) throw error

    // El perfil lo crea el trigger handle_new_user en la base de datos.
    // Este insert es solo un respaldo; si falla (duplicado o permisos) no importa.
    if (data?.user?.id) await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email,
        full_name: fullName || null,
        role,
        provider_id: provider_id || null,
        phone: phone || null,
        is_active: false,
      })


    return data
  }

  async function signOut() {
    currentUserRef.current = null
    setProfile(null)
    setProvider(null)
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (session?.user) {
      fetchingRef.current = false
      await fetchProfile(session.user.id)
    }
  }

  const isAdmin = profile?.role === 'admin'
  const isProveedor = profile?.role === 'proveedor'
  const isDistribuidor = profile?.role === 'distribuidor'
  const isActive = profile?.is_active
  const isProviderActive = provider?.is_active && provider?.expires_at
    ? new Date(provider.expires_at) > new Date()
    : false

  return (
    <AuthContext.Provider value={{
      session, user, profile, provider,
      loading, signIn, signUp, signOut, refreshProfile,
      isAdmin, isProveedor, isDistribuidor,
      isActive, isProviderActive,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}