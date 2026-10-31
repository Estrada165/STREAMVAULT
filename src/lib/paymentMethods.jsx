import { useState } from 'react'

// Lista única de métodos de pago (antes estaba repetida en Tienda y Configuración).
// Ojo: la clave 'Prexpe' va con mayúscula porque así quedó guardada en la base.
export const PAYMENT_METHODS = [
  { key: 'yape',    label: 'Yape',    logo: '/logos/logoYAPE.png',     placeholder: 'Número de teléfono' },
  { key: 'plin',    label: 'Plin',    logo: '/logos/logoPLIN.png',     placeholder: 'Número de teléfono' },
  { key: 'bim',     label: 'Bim',     logo: '/logos/LOGOBIM.webp',     placeholder: 'Número de teléfono' },
  { key: 'binance', label: 'Binance', logo: '/logos/logoBINANCE.webp', placeholder: 'ID de Binance Pay' },
  { key: 'lemon',   label: 'Lemon',   logo: '/logos/logoLEMON.webp',   placeholder: 'Número de teléfono' },
  { key: 'agora',   label: 'Agora',   logo: '/logos/LOGOAGORA.webp',   placeholder: 'Número de teléfono' },
  { key: 'Prexpe',  label: 'Prexpe',  logo: '/logos/logoPREXPE.png',   placeholder: 'Número de teléfono' },
]

export function getMethodMeta(key) {
  return PAYMENT_METHODS.find(m => m.key === key || m.key.toLowerCase() === String(key).toLowerCase())
    || { key, label: key, logo: '', placeholder: 'Número o cuenta' }
}

export function MethodLogo({ logo, label = '?', size = 32 }) {
  const [err, setErr] = useState(false)
  if (!logo || err) {
    return (
      <span className="grid place-items-center font-bold text-[var(--ink-muted)] bg-[var(--surface-overlay)] border border-[var(--surface-border)] flex-shrink-0"
        style={{ width: size, height: size, borderRadius: size / 4, fontSize: size * 0.42 }}>
        {label[0]}
      </span>
    )
  }
  return <img src={logo} alt={label} width={size} height={size} className="flex-shrink-0 object-contain" style={{ borderRadius: size / 4 }} onError={() => setErr(true)} />
}
