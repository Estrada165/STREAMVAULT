import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/*
  Avisos (toasts) y confirmaciones con el estilo de la app.
  Reemplazan alert() y confirm() del navegador.

  const toast = useToast()
  toast('Guardado')                       // neutro
  toast.success('Compra realizada')
  toast.error('No se pudo guardar')

  const confirm = useConfirm()
  if (!await confirm({ title: '¿Eliminar?', message: '...', danger: true, confirmText: 'Eliminar' })) return
*/

const FeedbackContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const idRef = useRef(0)

  const dismiss = useCallback(id => {
    setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 220)
  }, [])

  const push = useCallback((message, type = 'info', ms = 3200) => {
    const id = ++idRef.current
    setToasts(t => [...t.slice(-3), { id, message, type }])
    setTimeout(() => dismiss(id), ms)
    return id
  }, [dismiss])

  const toast = useCallback((m, ms) => push(m, 'info', ms), [push])
  toast.success = (m, ms) => push(m, 'success', ms)
  toast.error = (m, ms) => push(m, 'error', ms || 4500)

  const confirm = useCallback(opts => new Promise(resolve => {
    setDialog({ ...(typeof opts === 'string' ? { message: opts } : opts), resolve })
  }), [])

  function close(result) {
    dialog?.resolve(result)
    setDialog(null)
  }

  const dotColor = { info: 'var(--b)', success: 'var(--a)', error: 'var(--status-red)' }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.leaving ? 'leaving' : ''}`} role={t.type === 'error' ? 'alert' : 'status'} onClick={() => dismiss(t.id)}>
              <span className="dot dot-glow" style={{ color: dotColor[t.type] }} />
              <span className="flex-1">{t.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
      {dialog && createPortal(
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(false) }}>
          <div className="modal-content max-w-sm" role="alertdialog" aria-modal="true">
            <h2 className="font-display font-semibold text-[1.1rem] text-[var(--ink)] mb-2">{dialog.title || '¿Confirmas esta acción?'}</h2>
            {dialog.message && <p className="text-sm text-[var(--ink-muted)] leading-relaxed whitespace-pre-line">{dialog.message}</p>}
            <div className="flex flex-wrap justify-end gap-2.5 mt-6">
              <button className="btn-ghost" onClick={() => close(false)}>{dialog.cancelText || 'Cancelar'}</button>
              <button className={dialog.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)} autoFocus>
                {dialog.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </FeedbackContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx.toast
}

export function useConfirm() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ToastProvider')
  return ctx.confirm
}
