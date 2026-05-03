import { useState } from 'react'
import { getLogoPath, formatUSD, getDeliveryTypeLabel } from '@/utils'
import { Modal } from '@/components/ui'
import { IconFileText, IconShield, IconPackage, IconShoppingCart, IconInfo, IconRefreshCw } from '@/assets/icons'

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
  if (n.includes('windows')) return '#0078d4'
  if (n.includes('autodesk')) return '#e84b35'
  if (n.includes('canva')) return '#00c4cc'
  if (n.includes('adobe')) return '#ff0000'
  if (n.includes('office') || n.includes('microsoft')) return '#d83b01'
  return '#6b7280'
}

function CardHeader({ imageUrl, logoFilename, platformName, accentColor, isCustomPlatform }) {
  const [imgErr, setImgErr] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const logoPath = isCustomPlatform ? null : getLogoPath(logoFilename)
  const showImage = imageUrl && !imgErr

  return (
    <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', flexShrink: 0, background: showImage ? `${accentColor}18` : `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}08 100%)` }}>
      {showImage ? (
        <>
          <img src={imageUrl} alt={platformName} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={() => setImgErr(true)} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '3px 8px 3px 4px' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accentColor}40`, flexShrink: 0 }}>
              {!isCustomPlatform && logoPath && !logoErr
                ? <img src={logoPath} alt={platformName} style={{ width: 14, height: 14, objectFit: 'contain' }} onError={() => setLogoErr(true)} />
                : <span style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{(platformName || '?')[0].toUpperCase()}</span>}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>{platformName}</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: '60%', height: '60%', borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)` }} />
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${accentColor}20`, border: `1.5px solid ${accentColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {!isCustomPlatform && logoPath && !logoErr
                ? <img src={logoPath} alt={platformName} style={{ width: 42, height: 42, objectFit: 'contain' }} onError={() => setLogoErr(true)} />
                : <span style={{ fontSize: 22, fontWeight: 800, color: accentColor }}>{(platformName || '?')[0].toUpperCase()}</span>}
            </div>
          </div>
          <p style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: `${accentColor}cc` }}>{platformName}</p>
        </>
      )}
    </div>
  )
}

export default function ProductCard({ product, exchangeRate = 3.5, onBuy, stockCount = 0 }) {
  const [modal, setModal] = useState(null)

  const isCustomPlatform = !!product.custom_platform_name
  const platformName = product.custom_platform_name || product.platforms?.name || ''
  const accentColor = getPlatformColor(platformName)
  const imageUrl = product.image_url || null

  const deliveryTypeLabel = (product.delivery_type === 'otro' && product.custom_delivery_type)
    ? product.custom_delivery_type
    : getDeliveryTypeLabel(product.delivery_type)

  const isStock = product.delivery_mode === 'stock'
  const isPedido = product.delivery_mode === 'pedido'
  const inStock = isStock && stockCount > 0
  const outOfStock = isStock && stockCount === 0
  const pedidoUnavailable = isPedido && product.stock_qty === 0
  const pedidoAvailable = isPedido && (product.stock_qty === null || product.stock_qty === undefined || product.stock_qty > 0)
  const canBuy = inStock || pedidoAvailable
  const isDisabled = outOfStock || pedidoUnavailable

  const isRenewable = product.is_renewable
  const renewalPrice = product.renewal_price_usd
  const showRenewalDiff = isRenewable && renewalPrice && parseFloat(renewalPrice) !== parseFloat(product.price_usd)

  return (
    <>
      <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 18, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', transition: 'box-shadow 0.25s, transform 0.2s', boxShadow: `inset 3px 0 0 ${accentColor}` }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentColor}, 0 8px 32px rgba(0,0,0,0.18)`; e.currentTarget.style.transform = 'translateY(-3px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentColor}`; e.currentTarget.style.transform = '' }}
      >
        <CardHeader imageUrl={imageUrl} logoFilename={product.platforms?.logo_filename} platformName={platformName} accentColor={accentColor} isCustomPlatform={isCustomPlatform} />

        <div style={{ padding: '10px 14px 0', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 8 }}>
            {product.name}
          </p>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="badge badge-neutral" style={{ fontSize: 10 }}>{deliveryTypeLabel}</span>
            <span className="badge badge-neutral" style={{ fontSize: 10 }}>{product.duration_days}d</span>
            {inStock && <span className="badge badge-green" style={{ fontSize: 10 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />{stockCount}</span>}
            {isPedido && pedidoAvailable && (
              <span className="badge badge-yellow" style={{ fontSize: 10 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                {product.stock_qty > 0 ? `Pedido: ${product.stock_qty}` : 'A pedido'}
              </span>
            )}
            {(outOfStock || pedidoUnavailable) && <span className="badge badge-neutral" style={{ fontSize: 10, opacity: 0.6 }}>Agotado</span>}
            {isRenewable && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'var(--status-green-bg)', color: 'var(--status-green)', border: '1px solid var(--status-green-border)' }}>
                <IconRefreshCw size={9} />Renovable
              </span>
            )}
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ height: 1, background: 'var(--surface-border)', margin: '0 -14px' }} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 0 4px' }}>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>{formatUSD(product.price_usd)}</p>
              <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>≈ S/ {(product.price_usd * exchangeRate).toFixed(2)}</p>
              {showRenewalDiff && (
                <p style={{ fontSize: 11, color: 'var(--status-green)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IconRefreshCw size={9} />Renov. {formatUSD(renewalPrice)} ≈ S/ {(renewalPrice * exchangeRate).toFixed(2)}
                </p>
              )}
              {isRenewable && !showRenewalDiff && (
                <p style={{ fontSize: 11, color: 'var(--status-green)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IconRefreshCw size={9} />Mismo precio al renovar
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
              {product.terms && <button onClick={e => { e.stopPropagation(); setModal('terms') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}><IconFileText size={13} /></button>}
              {product.warranty && <button onClick={e => { e.stopPropagation(); setModal('warranty') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}><IconShield size={13} /></button>}
              {product.what_includes && <button onClick={e => { e.stopPropagation(); setModal('includes') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--ink-faint)' }}><IconPackage size={13} /></button>}
              {isPedido && <button onClick={e => { e.stopPropagation(); setModal('pedido') }} className="btn-ghost" style={{ padding: '5px 6px', color: 'var(--status-yellow)' }}><IconInfo size={13} /></button>}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          <button onClick={() => canBuy && onBuy && onBuy(product)} disabled={isDisabled}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: isDisabled ? 'not-allowed' : 'pointer', border: 'none', background: isDisabled ? 'var(--surface-overlay)' : accentColor, color: isDisabled ? 'var(--ink-faint)' : '#fff', opacity: isDisabled ? 0.65 : 1, transition: 'opacity 0.15s', fontFamily: 'DM Sans, sans-serif' }}
            onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { if (!isDisabled) e.currentTarget.style.opacity = '1' }}
          >
            <IconShoppingCart size={14} />
            {isDisabled ? 'Sin stock' : isPedido ? 'Pedir' : 'Agregar'}
          </button>
        </div>
      </div>

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