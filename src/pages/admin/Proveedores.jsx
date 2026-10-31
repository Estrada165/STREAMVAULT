import { useState, useEffect } from 'react'
import { APP_FULL_NAME } from '@/lib/brand'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, Badge, EmptyState, Tabs, SkeletonList, Toggle, useToast } from '@/components/ui'
import { IconUsers, IconSearch, IconEdit, IconTrash, IconWhatsApp, IconCalendar, IconPower, IconCheck } from '@/assets/icons'
import { daysRemaining, getDaysColor, formatDate } from '@/utils'
import { waLink } from '@/lib/whatsapp'
import { PAY_METHODS, parseAmount, currencyOf, extendProviderAccess, registerPayment, nextExpiry } from '@/lib/admin'

export default function AdminProveedores() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState('all')
  const [modal, setModal] = useState(null)
  const [extendDays, setExtendDays] = useState(30)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCost, setEditCost] = useState('')
  const [pay, setPay] = useState({ on: true, amount: '', currency: 'PEN', method: 'Yape', note: '' })
  const toast = useToast()

  useEffect(() => { fetchProviders() }, [])

  async function fetchProviders() {
    const { data: provs } = await supabase.from('providers').select('*').order('created_at', { ascending: false })
    if (!provs?.length) { setProviders([]); setLoading(false); return }
    const userIds = provs.map(p => p.user_id)
    const { data: usersData } = await supabase.from('users').select('id, email, full_name, phone, is_active').in('id', userIds)
    const usersMap = {}
    usersData?.forEach(u => { usersMap[u.id] = u })
    setProviders(provs.map(p => ({ ...p, users: usersMap[p.user_id] || {} })))
    setLoading(false)
  }

  async function toggleActive(provider) {
    const newActive = !provider.is_active
    await supabase.from('providers').update({ is_active: newActive }).eq('id', provider.id)
    await supabase.from('users').update({ is_active: newActive }).eq('id', provider.user_id)
    if (!newActive) {
      // Desactivar: apagar todos los distribuidores
      await supabase.from('users').update({ is_active: false }).eq('provider_id', provider.id).eq('role', 'distribuidor')
    } else {
      // Reactivar: encender distribuidores que estaban activos antes
      // Solo los que tienen provider_id correcto — el admin puede activarlos manualmente si quiere seleccionar
      await supabase.from('users').update({ is_active: true }).eq('provider_id', provider.id).eq('role', 'distribuidor')
    }
    fetchProviders()
    toast(newActive ? 'Proveedor y sus distribuidores activados' : 'Proveedor y sus distribuidores desactivados')
  }

  async function extendAccess() {
    if (!extendDays || parseInt(extendDays) === 0) return setError('Ingresa un número de días distinto de 0')
    const days = parseInt(extendDays)
    const charge = days > 0 && pay.on && parseFloat(pay.amount) > 0
    setSaving(true); setError('')
    try {
      await extendProviderAccess(modal.data, days)
      if (charge) await registerPayment({ providerId: modal.data.id, amount: pay.amount, currency: pay.currency, days, method: pay.method, note: pay.note })
      setModal(null); fetchProviders()
      toast.success(charge ? 'Acceso actualizado y cobro registrado' : 'Acceso actualizado')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  function openExtend(provider) {
    setExtendDays(30); setError('')
    setPay({ on: true, amount: parseAmount(provider.renewal_cost), currency: currencyOf(provider.renewal_cost), method: 'Yape', note: '' })
    setModal({ type: 'extend', data: provider })
  }

  function openEdit(provider) {
    setEditPhone(provider.users?.phone || '')
    setEditCost(provider.renewal_cost || '')
    setError('')
    setModal({ type: 'edit', data: provider })
  }

  async function saveEdit() {
    setSaving(true); setError('')
    try {
      await supabase.from('users').update({ phone: editPhone.trim() || null }).eq('id', modal.data.user_id)
      await supabase.from('providers').update({ renewal_cost: editCost.trim() || null }).eq('id', modal.data.id)
      setModal(null); fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  function sendRenewalMessage(provider) {
    const phone = (provider.users?.phone || '').replace(/\D/g, '')
    if (!phone) return toast.error('Este proveedor no tiene número de teléfono configurado.')
    const name = provider.display_name || provider.users?.full_name || 'Proveedor'
    const days = provider.expires_at ? daysRemaining(provider.expires_at) : null
    const daysText = days !== null && days <= 0 ? 'ya ha vencido' : days !== null ? `vence en ${days} día${days === 1 ? '' : 's'}` : 'está próximo a vencer'
    const costText = provider.renewal_cost ? `El costo de renovación es *${provider.renewal_cost}*.` : ''
    const msg = `Hola ${name}! 👋\n\nTu acceso a *${APP_FULL_NAME}* ${daysText}.\n${costText}\n\nPara continuar disfrutando del servicio, por favor coordina tu renovación. ¡Gracias!`
    window.open(waLink(phone, msg), '_blank')
  }

  function openDelete(provider) {
    setModal({ type: 'delete', data: provider })
    setDeleteConfirmText(''); setError('')
  }

  async function confirmDeleteProvider() {
    if (deleteConfirmText !== 'ELIMINAR') return
    const provider = modal.data
    setSaving(true); setError('')
    try {
      const { data: products } = await supabase.from('products').select('id').eq('provider_id', provider.id)
      const productIds = products?.map(p => p.id) || []
      if (productIds.length) {
        await supabase.from('orders').update({ stock_item_id: null }).in('product_id', productIds)
        await supabase.from('orders').delete().in('product_id', productIds)
        await supabase.from('stock_items').delete().in('product_id', productIds)
        await supabase.from('support_tickets').delete().eq('provider_id', provider.id)
        await supabase.from('products').delete().eq('provider_id', provider.id)
      }
      await supabase.from('users').update({ is_active: false, provider_id: null }).eq('provider_id', provider.id)
      await supabase.from('providers').delete().eq('id', provider.id)
      await supabase.from('users').update({ is_active: false }).eq('id', provider.user_id)
      setModal(null); fetchProviders()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  // ── Filtro por tab ──────────────────────────────────────────
  const byTab = providers.filter(p => {
    if (filterTab === 'activo') return p.is_active
    if (filterTab === 'inactivo') return !p.is_active && p.expires_at  // tiene cuenta pero desactivado
    if (filterTab === 'pendiente') return !p.is_active && !p.expires_at // nunca activado
    return true // 'all'
  })

  const filtered = byTab.filter(p =>
    (p.display_name || p.users?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.users?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || '').includes(search.toLowerCase())
  )

  const counts = {
    all: providers.length,
    activo: providers.filter(p => p.is_active).length,
    pendiente: providers.filter(p => !p.is_active && !p.expires_at).length,
    inactivo: providers.filter(p => !p.is_active && p.expires_at).length,
  }

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Activa cuentas, ajusta días de acceso y avisa renovaciones"
        action={<button className="btn-secondary" onClick={() => setModal({ type: 'info' })}><IconUsers size={15} />¿Cómo agregar?</button>}
      />

      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <Tabs
          tabs={[
            { label: 'Todos', value: 'all', count: counts.all },
            { label: 'Activos', value: 'activo', count: counts.activo },
            { label: 'Pendientes', value: 'pendiente', count: counts.pendiente },
            { label: 'Desactivados', value: 'inactivo', count: counts.inactivo },
          ]}
          active={filterTab}
          onChange={v => { setFilterTab(v); setSearch('') }}
        />
        <label className="relative flex-1">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
          <input className="input input-icon" placeholder="Buscar por nombre, correo o código" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar proveedor" />
        </label>
      </div>

      {loading ? <SkeletonList rows={5} /> : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={IconUsers} title="Sin proveedores" description={filterTab === 'pendiente' ? 'No hay proveedores pendientes de activación.' : filterTab === 'inactivo' ? 'No hay proveedores desactivados.' : 'Aparecen aquí cuando se registran en la app.'} /></div>
      ) : (
        <div className="grid gap-3 stagger">
          {filtered.map(p => {
            const days = p.expires_at ? daysRemaining(p.expires_at) : null
            const dColor = days !== null ? getDaysColor(days) : null
            const isExpiringSoon = days !== null && days <= 7
            const hasPhone = !!p.users?.phone
            const name = p.display_name || p.users?.full_name || '—'
            return (
              <article key={p.id} className={`card p-4 sm:p-5 ${isExpiringSoon && p.is_active ? '!border-[var(--status-yellow-border)]' : ''} ${!p.is_active ? 'opacity-90' : ''}`}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
                  <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                    <span className="w-11 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center font-display font-bold flex-shrink-0 shadow-[inset_0_1px_0_var(--hl),0_3px_0_var(--a-edge)]">{name[0]}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[15px] text-[var(--ink)] truncate">{name}</p>
                        <Badge color={p.is_active ? 'green' : !p.expires_at ? 'violet' : 'red'} dot>{p.is_active ? 'Activo' : !p.expires_at ? 'Pendiente' : 'Inactivo'}</Badge>
                      </div>
                      <p className="text-xs text-[var(--ink-faint)] truncate">{p.users?.email} · <span className="font-mono">{p.slug}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-5 text-[13px]">
                    <div>
                      <p className="eyebrow !text-[10px] mb-1">Teléfono</p>
                      {hasPhone ? <a href={waLink(p.users.phone.replace(/\D/g, ''))} target="_blank" rel="noreferrer" className="text-[var(--a)] font-medium hover:underline whitespace-nowrap">{p.users.phone}</a> : <span className="text-[var(--ink-faint)]">—</span>}
                    </div>
                    <div>
                      <p className="eyebrow !text-[10px] mb-1">Costo</p>
                      <span className="font-mono text-[var(--ink)]">{p.renewal_cost || '—'}</span>
                    </div>
                    <div>
                      <p className="eyebrow !text-[10px] mb-1">Vence</p>
                      {days !== null
                        ? <span className={`days-pill ${dColor}`} title={formatDate(p.expires_at)}>{days <= 0 ? 'Vencido' : `${days} d`}</span>
                        : <span className="text-[var(--ink-faint)]">—</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => openExtend(p)} className="btn-primary btn-sm flex-1 sm:flex-none"><IconCalendar size={14} />Días</button>
                    {hasPhone && <button onClick={() => sendRenewalMessage(p)} className={`btn-sm btn-icon ${isExpiringSoon ? 'btn-accent' : 'btn-secondary'}`} title="Enviar aviso de renovación" aria-label="Enviar aviso de renovación"><IconWhatsApp size={14} /></button>}
                    <button onClick={() => openEdit(p)} className="btn-secondary btn-sm btn-icon" title="Editar teléfono y costo" aria-label="Editar teléfono y costo"><IconEdit size={14} /></button>
                    <button onClick={() => toggleActive(p)} className={`btn-secondary btn-sm btn-icon ${p.is_active ? 'hover:!text-[var(--status-red)]' : '!text-[var(--a)]'}`} title={p.is_active ? 'Desactivar' : 'Activar'} aria-label={p.is_active ? 'Desactivar' : 'Activar'}>
                      {p.is_active ? <IconPower size={14} /> : <IconCheck size={14} />}
                    </button>
                    <button onClick={() => openDelete(p)} className="btn-ghost btn-sm !px-2 hover:!text-[var(--status-red)]" title="Eliminar proveedor" aria-label="Eliminar proveedor"><IconTrash size={14} /></button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ── Editar ── */}
      <Modal
        open={modal?.type === 'edit'}
        onClose={() => setModal(null)}
        title="Datos del proveedor"
        subtitle={modal?.data?.display_name || modal?.data?.users?.full_name || modal?.data?.users?.email}
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={saveEdit} disabled={saving} className="btn-primary min-w-[110px]">{saving ? <Spinner size={15} /> : 'Guardar'}</button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">WhatsApp / teléfono</label>
            <input className="input" placeholder="+51 999 999 999" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Costo de renovación</label>
            <input className="input" placeholder="S/ 50 al mes" value={editCost} onChange={e => setEditCost(e.target.value)} />
            <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Aparece en el mensaje de renovación y en el menú del proveedor.</p>
          </div>
          {(editPhone || editCost) && (
            <div>
              <p className="label">Vista previa del mensaje</p>
              <div className="rounded-2xl p-3.5 border border-[var(--surface-border)]" style={{ background: 'color-mix(in srgb, var(--a) 6%, var(--surface-overlay))' }}>
                <p className="ml-auto max-w-[95%] rounded-2xl rounded-tr-md px-3.5 py-2.5 bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[13px] text-[var(--ink)] leading-relaxed whitespace-pre-wrap">
                  {`Hola ${modal?.data?.display_name || modal?.data?.users?.full_name || 'Proveedor'}! 👋\n\nTu acceso a *${APP_FULL_NAME}* vence en X días.\n${editCost ? `El costo de renovación es *${editCost}*.` : ''}\n\nPara continuar disfrutando del servicio, por favor coordina tu renovación. ¡Gracias!`}
                </p>
              </div>
            </div>
          )}
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>

      {/* ── Ajustar días ── */}
      <Modal
        open={modal?.type === 'extend'}
        onClose={() => setModal(null)}
        title="Días de acceso"
        subtitle={`${modal?.data?.display_name || modal?.data?.users?.email || ''} · vence ${modal?.data?.expires_at ? formatDate(modal.data.expires_at) : 'sin fecha'}`}
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={extendAccess} disabled={saving} className={parseInt(extendDays) < 0 ? 'btn-danger min-w-[120px]' : 'btn-primary min-w-[120px]'}>
            {saving ? <Spinner size={15} /> : parseInt(extendDays) >= 0 ? `+${extendDays} días` : `${extendDays} días`}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-1.5">
            {[7, 15, 30, 60, 90, -7, -15, -30].map(d => (
              <button key={d} onClick={() => setExtendDays(d)} className={`btn-secondary btn-sm !px-0 ${extendDays === d ? 'is-down' : ''} ${d < 0 ? '!text-[var(--status-red)]' : extendDays === d ? '!text-[var(--a)]' : ''}`}>
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
          <div>
            <label className="label">O escribe los días (negativo para restar)</label>
            <input type="number" className="input font-mono" value={extendDays} onChange={e => setExtendDays(e.target.value)} placeholder="30" />
          </div>
          {extendDays !== '' && parseInt(extendDays) !== 0 && (
            <div className="rounded-xl px-3.5 py-2.5 text-[13px] bg-[var(--a-soft)] border border-[var(--a-line)] flex justify-between">
              <span className="text-[var(--ink-muted)]">Nueva fecha</span>
              <span className="font-semibold text-[var(--a)]">{(() => {
                const d = nextExpiry(modal?.data?.expires_at, extendDays)
                return d > new Date(Date.now() + 6e4) ? d.toLocaleDateString('es-PE') : 'Hoy (mínimo)'
              })()}</span>
            </div>
          )}
          {parseInt(extendDays) > 0 && !modal?.data?.is_active && <p className="text-xs text-[var(--ink-muted)]">Al sumar días la cuenta queda activa.</p>}
          {parseInt(extendDays) > 0 && (
            <div className="rounded-2xl border border-[var(--surface-border)] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Registrar cobro</p>
                  <p className="text-[11.5px] text-[var(--ink-faint)]">Queda en Cobros para tu control de ingresos</p>
                </div>
                <Toggle checked={pay.on} onChange={v => setPay(p => ({ ...p, on: v }))} />
              </div>
              {pay.on && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex gap-2">
                    <div className="inset flex p-1 gap-1 flex-shrink-0">
                      {['PEN', 'USD'].map(c => (
                        <button key={c} type="button" onClick={() => setPay(p => ({ ...p, currency: c }))} className={`px-2.5 h-8 rounded-[.55rem] text-xs font-semibold border ${pay.currency === c ? 'bg-[var(--key)] text-[var(--ink)] border-[var(--surface-border-strong)]' : 'border-transparent text-[var(--ink-faint)]'}`}>{c === 'PEN' ? 'S/' : '$'}</button>
                      ))}
                    </div>
                    <input type="number" inputMode="decimal" min="0" step="0.5" className="input font-mono" placeholder="Monto" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} aria-label="Monto cobrado" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PAY_METHODS.map(m => <button key={m} type="button" onClick={() => setPay(p => ({ ...p, method: m }))} className={`btn-secondary btn-sm ${pay.method === m ? 'is-down !text-[var(--a)]' : ''}`}>{m}</button>)}
                  </div>
                  <input className="input" maxLength={200} placeholder="Nota (opcional): n.º de operación, etc." value={pay.note} onChange={e => setPay(p => ({ ...p, note: e.target.value }))} />
                </div>
              )}
            </div>
          )}
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>

      {/* ── Info ── */}
      <Modal open={modal?.type === 'info'} onClose={() => setModal(null)} title="Agregar un proveedor" maxWidth="max-w-sm">
        <ol className="space-y-3 text-sm text-[var(--ink-muted)]">
          {['Se registra en /register eligiendo "Proveedor".', 'Aparece aquí en "Pendientes".', 'Le das días de acceso y queda activo.'].map((t, i) => (
            <li key={i} className="flex gap-3"><span className="w-6 h-6 rounded-lg inset grid place-items-center font-mono text-xs text-[var(--ink)] flex-shrink-0">{i + 1}</span>{t}</li>
          ))}
        </ol>
        <button onClick={() => setModal(null)} className="btn-primary w-full mt-6">Entendido</button>
      </Modal>

      {/* ── Eliminar ── */}
      <Modal open={modal?.type === 'delete'} onClose={() => setModal(null)} title="Eliminar proveedor" subtitle={modal?.data?.display_name || modal?.data?.users?.email}>
        {modal?.data && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-[var(--status-red-bg)] border border-[var(--status-red-border)] text-[13px] text-[var(--status-red)]">
              <p className="font-semibold mb-2">Esto no se puede deshacer. Se borrará:</p>
              <ul className="list-disc pl-4 space-y-1 leading-relaxed">
                <li>Su acceso a la plataforma</li>
                <li>Todos sus productos y stock</li>
                <li>Los pedidos de sus productos y sus tickets</li>
                <li>Sus distribuidores quedan sin proveedor (no se eliminan)</li>
              </ul>
            </div>
            <div>
              <label className="label">Escribe <span className="text-[var(--status-red)] font-bold">ELIMINAR</span> para confirmar</label>
              <input className="input font-mono" placeholder="ELIMINAR" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} autoComplete="off" />
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <div className="flex gap-2.5">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={confirmDeleteProvider} disabled={saving || deleteConfirmText !== 'ELIMINAR'} className="btn-danger flex-1">{saving ? <Spinner size={15} /> : 'Eliminar todo'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
