import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, PageLoader, Badge, useToast } from '@/components/ui'
import { PlatformLogo } from '@/utils/platform'
import { timeAgo } from '@/utils'
import { IconPackage, IconHeadphones, IconUsers, IconDatabase, IconCheck, IconChevronRight } from '@/assets/icons'

const REASONS = { contrasena_incorrecta: 'Contraseña incorrecta', perfil_ocupado: 'Perfil ocupado', no_da_acceso: 'No da acceso', codigo_invalido: 'Código inválido', otro: 'Otro' }

function Group({ icon: Icon, tone, title, hint, count, children, onAll, allLabel }) {
  return (
    <section className="card overflow-hidden flex flex-col animate-slide-up">
      <header className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3">
        <span className={`w-10 h-10 rounded-xl grid place-items-center border flex-shrink-0 ${count ? tone : 'inset text-[var(--ink-faint)]'}`}><Icon size={18} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-[var(--ink)] leading-tight">{title}</h2>
          <p className="text-xs text-[var(--ink-muted)] truncate">{hint}</p>
        </div>
        <span className={`font-mono text-lg ${count ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}>{count}</span>
      </header>
      {count === 0
        ? <p className="px-5 pb-5 text-sm text-[var(--ink-faint)] flex items-center gap-2"><IconCheck size={14} className="text-[var(--a)]" />Nada pendiente aquí</p>
        : <ul className="divide-y divide-[var(--surface-border)] border-t border-[var(--surface-border)] flex-1">{children}</ul>}
      {count > 5 && onAll && <button onClick={onAll} className="btn-ghost btn-sm justify-center m-2">{allLabel} ({count})<IconChevronRight size={14} /></button>}
    </section>
  )
}

function Row({ onClick, children, action }) {
  return (
    <li className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[var(--surface-side)] transition-colors">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">{children}</button>
      {action}
    </li>
  )
}

export default function ProveedorPendientes() {
  const { provider } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)

  useEffect(() => { if (provider) load() }, [provider])

  async function load() {
    const [{ data: orders }, { data: tickets }, { data: dists }, { data: products }] = await Promise.all([
      supabase.from('orders').select('id, order_code, created_at, client_name, distributor_id, product_id, products(name, platforms(name, logo_filename))')
        .eq('status', 'pendiente_credenciales').order('created_at', { ascending: true }),
      supabase.from('support_tickets').select('id, ticket_code, reason, status, created_at, distributor_id').eq('provider_id', provider.id)
        .in('status', ['abierto', 'en_revision']).order('created_at', { ascending: true }),
      supabase.from('users').select('id, full_name, email, phone, created_at, is_active').eq('provider_id', provider.id).eq('role', 'distribuidor').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, delivery_mode, platforms(name, logo_filename)').eq('provider_id', provider.id).eq('is_active', true).eq('delivery_mode', 'stock'),
    ])
    const ids = (products || []).map(p => p.id)
    const { data: counts } = ids.length ? await supabase.rpc('get_stock_counts', { p_product_ids: ids }) : { data: [] }
    const avail = Object.fromEntries((counts || []).map(c => [c.product_id, Number(c.available) || 0]))
    const names = Object.fromEntries((dists || []).map(d => [d.id, d.full_name || d.email]))
    setData({
      orders: (orders || []).map(o => ({ ...o, dist: names[o.distributor_id] })),
      tickets: (tickets || []).map(t => ({ ...t, dist: names[t.distributor_id] })),
      toActivate: (dists || []).filter(d => !d.is_active),
      stock: (products || []).map(p => ({ ...p, available: avail[p.id] || 0 })).filter(p => p.available < 3).sort((a, b) => a.available - b.available),
    })
  }

  async function activate(d) {
    setData(x => ({ ...x, toActivate: x.toActivate.filter(y => y.id !== d.id) }))
    const { error } = await supabase.from('users').update({ is_active: true }).eq('id', d.id)
    if (error) { toast.error(error.message); load() } else toast.success(`${d.full_name || d.email} activado`)
  }

  if (!data) return <PageLoader />
  const total = data.orders.length + data.tickets.length + data.toActivate.length + data.stock.length
  const waitTone = d => { const h = (Date.now() - new Date(d)) / 36e5; return h > 6 ? 'red' : h > 1 ? 'yellow' : 'neutral' }

  return (
    <div>
      <PageHeader
        eyebrow="Bandeja"
        title="Pendientes"
        subtitle={total ? `${total} cosa${total === 1 ? '' : 's'} por atender, lo más antiguo primero` : 'Todo al día. Buen trabajo.'}
        action={<button onClick={load} className="btn-secondary">Actualizar</button>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Group icon={IconPackage} tone="bg-[var(--b-soft)] border-[var(--b-line)] text-[var(--b)]" title="Pedidos por entregar" hint="Productos a pedido esperando credenciales"
          count={data.orders.length} onAll={() => navigate('/proveedor/ventas', { state: { tab: 'pendiente_credenciales' } })} allLabel="Ver todos">
          {data.orders.slice(0, 5).map(o => (
            <Row key={o.id} onClick={() => navigate('/proveedor/ventas', { state: { tab: 'pendiente_credenciales' } })}
              action={<Badge color={waitTone(o.created_at)}>{timeAgo(o.created_at).replace('hace ', '').replace('alrededor de ', '')}</Badge>}>
              <PlatformLogo name={o.products?.platforms?.name} filename={o.products?.platforms?.logo_filename} size={34} />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-[var(--ink)] truncate">{o.products?.name}</span>
                <span className="block text-[11.5px] text-[var(--ink-faint)] truncate">{o.dist || 'Distribuidor'} · <span className="font-mono">{o.order_code}</span></span>
              </span>
            </Row>
          ))}
        </Group>

        <Group icon={IconHeadphones} tone="bg-[var(--status-yellow-bg)] border-[var(--status-yellow-border)] text-[var(--status-yellow)]" title="Tickets de soporte" hint="Abiertos o en revisión"
          count={data.tickets.length} onAll={() => navigate('/proveedor/soporte', { state: { tab: 'abierto' } })} allLabel="Ir a soporte">
          {data.tickets.slice(0, 5).map(t => (
            <Row key={t.id} onClick={() => navigate('/proveedor/soporte', { state: { tab: t.status } })}
              action={<Badge color={t.status === 'abierto' ? 'yellow' : 'violet'}>{t.status === 'abierto' ? 'Abierto' : 'En revisión'}</Badge>}>
              <span className="w-[34px] h-[34px] rounded-xl inset grid place-items-center text-[var(--ink-faint)] flex-shrink-0"><IconHeadphones size={15} /></span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-[var(--ink)] truncate">{REASONS[t.reason] || t.reason}</span>
                <span className="block text-[11.5px] text-[var(--ink-faint)] truncate">{t.dist || 'Distribuidor'} · {timeAgo(t.created_at)}</span>
              </span>
            </Row>
          ))}
        </Group>

        <Group icon={IconUsers} tone="bg-[var(--a-soft)] border-[var(--a-line)] text-[var(--a)]" title="Distribuidores por activar" hint="Se registraron con tu código"
          count={data.toActivate.length} onAll={() => navigate('/proveedor/distribuidores', { state: { tab: 'off' } })} allLabel="Ver todos">
          {data.toActivate.slice(0, 5).map(d => (
            <Row key={d.id} onClick={() => navigate('/proveedor/distribuidores', { state: { tab: 'off' } })}
              action={<button onClick={() => activate(d)} className="btn-accent btn-sm"><IconCheck size={14} />Activar</button>}>
              <span className="w-[34px] h-[34px] rounded-full inset grid place-items-center text-xs font-bold text-[var(--ink-muted)] uppercase flex-shrink-0">{(d.full_name || d.email)[0]}</span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-[var(--ink)] truncate">{d.full_name || 'Sin nombre'}</span>
                <span className="block text-[11.5px] text-[var(--ink-faint)] truncate">{d.email} · {timeAgo(d.created_at)}</span>
              </span>
            </Row>
          ))}
        </Group>

        <Group icon={IconDatabase} tone="bg-[var(--status-red-bg)] border-[var(--status-red-border)] text-[var(--status-red)]" title="Stock por reponer" hint="Productos visibles con menos de 3 cuentas"
          count={data.stock.length} onAll={() => navigate('/proveedor/stock')} allLabel="Ir a stock">
          {data.stock.slice(0, 5).map(p => (
            <Row key={p.id} onClick={() => navigate('/proveedor/stock', { state: { productId: p.id } })}
              action={<Badge color={p.available === 0 ? 'red' : 'yellow'}>{p.available === 0 ? 'Agotado' : `${p.available} disp.`}</Badge>}>
              <PlatformLogo name={p.platforms?.name} filename={p.platforms?.logo_filename} size={34} />
              <span className="min-w-0"><span className="block text-[13.5px] font-medium text-[var(--ink)] truncate">{p.name}</span>
                <span className="block text-[11.5px] text-[var(--ink-faint)]">Toca para subir stock</span></span>
            </Row>
          ))}
        </Group>
      </div>
    </div>
  )
}
