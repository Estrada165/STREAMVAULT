import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export default function PageWrapper({ children }) {
  const { profile } = useAuth()
  const [ticketCount, setTicketCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    fetchCounts()

    const channel = supabase
      .channel('realtime-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, fetchCounts)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile])

  async function fetchCounts() {
    if (!profile) return
    const { count: n } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setNotifCount(n || 0)

    if (profile.role === 'proveedor') {
      // Get provider id
      const { data: prov } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single()
      if (prov) {
        const { count: t } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('provider_id', prov.id)
          .eq('status', 'abierto')
        setTicketCount(t || 0)
      }
    }
  }

  return (
    <div className="layout-with-sidebar">
      <Sidebar notifCount={notifCount} ticketCount={ticketCount} />
      <main className="main-content">
        <div className="p-5 md:p-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
