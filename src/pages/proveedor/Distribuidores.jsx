import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Badge, Toggle } from '@/components/ui'
import { IconUsers, IconDollar, IconSearch, IconTrash } from '@/assets/icons'
import { formatUSD, formatDate } from '@/utils'

export default function ProveedorDistribuidores() {
  const { provider } = useAuth()
  const [distributors, setDistributors] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      const { data: bals } = await supabase
        .from('balances').select('user_id, amount_usd').in('user_id', data.map(d => d.id))
      const map = {}
      bals?.forEach(b => { map[b.user_id] = b.amount_usd })
      setBalances(map)
    }
    setLoading(false)
  }

  async function toggleDistributor(d) {
    await supabase.from('users').update({ is_active: !d.is_active }).eq('id', d.id)
    fetchDistributors()
  }

  async function deleteDistributor(d) {
    if (!confirm(`¿Eliminar a "${d.full_name || d.email}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('users').delete().eq('id', d.id)
    fetchDistributors()
  }

  async function recharge() {
    const amount = parseFloat(rechargeAmount)
    if (!amount || amount <= 0) return setError('Monto inválido')
    setSaving(true); setError(''); setSuccess('')
    try {
      const { data: bal } = await supabase.from('balances').select('amount_usd').eq('user_id', modal.data.id).single()
      const newAmount = parseFloat(bal?.amount_usd || 0) + amount
      await supabase.from('balances').update({ amount_usd: newAmount }).eq('user_id', modal.data.id)
      await supabase.from('transactions').insert({
        user_id: modal.data.id, type: 'recarga', amount_usd: amount,
        description: 'Recarga manual por proveedor',
      })
      await supabase.from('notifications').insert({
        user_id: modal.data.id, title: 'Saldo recargado',
        message: `Se recargaron ${formatUSD(amount)} a tu cuenta.`, type: 'success',
      })
      setSuccess(`${formatUSD(amount)} recargados correctamente`)
      setRechargeAmount('')
      fetchDistributors()
      setTimeout(() => { setModal(null); setSuccess('') }, 1500)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const filtered = distributors.filter(d =>
    (d.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader title="Distribuidores" subtitle="Gestiona tus distribuidores y sus saldos" />

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar distribuidor..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconUsers} title="Sin distribuidores"
            description="Tus distribuidores aparecerán aquí cuando se registren con tu código." />
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Distribuidor</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Registrado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td>
                    <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{d.full_name || '—'}</p>
                    <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{d.email}</p>
                    {d.phone && <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{d.phone}</p>}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--ink)' }}>
                      {formatUSD(balances[d.id] || 0)}
                    </span>
                  </td>
                  <td>
                    <Badge color={d.is_active ? 'green' : 'red'} dot>
                      {d.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{formatDate(d.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => { setModal({ data: d }); setRechargeAmount(''); setError(''); setSuccess('') }}
                        className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                        <IconDollar size={13} />Recargar
                      </button>
                      <Toggle checked={d.is_active} onChange={() => toggleDistributor(d)} />
                      <button onClick={() => deleteDistributor(d)} className="btn-ghost"
                        style={{ padding: '6px 8px', color: 'var(--status-red)' }} title="Eliminar">
                        <IconTrash size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recharge modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title="Recargar saldo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface-overlay)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>
              {modal?.data?.full_name || modal?.data?.email}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              Saldo actual: <strong>{formatUSD(balances[modal?.data?.id] || 0)}</strong>
            </p>
          </div>
          <div>
            <label className="label">Monto a recargar (USD)</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="0.00"
              value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} />
          </div>
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={recharge} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <Spinner size={15} /> : 'Recargar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}