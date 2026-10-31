import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const { profile } = useAuth()

  // Otro usuario en el mismo navegador no hereda el carrito anterior
  useEffect(() => { setItems([]) }, [profile?.id])

  function addItem(product) {
    setItems(prev => [...prev, { ...product, uid: crypto.randomUUID() }])
  }

  function removeItem(uid) {
    setItems(prev => prev.filter(i => i.uid !== uid))
  }

  function updateQuantity(productId, delta) {
    if (delta > 0) {
      const base = items.find(i => i.id === productId)
      if (base) setItems(prev => [...prev, { ...base, uid: crypto.randomUUID() }])
    } else {
      setItems(prev => {
        const lastIdx = [...prev].map((i, idx) => ({ ...i, idx })).filter(i => i.id === productId).pop()?.idx
        if (lastIdx === undefined) return prev
        return prev.filter((_, i) => i !== lastIdx)
      })
    }
  }

  function clearCart() {
    setItems([])
  }

  const total = items.reduce((sum, i) => sum + i.price_usd, 0)
  const count = items.length

  const grouped = items.reduce((acc, item) => {
    const existing = acc.find(g => g.id === item.id)
    if (existing) {
      existing.quantity++
      existing.subtotal = parseFloat((existing.subtotal + item.price_usd).toFixed(2))
    } else {
      acc.push({ ...item, quantity: 1, subtotal: item.price_usd })
    }
    return acc
  }, [])

  return (
    <CartContext.Provider value={{ items, grouped, addItem, removeItem, updateQuantity, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}