import { useState } from 'react'
import { getLogoPath, formatUSD, formatPEN, getDeliveryTypeLabel } from '@/utils'
import { Modal } from '@/components/ui'
import { IconFileText, IconShield, IconPackage, IconShoppingCart, IconInfo } from '@/assets/icons'

// Map platform name → accent color
function getPlatformColor(name = '') {
  const n = name.toLowerCase()
  if (n.includes('netflix')) return '#e50914'
  if (n.includes('disney')) return '#006e99'
  if (n.includes('hbo') || n.includes('max')) return '#5822b4'
  if (n.includes('amazon') || n.includes('prime')) return '#ff9900'
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
  if (n.includes('mubi')) return '#010101'
  return '#6b7280'
}

export default function ProductCard({ product, exchangeRate = 3.5, onBuy, stockCount = 0 }) {
  const [modal, setModal] = useState(null)

  const logoPath = getLogoPath(product.platforms?.logo_filename)
  const platformName = product.platforms?.name || ''
  const accentColor = getPlatformColor(platformName)

  const isStock = product.delivery_mode === 'stock'
  const isPedido = product.delivery_mode === 'pedido'

  // For stock mode: use real stock count
  // For pedido mode: use stock_qty field (null = unlimited, 0 = no disponible, N = hay N)
  const inStock = isStock && stockCount > 0
  const outOfStock = isStock && stockCount === 0
  const pedidoUnavailable = isPedido && product.stock_qty === 0
  const pedidoAvailable = isPedido && (product.stock_qty === null || product.stock_qty === undefined || product.stock_qty > 0)
  const canBuy = inStock || pedidoAvailable
  const isDisabled = outOfStock || pedidoUnavailable

  return (
    <>
      <div style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--surface-border)',
        borderRadius: 16,
        borderTop: `3px solid ${accentColor}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, transform 0.15s',
        cursor: 'default',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
      >
        {/* HEADER */}
        <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {logoPath
              ? <img src={logoPath} alt={platformName} style={{ width: 32, height: 32, objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none' }} />
              : <span style={{ fontSize: 15, fontWeight: 800, color: accentColor }}>{platformName[0]}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: accentColor, opacity: 0.85, marginBottom: 2 }}>
              {platformName}
            </p>
            <p style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13,
              color: 'var(--ink)', lineHeight: 1.3,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
            }}>
              {product.name}
            </p>
          </div>
        </div>

        {/* TAGS */}
        <div style={{ padding: '0 14px 10px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <span className="badge badge-neutral" style={{ fontSize: 10 }}>
            {getDeliveryTypeLabel(product.delivery_type)}
          </span>
          <span className="badge badge-neutral" style={{ fontSize: 10 }}>
            {product.duration_days}d
          </span>
          {inStock && (
            <span className="badge badge-green" style={{ fontSize: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {stockCount}
            </span>
          )}
          {isPedido && pedidoAvailable && (
            <span className="badge badge-yellow" style={{ fontSize: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {product.stock_qty > 0 ? `Pedido: ${product.stock_qty}` : 'A pedido'}
            </span>
          )}
          {(outOfStock || pedidoUnavailable) && (
            <span className="badge badge-neutral" style={{ fontSize: 10, opacity: 0.6 }}>Agotado</span>
          )}
        </div>

        {/* SPACER to push price to bottom */}
        <div style={{ flex: 1 }} />

        {/* DIVIDER */}
        <div style={{ height: 1, background: 'var(--surface-border)', margin: '0 14px' }} />

        {/* PRICE */}
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 19, color: 'var(--ink)', lineHeight: 1 }}>
              {formatUSD(product.price_usd)}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>
              ≈ S/ {(product.price_usd * exchangeRate).toFixed(2)}
            </p>
          </div>
          {/* Info icons */}
          <div style={{ display: 'flex', gap: 1 }}>
            {product.terms && (
              <button onClick={e => { e.stopPropagation(); setModal('terms') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}>
                <IconFileText size={13} />
              </button>
            )}
            {product.warranty && (
              <button onClick={e => { e.stopPropagation(); setModal('warranty') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}>
                <IconShield size={13} />
              </button>
            )}
            {product.what_includes && (
              <button onClick={e => { e.stopPropagation(); setModal('includes') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}>
                <IconPackage size={13} />
              </button>
            )}
            {isPedido && (
              <button onClick={e => { e.stopPropagation(); setModal('pedido') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--status-yellow)' }}>
                <IconInfo size={13} />
              </button>
            )}
          </div>
        </div>

        {/* BUY BUTTON */}
        <div style={{ padding: '0 14px 14px' }}>
          <button
            onClick={() => canBuy && onBuy && onBuy(product)}
            disabled={isDisabled}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
              cursor: isDisabled ? 'not-allowed' : 'pointer', border: 'none',
              background: isDisabled ? 'var(--surface-overlay)' : accentColor,
              color: isDisabled ? 'var(--ink-faint)' : '#fff',
              opacity: isDisabled ? 0.7 : 1,
              transition: 'opacity 0.15s, transform 0.12s',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { if (!isDisabled) e.currentTarget.style.opacity = '1' }}
          >
            <IconShoppingCart size={14} />
            {isDisabled ? 'Sin stock' : isPedido ? 'Pedir' : 'Agregar'}
          </button>
        </div>
      </div>

      {/* Modals */}
      <Modal open={modal === 'terms'} onClose={() => setModal(null)} title="Términos y condiciones">
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.terms}</p>
      </Modal>
      <Modal open={modal === 'warranty'} onClose={() => setModal(null)} title="Garantía">
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.warranty}</p>
      </Modal>
      <Modal open={modal === 'includes'} onClose={() => setModal(null)} title="¿Qué incluye?">
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.what_includes}</p>
      </Modal>
      <Modal open={modal === 'pedido'} onClose={() => setModal(null)} title="Producto a pedido">
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.7 }}>
          Al comprar, el sistema registra tu pedido sin credenciales. Luego debes notificar al proveedor para que las cargue manualmente.
          {product.terms && <><br /><br />{product.terms}</>}
        </p>
        <button onClick={() => setModal(null)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>Entendido</button>
      </Modal>
    </>
  )
}
