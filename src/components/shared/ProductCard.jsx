import { useState } from 'react'
import { formatUSD, getDeliveryTypeLabel } from '@/utils'
import { getPlatformColor, PlatformLogo } from '@/utils/platform'
import { Modal, Tabs } from '@/components/ui'
import { IconFileText, IconShield, IconPackage, IconShoppingCart, IconRefreshCw, IconCheck, IconClock } from '@/assets/icons'

// ---------- Estilo de la tarjeta (lo elige el proveedor en Productos) ----------
export const CARD_FIT = {
  cover: { label: 'Llenar el marco', hint: 'Ocupa toda la portada' },
  contain: { label: 'Imagen completa', hint: 'Se ve entera, sin recortes' },
}
export const CARD_POS = { top: 'Arriba', center: 'Centro', bottom: 'Abajo' }
export const CARD_COLOR_USES = ['Borde y brillo de la tarjeta', 'Fondo de la portada (imagen completa o sin imagen)', 'Punto de la etiqueta de plataforma']

export function normalizeCardStyle(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  return {
    fit: s.fit === 'contain' ? 'contain' : 'cover',
    pos: ['top', 'bottom'].includes(s.pos) ? s.pos : 'center',
    color: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : null,
  }
}

/**
 * Portada del producto.
 * - "Llenar el marco": la imagen cubre toda la portada; "pos" decide qué parte se conserva.
 * - "Imagen completa": la imagen se ve entera, con esquinas redondeadas, sobre el color
 *   de la tarjeta o (sin color) sobre un difuminado de la misma imagen.
 */
export function ProductCover({ imageUrl, platformName, logoFilename, tint, style: rawStyle, className = '' }) {
  const [err, setErr] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const st = normalizeCardStyle(rawStyle)
  const show = imageUrl && !err
  const base = st.color || tint
  const contain = st.fit === 'contain'

  let background
  if (!show) background = `radial-gradient(120% 90% at 50% 0%, ${base}38 0%, ${base}12 45%, transparent 75%), var(--surface-overlay)`
  else if (contain && st.color) background = `radial-gradient(120% 120% at 50% 0%, ${st.color}55, ${st.color}1f 60%), var(--surface-overlay)`

  return (
    <div className={`cover ${show ? (contain ? 'is-contain' : 'is-fill') : ''} ${className}`} style={background ? { background } : undefined}>
      {show ? (
        <>
          {contain && !st.color && <img src={imageUrl} alt="" aria-hidden="true" className="cover-bg" />}
          {!loaded && <div className="absolute inset-0 sk !rounded-none" />}
          {contain ? (
            <div className="cover-frame">
              <img src={imageUrl} alt={platformName} loading="lazy" className="cover-img" onLoad={() => setLoaded(true)} onError={() => setErr(true)} />
            </div>
          ) : (
            <img src={imageUrl} alt={platformName} loading="lazy" className="cover-img" style={{ objectPosition: `center ${st.pos}` }} onLoad={() => setLoaded(true)} onError={() => setErr(true)} />
          )}
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-0.5">
            <PlatformLogo name={platformName} filename={logoFilename} size={68} />
          </div>
        </div>
      )}
    </div>
  )
}

const DETAIL_TABS = [
  { key: 'includes', field: 'what_includes', label: '¿Qué incluye?', short: 'Incluye', icon: IconPackage },
  { key: 'terms', field: 'terms', label: 'Términos y condiciones', short: 'Términos', icon: IconFileText },
  { key: 'warranty', field: 'warranty', label: 'Garantía', short: 'Garantía', icon: IconShield },
]

