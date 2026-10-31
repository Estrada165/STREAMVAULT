import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import BalanceHistory from '@/components/shared/BalanceHistory'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Badge, Toggle, Tabs, StatCard, PageLoader, CopyField, useToast, useConfirm } from '@/components/ui'
import { IconUsers, IconDollar, IconSearch, IconTrash, IconWhatsApp, IconCheck, IconClock, IconX, IconWallet } from '@/assets/icons'
import { formatUSD, formatDate } from '@/utils'
import { waLink } from '@/lib/whatsapp'
import { rpcError } from '@/lib/rpcError'

export default function ProveedorDistribuidores() {
  const { provider } = useAuth()
  const { settings } = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const rate = parseFloat(settings?.exchange_rate) || 3.5
  const location = useLocation()
  const [view, setView] = useState(location.state?.view || 'red')
  const [histFor, setHistFor] = useState(null)

  const [distributors, setDistributors] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(location.state?.tab || 'all')
  const [modal, setModal] = useState(null)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (provider) fetchDistributors() }, [provider])

  async function fetchDistributors() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('provider_id', provider.id)
      .eq('role', 'distribuidor')
      .order('created_at', { ascending: false })
    setDistributors(data || [])

    if (data?.length) {
      const map = {}
      const ids = data.map(d => d.id)
      for (let i = 0; i < ids.length; i += 100) {
        const { data: bals } = await supabase.from('balances').select('user_id, amount_usd').in('user_id', ids.slice(i, i + 100))
        bals?.forEach(b => { map[b.user_id] = b.amount_usd })
      }
      setBalances(map)
    }
    setLoading(false)
  }

  async function toggleDistributor(d) {
    setDistributors(prev => prev.map(x => x.id === d.id ? { ...x, is_active: !d.is_active } : x))
    const { error: err } = await supabase.from('users').update({ is_active: !d.is_active }).eq('id', d.id)
    if (err) { toast.error(err.message); fetchDistributors(); return }
    toast(d.is_active ? `${d.full_name || d.email} desactivado` : `${d.full_name || d.email} activado`)
  }

  async function deleteDistributor(d) {
    const ok = await confirm({
      title: '¿Eliminar distribuidor?',
      message: `"${d.full_name || d.email}" perderá el acceso y se borrarán sus pedidos y saldo. No se puede deshacer.`,
      danger: true, confirmText: 'Eliminar',
    })
    if (!ok) return
    const { error: err } = await supabase.from('users').delete().eq('id', d.id)
    if (err) return toast.error(err.message)
    toast.success('Distribuidor eliminado')
    fetchDistributors()
  }

  async function recharge() {
    const amount = parseFloat(rechargeAmount)
    if (!amount || amount <= 0) return setError('Ingresa un monto válido')
    setSaving(true); setError('')
    try {
      // Todo en un solo paso en la base de datos: saldo + movimiento + aviso (o nada si algo falla)
      const { data: newAmount, error: rpcErr } = await supabase.rpc('provider_recharge', { p_user: modal.data.id, p_amount: amount })
      if (rpcErr) throw new Error(rpcError(rpcErr))
      setBalances(b => ({ ...b, [modal.data.id]: parseFloat(newAmount) }))
      toast.success(`${formatUSD(amount)} recargados a ${modal.data.full_name || modal.data.email}`)
      setModal(null)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  const q = search.toLowerCase()
  const pendingCount = distributors.filter(d => !d.is_active).length
  const filtered = distributors
    .filter(d => tab === 'all' || (tab === 'on' ? d.is_active : !d.is_active))
    .filter(d => (d.full_name || '').toLowerCase().includes(q) || d.email.toLowerCase().includes(q) || (d.phone || '').includes(q))
  const totalBalance = Object.values(balances).reduce((s, v) => s + parseFloat(v || 0), 0)
  const amount = parseFloat(rechargeAmount) || 0

  return (
    <div>
      <PageHeader title="Distribuidores" subtitle="Activa cuentas, recarga saldo y gestiona tu red" />

      <Tabs className="mb-5" tabs={[{ label: 'Mi red', value: 'red', count: distributors.length }, { label: 'Movimientos de saldo', value: 'movs' }]} active={view} onChange={setView} />

      {view === 'movs' ? <BalanceHistory mode="provider" providerId={provider?.id} /> : <>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger">
        <StatCard label="Total" value={distributors.length} icon={IconUsers} color="violet" />
        <StatCard label="Activos" value={distributors.length - pendingCount} icon={IconCheck} color="green" />
        <StatCard label="Por activar" value={pendingCount} icon={IconClock} color={pendingCount ? 'yellow' : 'neutral'} highlight={pendingCount > 0} />
        <StatCard label="Saldo en la red" value={formatUSD(totalBalance)} icon={IconDollar} color="neutral" />
      </div>

      {provider?.slug && (
        <div className="card p-4 sm:p-5 mb-6 grid sm:grid-cols-[1fr_minmax(0,320px)] gap-4 items-center animate-slide-up">
          <div>
            <p className="font-semibold text-[var(--ink)]">Invita distribuidores</p>
            <p className="text-[13px] text-[var(--ink-muted)] mt-0.5">Comparte tu código. Se registran con él y aparecen aquí para que los actives.</p>
          </div>
          <CopyField value={provider.slug} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none" />
          <input className="input input-icon" placeholder="Buscar por nombre, correo o teléfono" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar distribuidor" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1.5" aria-label="Limpiar"><IconX size={14} /></button>}
        </label>
        <Tabs tabs={[
          { label: 'Todos', value: 'all', count: distributors.length },
          { label: 'Activos', value: 'on' },
          { label: 'Por activar', value: 'off', count: pendingCount },
        ]} active={tab} onChange={setTab} />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconUsers} title={distributors.length ? 'Sin resultados' : 'Aún no tienes distribuidores'}
            description={distributors.length ? 'Prueba con otra búsqueda o filtro.' : 'Comparte tu código de invitación para que se registren.'} />
        </div>
      ) : (
        <div className="card divide-y divide-[var(--surface-border)] overflow-hidden">
          {filtered.map(d => {
            const bal = parseFloat(balances[d.id] || 0)
            const phone = (d.phone || '').replace(/\D/g, '')
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 sm:px-5 py-4 hover:bg-[var(--surface-side)] transition-colors">
                <span className="w-10 h-10 rounded-full inset grid place-items-center font-semibold text-sm text-[var(--ink-muted)] uppercase flex-shrink-0">
                  {(d.full_name || d.email)[0]}
                </span>
                <div className="flex-1 min-w-[160px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[14.5px] text-[var(--ink)] truncate">{d.full_name || 'Sin nombre'}</p>
                    {!d.is_active && <Badge color="yellow">Por activar</Badge>}
                  </div>
                  <p className="text-xs text-[var(--ink-faint)] truncate">{d.email}{d.phone ? ` · ${d.phone}` : ''} · desde {formatDate(d.created_at)}</p>
                </div>
                <div className="text-right min-w-[90px]">
                  <p className={`font-mono text-[15px] ${bal > 0 ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}>{formatUSD(bal)}</p>
                  <p className="text-[11px] text-[var(--ink-faint)]">saldo</p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => { setModal({ data: d }); setRechargeAmount(''); setError('') }} className="btn-accent btn-sm"><IconDollar size={14} />Recargar</button>
                  <button onClick={() => setHistFor(d)} className="btn-secondary btn-sm btn-icon" aria-label="Ver movimientos de saldo" title="Movimientos de saldo"><IconWallet size={14} /></button>
                  {phone && <a href={waLink(phone)} target="_blank" rel="noreferrer" className="btn-secondary btn-sm btn-icon" aria-label="Escribir por WhatsApp"><IconWhatsApp size={14} /></a>}
                  <Toggle checked={d.is_active} onChange={() => toggleDistributor(d)} />
                  <button onClick={() => deleteDistributor(d)} className="btn-ghost p-2 hover:!text-[var(--status-red)]" aria-label="Eliminar distribuidor"><IconTrash size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>}

      <Modal open={!!histFor} onClose={() => setHistFor(null)} title="Movimientos de saldo" subtitle={histFor ? `${histFor.full_name || histFor.email} · saldo actual ${formatUSD(balances[histFor.id] || 0)}` : ''} maxWidth="max-w-2xl">
        {histFor && <BalanceHistory mode="provider" userId={histFor.id} />}
      </Modal>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title="Recargar saldo"
        subtitle={modal ? `${modal.data.full_name || modal.data.email} · saldo actual ${formatUSD(balances[modal.data.id] || 0)}` : ''}
        maxWidth="max-w-sm"
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={recharge} disabled={saving || amount <= 0} className="btn-primary min-w-[150px]">{saving ? <Spinner size={15} /> : `Recargar ${amount > 0 ? formatUSD(amount) : ''}`}</button>
        </>}
      >
        <div className="space-y-4">
          <label className="inset flex items-center gap-2 px-4 py-3 focus-within:border-[var(--a)]">
            <span className="font-mono text-xl text-[var(--ink-faint)]">$</span>
            <input type="number" inputMode="decimal" step="0.01" min="0.01" autoFocus placeholder="0.00" className="flex-1 min-w-0 bg-transparent outline-none font-mono text-2xl text-[var(--ink)]" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} aria-label="Monto en dólares" />
            <span className="text-xs font-semibold text-[var(--ink-faint)]">USD</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 50, 100].map(v => <button key={v} className={`btn-secondary btn-sm ${amount === v ? 'is-down' : ''}`} onClick={() => setRechargeAmount(String(v))}>${v}</button>)}
          </div>
          {amount > 0 && (
            <div className="flex justify-between text-[13px] rounded-xl px-3.5 py-2.5 bg-[var(--a-soft)] border border-[var(--a-line)] animate-fade-in">
              <span className="text-[var(--ink-muted)]">Equivale a</span>
              <span className="font-mono text-[var(--a)]">S/ {(amount * rate).toFixed(2)}</span>
            </div>
          )}
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
