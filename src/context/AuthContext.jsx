import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  useEffect(() => {
    // Get initial session once
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Only handle sign out events to reset state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        setProvider(null)
        setLoading(false)
        fetchingRef.current = false
      }
      // SIGNED_IN is handled by getSession above to avoid double fetch
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) { console.error('fetchProfile error:', error); return }
      if (!profileData) { console.warn('No profile found for', userId); return }

      setProfile(profileData)

      if (profileData.role === 'proveedor') {
        const { data: prov } = await supabase
          .from('providers').select('*').eq('user_id', userId).maybeSingle()
        setProvider(prov)
      } else if (profileData.role === 'distribuidor' && profileData.provider_id) {
        const { data: prov } = await supabase
          .from('providers').select('*').eq('id', profileData.provider_id).maybeSingle()
        setProvider(prov)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, role, providerCode = null, phone = null) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    let provider_id = null

    if (role === 'distribuidor' && providerCode) {
      const { data: prov } = await supabase
        .from('providers')
        .select('id, is_active')
        .eq('slug', providerCode.toLowerCase())
        .single()

      if (!prov) throw new Error('Código de proveedor inválido')
      if (!prov.is_active) throw new Error('Este proveedor no está activo actualmente')
      provider_id = prov.id
    }

    // Insert profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email,
        role,
        provider_id,
        phone: phone || null,
        is_active: false,
      })

    if (profileError) throw profileError
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setProvider(null)
  }

  async function refreshProfile() {
    if (session?.user) await fetchProfile(session.user.id)
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
