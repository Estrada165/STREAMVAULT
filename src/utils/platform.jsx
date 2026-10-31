import { useState } from 'react'
import { getLogoPath } from '@/utils'

/** Color de marca de cada plataforma (se usa con poca opacidad, como tinte) */
export function getPlatformColor(name = '') {
  const n = name.toLowerCase()
  if (n.includes('netflix')) return '#e50914'
  if (n.includes('disney')) return '#006e99'
  if (n.includes('hbo') || n.includes('max')) return '#5822b4'
  if (n.includes('amazon') || n.includes('prime')) return '#00a8e1'
  if (n.includes('spotify')) return '#1db954'
  if (n.includes('youtube')) return '#ff0000'
  if (n.includes('crunchyroll')) return '#f47521'
  if (n.includes('apple')) return '#555555'
  if (n.includes('paramount')) return '#0064ff'
  if (n.includes('movistar')) return '#019df4'
  if (n.includes('claro')) return '#da291c'
  if (n.includes('directv')) return '#00a8e0'
  if (n.includes('deezer')) return '#a238ff'
  if (n.includes('vix')) return '#f5a623'
  if (n.includes('plex')) return '#e5a00d'
  if (n.includes('windows')) return '#0078d4'
  if (n.includes('autodesk')) return '#e84b35'
  if (n.includes('canva')) return '#00c4cc'
  if (n.includes('chatgpt')) return '#10a37f'
  if (n.includes('adobe')) return '#ff0000'
  if (n.includes('office') || n.includes('microsoft')) return '#d83b01'
  return '#6b7280'
}

/** Logo de la plataforma en una "tecla" con relieve; si no hay logo, la inicial */
export function PlatformLogo({ name = '', filename, size = 40, radius }) {
  const [err, setErr] = useState(false)
  const path = getLogoPath(filename)
  const r = radius ?? Math.round(size * 0.28)
  return (
    <span
      className="grid place-items-center flex-shrink-0 overflow-hidden bg-[var(--key)] border border-[var(--surface-border-strong)]"
      style={{ width: size, height: size, borderRadius: r, boxShadow: 'inset 0 1px 0 var(--hl), 0 2px 0 var(--key-edge), 0 4px 10px var(--shadow)' }}
    >
      {path && !err
        ? <img src={path} alt={name} loading="lazy" style={{ width: '72%', height: '72%', objectFit: 'contain' }} onError={() => setErr(true)} />
        : <span className="font-display font-bold text-[var(--ink-muted)]" style={{ fontSize: size * 0.42 }}>{(name || '?')[0].toUpperCase()}</span>}
    </span>
  )
}
