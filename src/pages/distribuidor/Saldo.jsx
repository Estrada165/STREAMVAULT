import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useBalance } from '@/hooks/useBalance'
import { useSettings } from '@/hooks/useSettings'
import { PageHeader } from '@/components/ui'
import BalanceHistory from '@/components/shared/BalanceHistory'
import { formatUSD } from '@/utils'
import { IconWallet } from '@/assets/icons'

export default function DistSaldo() {
  const { provider } = useAuth()
  const { balance, loading } = useBalance()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const rate = parseFloat(settings?.exchange_rate) || 3.5

  return (
    <div>
      <PageHeader title="Mi" accent="saldo" subtitle="Cada recarga, compra y devolución, con el saldo que te quedó" />

      <section className="card p-5 sm:p-6 mb-6 flex flex-wrap items-center gap-5 animate-slide-up">
        <span className="w-14 h-14 rounded-2xl grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)]"><IconWallet size={24} /></span>
        <div className="flex-1 min-w-[180px]">
          <p className="eyebrow">Saldo disponible</p>
          <p className="font-mono text-[2rem] leading-tight text-[var(--ink)] mt-1">{loading ? '—' : formatUSD(balance)}</p>
          <p className="text-xs text-[var(--ink-faint)]">≈ S/ {((parseFloat(balance) || 0) * rate).toFixed(2)} · recargas con {provider?.display_name || 'tu proveedor'}</p>
        </div>
        <button onClick={() => navigate('/tienda?recargar=1')} className="btn-primary">Recargar saldo</button>
      </section>

      <BalanceHistory mode="self" currentBalance={loading ? null : balance} />
    </div>
  )
}
