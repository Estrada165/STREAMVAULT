import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Modal, EmptyState, SkeletonList } from '@/components/ui'
import { timeAgo } from '@/utils'
import { IconBell, IconDatabase, IconPackage, IconWallet, IconHeadphones, IconInfo, IconCheck } from '@/assets/icons'

const TYPE = {
  stock: { icon: IconDatabase, tone: 'text-[var(--status-red)] bg-[var(--status-red-bg)] border-[var(--status-red-border)]' },
  pedido: { icon: IconPackage, tone: 'text-[var(--b)] bg-[var(--b-soft)] border-[var(--b-line)]' },
  recarga: { icon: IconWallet, tone: 'text-[var(--a)] bg-[var(--a-soft)] border-[var(--a-line)]' },
  ticket: { icon: IconHeadphones, tone: 'text-[var(--status-yellow)] bg-[var(--status-yellow-bg)] border-[var(--status-yellow-border)]' },
}
const DEFAULT = { icon: IconInfo, tone: 'text-[var(--ink-muted)] bg-[var(--surface-overlay)] border-[var(--surface-border)]' }

/** A dónde lleva cada notificación al tocarla */
function targetOf(n, role) {
  if (role === 'proveedor') {
    if (n.type === 'stock') return ['/proveedor/stock', { productId: n.ref_id }]
    if (n.type === 'pedido') return ['/proveedor/pendientes']
    if (/ticket|soporte/i.test(n.title)) return ['/proveedor/soporte']
  }
  if (role === 'distribuidor') {
    if (/recarga|saldo/i.test(n.title + n.message)) return ['/saldo']
    if (/credencial|pedido/i.test(n.title + n.message)) return ['/dashboard']
    if (/ticket|soporte/i.test(n.title)) return ['/soporte']
  }
  return null
}

export default function NotificationCenter({ open, onClose, onChange }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState(null)

  useEffect(() => {
    if (!open || !profile) return
    setList(null)
    supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => setList(data || []))
  }, [open, profile])

  async function markAll() {
    setList(l => l.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
    onChange?.()
  }

  async function openItem(n) {
    if (!n.is_read) {
      setList(l => l.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      onChange?.()
    }
    const t = targetOf(n, profile.role)
    if (t) { onClose(); navigate(t[0], t[1] ? { state: t[1] } : undefined) }
  }

  const unread = list?.filter(n => !n.is_read).length || 0

  return (
    <Modal open={open} onClose={onClose} title="Notificaciones" subtitle={unread ? `${unread} sin leer` : 'Estás al día'} maxWidth="max-w-md">
      {unread > 0 && <button onClick={markAll} className="btn-ghost btn-sm -mt-2 mb-3"><IconCheck size={14} />Marcar todo como leído</button>}
      {!list ? <SkeletonList rows={4} /> : list.length === 0 ? (
        <EmptyState icon={IconBell} title="Sin notificaciones" description="Aquí te avisamos de stock bajo, pedidos por entregar, recargas y respuestas de soporte." />
      ) : (
        <ul className="-mx-2 space-y-1">
          {list.map(n => {
            const t = TYPE[n.type] || DEFAULT
            return (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={`w-full flex items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-overlay)] ${n.is_read ? 'opacity-70' : ''}`}>
                  <span className={`w-9 h-9 rounded-xl border grid place-items-center flex-shrink-0 ${t.tone}`}><t.icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{n.title}</span>
                      {!n.is_read && <span className="notif-dot flex-shrink-0" />}
                    </span>
                    <span className="block text-[12.5px] text-[var(--ink-muted)] leading-snug mt-0.5">{n.message}</span>
                    <span className="block text-[11px] text-[var(--ink-faint)] mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
