import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getMethodMeta } from '@/lib/paymentMethods'

/**
 * Reúne la información de la tienda que usa el asistente:
 * productos visibles (con stock), métodos de pago y tipo de cambio.
 * Sirve para el distribuidor y para el proveedor (vista de prueba).
 */
export function useAssistantData(providerId) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!providerId) return
    let alive = true
    ;(async () => {
      const [{ data: prods }, { data: methods }, { data: settings }] = await Promise.all([
        supabase.from('products').select('*, platforms(name, logo_filename)').eq('provider_id', providerId).eq('is_active', true),
        supabase.from('payment_methods').select('*').eq('provider_id', providerId).eq('is_active', true),
        supabase.from('settings').select('key, value').eq('key', 'exchange_rate'),
      ])
      const ids = (prods || []).map(p => p.id)
      const { data: counts } = ids.length ? await supabase.rpc('get_stock_counts', { p_product_ids: ids }) : { data: [] }
      const stock = Object.fromEntries((counts || []).map(c => [c.product_id, Number(c.available) || 0]))
      if (!alive) return
      setData({
        rate: parseFloat(settings?.[0]?.value) || 3.5,
        products: (prods || []).map(p => ({
          ...p,
          platformName: p.custom_platform_name || p.platforms?.name || 'Otros',
          logo_filename: p.custom_platform_name ? null : p.platforms?.logo_filename,
          price_usd: parseFloat(p.price_usd) || 0,
          stock: p.delivery_mode === 'stock' ? stock[p.id] || 0 : null,
        })),
        methods: (methods || []).map(m => { const meta = getMethodMeta(m.method_key); return { ...m, label: meta.label, logo: meta.logo } }),
      })
    })()
    return () => { alive = false }
  }, [providerId])
  return data
}
