import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useBalance } from '@/hooks/useBalance'
import { useAssistantData } from '@/hooks/useAssistantData'
import { PageHeader, Spinner, EmptyState, useToast } from '@/components/ui'
import AssistantChat from '@/components/shared/AssistantChat'
import { IconBot } from '@/assets/icons'

export default function DistAsistente() {
  const { provider, profile } = useAuth()
  const { balance, loading: balLoading } = useBalance()
  const { addItem } = useCart()
  const toast = useToast()
  const data = useAssistantData(provider?.id)
  const config = provider?.assistant || {}
  const name = config.name || 'Asistente'

  if (config.enabled === false) {
    return <div className="card"><EmptyState icon={IconBot} title="Asistente no disponible" description="Tu proveedor desactivó el asistente. Escríbele por WhatsApp si tienes dudas." /></div>
  }

  function onAdd(items) {
    items.forEach(p => addItem(p))
    toast.success(items.length === 1 ? `${items[0].name} agregado al carrito` : `Combo de ${items.length} agregado al carrito`)
  }

  return (
    <div>
      <PageHeader title="Pregúntale a" accent={name} subtitle={`Precios, comparaciones y guías de ${provider?.display_name || 'tu tienda'}, al instante`} />
      <div className="card p-4 sm:p-5 chat-shell animate-slide-up">
        {!data || balLoading ? <div className="h-full grid place-items-center"><Spinner size={24} /></div> : (
          <AssistantChat
            ctx={{ ...data, provider, balance, config }}
            storageKey={`sv-bot-${profile?.id}`}
            onAdd={onAdd}
          />
        )}
      </div>
    </div>
  )
}
