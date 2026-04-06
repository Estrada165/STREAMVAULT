import { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  function addItem(product) {
    setItems(prev => {
      const exists = prev.find(i => i.id === product.id)
      if (exists) return prev
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  function removeItem(productId) {
    setItems(prev => prev.filter(i => i.id !== productId))
  }

  function clearCart() {
    setItems([])
  }

  const total = items.reduce((sum, i) => sum + i.price_usd, 0)
  const count = items.length

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
