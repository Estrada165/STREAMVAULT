// ============================================================
// PhoneInput — Selector de país + número con prefijo
// Uso: <PhoneInput value={phone} onChange={setPhone} />
// Devuelve el número completo con prefijo: "+51999999999"
// ============================================================

import { useState } from 'react'

const COUNTRIES = [
  // Latinoamérica
  { code: 'PE', flag: '🇵🇪', name: 'Perú', prefix: '+51' },
  { code: 'MX', flag: '🇲🇽', name: 'México', prefix: '+52' },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia', prefix: '+57' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina', prefix: '+54' },
  { code: 'CL', flag: '🇨🇱', name: 'Chile', prefix: '+56' },
  { code: 'VE', flag: '🇻🇪', name: 'Venezuela', prefix: '+58' },
  { code: 'EC', flag: '🇪🇨', name: 'Ecuador', prefix: '+593' },
  { code: 'BO', flag: '🇧🇴', name: 'Bolivia', prefix: '+591' },
  { code: 'PY', flag: '🇵🇾', name: 'Paraguay', prefix: '+595' },
  { code: 'UY', flag: '🇺🇾', name: 'Uruguay', prefix: '+598' },
  { code: 'GT', flag: '🇬🇹', name: 'Guatemala', prefix: '+502' },
  { code: 'HN', flag: '🇭🇳', name: 'Honduras', prefix: '+504' },
  { code: 'SV', flag: '🇸🇻', name: 'El Salvador', prefix: '+503' },
  { code: 'NI', flag: '🇳🇮', name: 'Nicaragua', prefix: '+505' },
  { code: 'CR', flag: '🇨🇷', name: 'Costa Rica', prefix: '+506' },
  { code: 'PA', flag: '🇵🇦', name: 'Panamá', prefix: '+507' },
  { code: 'DO', flag: '🇩🇴', name: 'Rep. Dominicana', prefix: '+1809' },
  { code: 'CU', flag: '🇨🇺', name: 'Cuba', prefix: '+53' },
  { code: 'PR', flag: '🇵🇷', name: 'Puerto Rico', prefix: '+1787' },
  // América del Norte
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos', prefix: '+1' },
  { code: 'CA', flag: '🇨🇦', name: 'Canadá', prefix: '+1' },
  // Europa / otros
  { code: 'ES', flag: '🇪🇸', name: 'España', prefix: '+34' },
  { code: 'BR', flag: '🇧🇷', name: 'Brasil', prefix: '+55' },
]

/**
 * Parsea un número completo ("+51999999999") y lo separte en país + número local.
 */
function parsePhone(fullPhone) {
  if (!fullPhone) return { country: COUNTRIES[0], local: '' }
  const match = COUNTRIES.sort((a, b) => b.prefix.length - a.prefix.length)
    .find(c => fullPhone.startsWith(c.prefix))
  if (match) return { country: match, local: fullPhone.slice(match.prefix.length) }
  return { country: COUNTRIES[0], local: fullPhone.replace(/^\+\d{1,4}/, '') }
}

export default function PhoneInput({ value, onChange, placeholder = '999 999 999', label = 'WhatsApp' }) {
  const parsed = parsePhone(value)
  const [selectedCountry, setSelectedCountry] = useState(parsed.country)
  const [localNumber, setLocalNumber] = useState(parsed.local)

  function handleCountryChange(e) {
    const country = COUNTRIES.find(c => c.code === e.target.value) || COUNTRIES[0]
    setSelectedCountry(country)
    const cleaned = localNumber.replace(/\D/g, '')
    onChange(country.prefix + cleaned)
  }

  function handleNumberChange(e) {
    const raw = e.target.value.replace(/[^\d\s-]/g, '') // solo dígitos, espacios y guiones
    setLocalNumber(raw)
    const cleaned = raw.replace(/\D/g, '')
    onChange(selectedCountry.prefix + cleaned)
  }

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex gap-2">
        {/* Selector de país */}
        <select
          value={selectedCountry.code}
          onChange={handleCountryChange}
          className="input !w-auto flex-shrink-0 !pr-8 !pl-3"
          style={{ minWidth: 104 }}
          aria-label="País"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.prefix}
            </option>
          ))}
        </select>

        {/* Input del número local */}
        <input
          className="input"
          placeholder={placeholder}
          value={localNumber}
          onChange={handleNumberChange}
          style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)' }}
          inputMode="tel"
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
        Número completo: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
          {selectedCountry.prefix}{localNumber.replace(/\D/g, '') || '···'}
        </span>
      </p>
    </div>
  )
}