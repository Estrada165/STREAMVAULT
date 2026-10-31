import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export function useBalance() {
  const { profile } = useAuth()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchBalance()

    const channel = supabase
      // Nombre único: este hook se usa en varios lugares a la vez (menú y Tienda)
      .channel(`balance-${profile.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'balances',
        filter: `user_id=eq.${profile.id}`
      }, payload => {
        setBalance(payload.new.amount_usd)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile])

  async function fetchBalance() {
    if (!profile) return
    const { data } = await supabase
      .from('balances')
      .select('amount_usd')
      .eq('user_id', profile.id)
      .single()
    setBalance(data?.amount_usd || 0)
    setLoading(false)
  }

  return { balance, loading, refetch: fetchBalance }
}
