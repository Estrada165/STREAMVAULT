import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useSettings() {
  const [settings, setSettings] = useState({ exchange_rate: 3.5 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    const { data } = await supabase.from('settings').select('key, value')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.key] = row.value })
      setSettings({ exchange_rate: parseFloat(map.exchange_rate) || 3.5, ...map })
    }
    setLoading(false)
  }

  return { settings, loading, refetch: fetchSettings }
}