export default function ProductCard({ product, exchangeRate = 3.5, onBuy, stockCount = 0 }) {
  const [detail, setDetail] = useState(null) // pestaña abierta en el detalle
  const [added, setAdded] = useState(false)

  const platformName = product.custom_platform_name || product.platforms?.name || ''
  const tint = getPlatformColor(platformName)
  const cardStyle = normalizeCardStyle(product.card_style)

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
  const tabs = DETAIL_TABS.filter(t => product[t.field])

  function handleBuy() {
    if (!canBuy || !onBuy) return
    onBuy(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1300)
  }

  const durationLabel = product.duration_days >= 360 ? `${Math.round(product.duration_days / 365)} año` : product.duration_days % 30 === 0 && product.duration_days > 30 ? `${product.duration_days / 30} meses` : `${product.duration_days} días`

  return (
    <>
      <article
        className={`product-card group h-full flex flex-col ${cardStyle.color ? 'has-color' : ''} ${isDisabled ? 'opacity-70' : ''}`}
        style={cardStyle.color ? { '--card-c': cardStyle.color } : undefined}
      >
        <div className="relative">
          <ProductCover imageUrl={product.image_url} platformName={platformName} logoFilename={product.custom_platform_name ? null : product.platforms?.logo_filename} tint={tint} style={cardStyle} />
          <span className="absolute top-3 left-3 badge !bg-[var(--surface-raised)] !text-[var(--ink)] !border-[var(--surface-border)] shadow-[0_2px_8px_var(--shadow-soft)] max-w-[60%]">
            <span className="dot flex-shrink-0" style={{ color: cardStyle.color || tint }} />
            <span className="truncate">{platformName}</span>
          </span>
          <span className="absolute top-3 right-3 shadow-[0_2px_8px_var(--shadow-soft)] rounded-full">
            {inStock && <span className="badge badge-green !bg-[var(--surface-raised)]"><span className="dot dot-glow" />{stockCount} disp.</span>}
            {isPedido && pedidoAvailable && <span className="badge badge-violet !bg-[var(--surface-raised)]"><IconClock size={11} />{product.stock_qty > 0 ? `${product.stock_qty} cupos` : 'A pedido'}</span>}
            {isDisabled && <span className="badge !bg-[var(--surface-raised)]">Agotado</span>}
          </span>
        </div>

        <div className="p-4 flex flex-col flex-1 gap-3">
          <div>
            <h3 className="font-display font-semibold text-[15px] leading-snug text-[var(--ink)] line-clamp-2">{product.name}</h3>
            <p className="text-xs text-[var(--ink-muted)] mt-1">{deliveryTypeLabel} · {durationLabel}</p>
          </div>

          {isRenewable && (
            <p className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--b)]">
              <IconRefreshCw size={12} />
              {showRenewalDiff ? <>Renueva a {formatUSD(renewalPrice)}</> : 'Renovable al mismo precio'}
            </p>
          )}

          <div className="flex-1" />

          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[1.4rem] font-medium leading-none text-[var(--ink)] tracking-tight">{formatUSD(product.price_usd)}</p>
              <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">≈ S/ {(product.price_usd * exchangeRate).toFixed(2)}</p>
            </div>
            {/* Detalles discretos: un icono por cada sección que el proveedor completó */}
            {tabs.length > 0 && (
              <div className="flex items-center gap-1.5" role="group" aria-label="Detalles del producto">
                {tabs.map(t => (
                  <button key={t.key} type="button" onClick={() => setDetail(t.key)} className="chip-icon" title={t.label} aria-label={t.label}>
                    <t.icon size={15} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleBuy} disabled={isDisabled} className={`w-full ${added ? 'btn-primary' : 'btn-accent'}`}>
            {added
              ? <><IconCheck size={15} className="animate-pop" />Agregado</>
              : <><IconShoppingCart size={15} />{isDisabled ? 'Sin stock' : isPedido ? 'Pedir' : 'Agregar'}</>}
          </button>
        </div>
      </article>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={product.name} subtitle={`${platformName} · ${deliveryTypeLabel} · ${durationLabel}`}>
        {isPedido && (
          <div className="rounded-xl p-3 mb-4 bg-[var(--b-soft)] border border-[var(--b-line)] text-[12.5px] leading-relaxed text-[var(--ink-muted)] flex gap-2.5">
            <IconClock size={15} className="text-[var(--b)] flex-shrink-0 mt-0.5" />
            <span><b className="text-[var(--ink)] font-semibold">A pedido:</b> tu proveedor carga las credenciales después de la compra y te llegan a "Mis pedidos".</span>
          </div>
        )}
        {tabs.length > 1 && (
          <Tabs className="mb-4 !w-full" tabs={tabs.map(t => ({ value: t.key, label: <><t.icon size={13} />{t.short}</> }))} active={detail} onChange={setDetail} />
        )}
        {tabs.filter(t => t.key === detail).map(t => (
          <div key={t.key} className="animate-fade-in">
            {tabs.length === 1 && <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)] mb-2"><t.icon size={14} className="text-[var(--a)]" />{t.label}</p>}
            <p className="text-[13.5px] text-[var(--ink-muted)] leading-relaxed whitespace-pre-wrap">{product[t.field]}</p>
          </div>
        ))}
        <div className="flex gap-2.5 mt-6">
          <button className="btn-secondary flex-1" onClick={() => setDetail(null)}>Cerrar</button>
          {canBuy && <button className="btn-primary flex-1" onClick={() => { handleBuy(); setDetail(null) }}><IconShoppingCart size={15} />{isPedido ? 'Pedir' : 'Agregar'}</button>}
        </div>
      </Modal>
    </>
  )
}
