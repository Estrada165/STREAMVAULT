import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { CartProvider } from '@/context/CartContext'
import AppRouter from '@/router/AppRouter'
import { ToastProvider } from '@/components/ui/feedback'
import ErrorBoundary from '@/components/ErrorBoundary'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@/styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <ErrorBoundary>
                <AppRouter />
              </ErrorBoundary>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
