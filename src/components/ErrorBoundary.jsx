import { Component } from 'react'

/**
 * Si una pantalla falla, muestra un aviso en lugar de dejar la página en blanco.
 * Si el error es porque se publicó una versión nueva (archivo de pantalla que ya no existe),
 * recarga sola una vez.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Error en pantalla:', error)
    const isChunk = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error?.message || '')
    if (isChunk && !sessionStorage.getItem('sv-chunk-reload')) {
      sessionStorage.setItem('sv-chunk-reload', '1')
      window.location.reload()
    }
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center animate-slide-up">
          <div className="w-14 h-14 rounded-2xl inset grid place-items-center mx-auto mb-5 text-[var(--status-red)]">
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <h2 className="font-display text-xl text-[var(--ink)] mb-2">Algo salió mal en esta pantalla</h2>
          <p className="text-sm text-[var(--ink-muted)] mb-6">Recarga la página. Si sigue pasando, avísale al administrador.</p>
          <button className="btn-primary w-full" onClick={() => { sessionStorage.removeItem('sv-chunk-reload'); window.location.reload() }}>Recargar</button>
        </div>
      </div>
    )
  }
}
