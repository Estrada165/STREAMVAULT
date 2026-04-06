import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
console.log('SUPABASE URL:', import.meta.env.VITE_SUPABASE_URL)

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)       // auth.users row
  const [profile, setProfile] = useState(null) // public.users row
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setProvider(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

async function fetchProfile(userId) {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Profile error:', profileError)
      setLoading(false)
      return
    }

    if (!profileData) {
      console.warn('Sin perfil para:', userId)
      setLoading(false)
      return
    }

    setProfile(profileData)

    if (profileData.role === 'proveedor') {
      const { data: prov } = await supabase
        .from('providers').select('*')
        .eq('user_id', userId).maybeSingle()
      setProvider(prov)
    } else if (profileData.role === 'distribuidor' && profileData.provider_id) {
      const { data: prov } = await supabase
        .from('providers').select('*')
        .eq('id', profileData.provider_id).maybeSingle()
      setProvider(prov)
    }
  } catch (err) {
    console.error('Error fetchProfile:', err)
  } finally {
    setLoading(false)
  }
}

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

async function signUp(email, password, role, providerCode = null, fullName = '') {
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
   // Insert profile
const { error: profileError } = await supabase
  .from('users')
  .insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    provider_id,
    is_active: false,
  })

if (profileError) throw profileError

// Si es proveedor, crear automáticamente su fila en providers
if (role === 'proveedor') {
  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
  const { error: provError } = await supabase
    .from('providers')
    .insert({
      user_id: data.user.id,
      slug: slug + '-' + Math.random().toString(36).slice(2, 6),
      display_name: fullName,
      is_active: false,
    })
  if (provError) console.error('Error creando provider:', provError)
}
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
