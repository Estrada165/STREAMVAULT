import { useState } from 'react'
import { getLogoPath, formatUSD, getDeliveryTypeLabel } from '@/utils'
import { Modal } from '@/components/ui'
import { IconFileText, IconShield, IconPackage, IconShoppingCart, IconInfo } from '@/assets/icons'

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

// ─── CARD HEADER REDISEÑADO ───────────────────────────────────────────────────
// Con imagen URL → ratio 16:9 con imagen completa (objectFit: contain) + fondo de color
// Sin imagen URL → bloque de color con logo centrado, misma altura
function CardHeader({ imageUrl, logoFilename, platformName, accentColor }) {
  const [imgErr, setImgErr] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const logoPath = getLogoPath(logoFilename)
  const showImage = imageUrl && !imgErr

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16 / 9',   // altura proporcional y consistente en todas las cards
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      background: showImage
        ? `${accentColor}18`
        : `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}08 100%)`,
    }}>
      {showImage ? (
        <>
          {/* Imagen completa, sin recorte */}
          <img
            src={imageUrl}
            alt={platformName}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onError={() => setImgErr(true)}
          />
          {/* Gradiente sutil solo en la parte inferior */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          {/* Chip logo pequeño arriba izquierda */}
          <div style={{
            position: 'absolute', top: 8, left: 8,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)',
            borderRadius: 20, padding: '3px 8px 3px 4px',
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accentColor}40` }}>
              {logoPath && !logoErr
                ? <img src={logoPath} alt={platformName} style={{ width: 16, height: 16, objectFit: 'contain' }} onError={() => setLogoErr(true)} />
                : <span style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{(platformName || '?')[0]}</span>
              }
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
              {platformName}
            </span>
          </div>
        </>
      ) : (
        /* Sin imagen: logo centrado con halo de color */
        <>
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Halo decorativo */}
            <div style={{
              position: 'absolute',
              width: '60%', height: '60%',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
            }} />
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `${accentColor}20`,
              border: `1.5px solid ${accentColor}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
            }}>
              {logoPath && !logoErr
                ? <img src={logoPath} alt={platformName} style={{ width: 42, height: 42, objectFit: 'contain' }} onError={() => setLogoErr(true)} />
                : <span style={{ fontSize: 22, fontWeight: 800, color: accentColor }}>{(platformName || '?')[0]}</span>
              }
            </div>
          </div>
          {/* Nombre en la parte inferior */}
          <p style={{
            position: 'absolute', bottom: 8, left: 10,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: `${accentColor}cc`,
          }}>
            {platformName}
          </p>
        </>
      )}
    </div>
  )
}

// ─── PRODUCT CARD PRINCIPAL ───────────────────────────────────────────────────
export default function ProductCard({ product, exchangeRate = 3.5, onBuy, stockCount = 0 }) {
  const [modal, setModal] = useState(null)

  const logoFilename = product.platforms?.logo_filename
  const platformName = product.platforms?.name || ''
  const accentColor = getPlatformColor(platformName)
  const imageUrl = product.image_url || null

  const isStock = product.delivery_mode === 'stock'
  const isPedido = product.delivery_mode === 'pedido'
  const inStock = isStock && stockCount > 0
  const outOfStock = isStock && stockCount === 0
  const pedidoUnavailable = isPedido && product.stock_qty === 0
  const pedidoAvailable = isPedido && (product.stock_qty === null || product.stock_qty === undefined || product.stock_qty > 0)
  const canBuy = inStock || pedidoAvailable
  const isDisabled = outOfStock || pedidoUnavailable

  const btnColor = isDisabled ? 'var(--surface-overlay)' : isPedido ? '#f59e0b' : accentColor

  return (
    <>
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--surface-border)',
          borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          height: '100%', overflow: 'hidden',
          transition: 'box-shadow 0.2s, transform 0.18s',
          // Acento de color en borde izquierdo en lugar de top — más elegante
          boxShadow: `inset 3px 0 0 ${accentColor}`,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentColor}, var(--shadow-elevated)`
          e.currentTarget.style.transform = 'translateY(-3px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentColor}`
          e.currentTarget.style.transform = ''
        }}
      >
        {/* ── HEADER: imagen o logo ── */}
        <CardHeader
          imageUrl={imageUrl}
          logoFilename={logoFilename}
          platformName={platformName}
          accentColor={accentColor}
        />

        {/* ── BODY ── */}
        <div style={{ padding: '10px 14px 0', display: 'flex', flexDirection: 'column', flex: 1 }}>

          {/* Nombre del producto */}
          <p style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13.5,
            color: 'var(--ink)', lineHeight: 1.35,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            marginBottom: 8,
          }}>
            {product.name}
          </p>

          {/* Tags: tipo, duración, stock */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="badge badge-neutral" style={{ fontSize: 10 }}>{getDeliveryTypeLabel(product.delivery_type)}</span>
            <span className="badge badge-neutral" style={{ fontSize: 10 }}>{product.duration_days}d</span>
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

          {/* Spacer flexible */}
          <div style={{ flex: 1 }} />

          {/* Divisor */}
          <div style={{ height: 1, background: 'var(--surface-border)', margin: '0 -14px' }} />

          {/* Precio + íconos de info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 4px' }}>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>
                {formatUSD(product.price_usd)}
              </p>
              <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                ≈ S/ {(product.price_usd * exchangeRate).toFixed(2)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {product.terms && (
                <button onClick={e => { e.stopPropagation(); setModal('terms') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}><IconFileText size={13} /></button>
              )}
              {product.warranty && (
                <button onClick={e => { e.stopPropagation(); setModal('warranty') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}><IconShield size={13} /></button>
              )}
              {product.what_includes && (
                <button onClick={e => { e.stopPropagation(); setModal('includes') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}><IconPackage size={13} /></button>
              )}
              {isPedido && (
                <button onClick={e => { e.stopPropagation(); setModal('pedido') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--status-yellow)' }}><IconInfo size={13} /></button>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTÓN ── */}
        <div style={{ padding: '0 14px 14px' }}>
          <button
            onClick={() => canBuy && onBuy && onBuy(product)}
            disabled={isDisabled}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: isDisabled ? 'not-allowed' : 'pointer', border: 'none',
              background: btnColor, color: isDisabled ? 'var(--ink-faint)' : '#fff',
              opacity: isDisabled ? 0.65 : 1, transition: 'opacity 0.15s',
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

      {/* ── Modales de info ── */}
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