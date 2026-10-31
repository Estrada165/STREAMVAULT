import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { answer, buildIndex, welcomeText, SUGGESTIONS, fmtPEN, fmtUSD, durationLabel } from '@/lib/assistant'
import { waLink } from '@/lib/whatsapp'
import { MethodLogo } from '@/lib/paymentMethods'
import { PlatformLogo } from '@/utils/platform'
import { getDeliveryTypeLabel, copyToClipboard } from '@/utils'
import { useToast } from '@/components/ui'
import AssistantIcon from './AssistantIcon'
import { saveImage } from '@/lib/download'
import { IconDownload, IconSend, IconShoppingCart, IconCheck, IconCopy, IconShield, IconInfo, IconX, IconRefreshCw } from '@/assets/icons'

/** **negrita** → <b> */
function Rich({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <b key={i} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>)
}

function typeLabel(p) { return p.delivery_type === 'otro' && p.custom_delivery_type ? p.custom_delivery_type : getDeliveryTypeLabel(p.delivery_type) }
function stockBadge(p) {
  if (p.delivery_mode === 'pedido') return p.stock_qty === 0 ? ['Agotado', 'neutral'] : ['A pedido', 'violet']
  return p.stock > 0 ? [`${p.stock} disp.`, 'green'] : ['Agotado', 'neutral']
}

function ProductRow({ p, rate, onAdd }) {
  const [added, setAdded] = useState(false)
  const [label, color] = stockBadge(p)
  const can = label !== 'Agotado'
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-[var(--surface-raised)] border border-[var(--surface-border)]">
      <PlatformLogo name={p.platformName} filename={p.logo_filename} size={34} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--ink)] leading-snug line-clamp-2">{p.name}</p>
        <p className="text-[11.5px] text-[var(--ink-faint)] leading-relaxed">{typeLabel(p)} · {durationLabel(p.duration_days)} · <span className={`badge badge-${color} !h-[18px] !px-1.5 !text-[10px]`}>{label}</span></p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-mono text-[13.5px] text-[var(--ink)] leading-tight">{fmtPEN(p.price_usd, rate)}</p>
        <p className="font-mono text-[10.5px] text-[var(--ink-faint)]">{fmtUSD(p.price_usd)}</p>
      </div>
      {onAdd && (
        <button disabled={!can} onClick={() => { onAdd([p]); setAdded(true); setTimeout(() => setAdded(false), 1400) }}
          className={`btn-sm btn-icon flex-shrink-0 ${added ? 'btn-primary' : 'btn-accent'}`} aria-label={`Agregar ${p.name} al carrito`} title="Agregar al carrito">
          {added ? <IconCheck size={14} className="animate-pop" /> : <IconShoppingCart size={14} />}
        </button>
      )}
    </li>
  )
}

function QrLightbox({ src, label, onClose }) {
  const toast = useToast()
  async function save() {
    const r = await saveImage(src, `QR-${label || 'pago'}`)
    if (r === 'downloaded') toast.success('QR descargado')
    if (r === 'opened') toast('Mantén presionada la imagen para guardarla')
  }
  return createPortal(
    <div className="modal-overlay !z-[120]" onMouseDown={onClose}>
      <div className="card p-3 animate-pop max-w-xs w-full" onMouseDown={e => e.stopPropagation()}>
        <img src={src} alt={`Código QR de ${label || 'pago'}`} className="w-full rounded-xl bg-white" />
        <p className="text-[11px] text-[var(--ink-faint)] text-center mt-2.5">Guárdalo y ábrelo desde tu app de pagos para escanearlo.</p>
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cerrar</button>
          <button onClick={save} className="btn-primary flex-1"><IconDownload size={15} />Guardar QR</button>
        </div>
      </div>
    </div>, document.body)
}

function MethodRow({ m }) {
  const toast = useToast()
  const [qr, setQr] = useState(false)
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-[var(--surface-raised)] border border-[var(--surface-border)]">
      <MethodLogo logo={m.logo} label={m.label} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--ink)]">{m.label} <span className="font-normal text-[var(--ink-faint)]">· {m.holder_name}</span></p>
        <p className="font-mono text-[12.5px] text-[var(--ink-muted)] truncate">{m.account_number}</p>
      </div>
      <button onClick={async () => { await copyToClipboard(m.account_number); toast.success('Número copiado') }} className="btn-secondary btn-sm btn-icon" aria-label={`Copiar número de ${m.label}`}><IconCopy size={13} /></button>
      {m.qr_url && <button onClick={() => setQr(true)} className="w-9 h-9 rounded-lg overflow-hidden border border-[var(--surface-border)] bg-white flex-shrink-0" aria-label={`Ver QR de ${m.label}`}><img src={m.qr_url} alt="" className="w-full h-full object-cover" /></button>}
      {qr && <QrLightbox src={m.qr_url} label={m.label} onClose={() => setQr(false)} />}
    </li>
  )
}

function Block({ b, ctx, onAdd, onAsk, navigate }) {
  switch (b.type) {
    case 'text': return <p className="text-[13.5px] leading-relaxed text-[var(--ink-muted)]"><Rich text={b.text} /></p>
    case 'products': return <ul className="space-y-1.5">{b.products.map(p => <ProductRow key={p.id} p={p} rate={ctx.rate} onAdd={onAdd} />)}</ul>
    case 'compare': return (
      <div className="rounded-xl border border-[var(--surface-border)] overflow-hidden bg-[var(--surface-raised)]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-[var(--ink-faint)] bg-[var(--surface-side)]">
          <span>Plan</span><span className="text-right">Precio</span><span className="text-right">Por mes</span>
        </div>
        {b.rows.map((r, i) => (
          <div key={i} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 text-[13px] border-t border-[var(--surface-border)] ${r.available ? '' : 'opacity-50'}`}>
            <span className="text-[var(--ink)] truncate">{r.duration}{r.saving > 0 && <span className="badge badge-green !h-[18px] !px-1.5 !text-[10px] ml-1.5">ahorras {r.saving}%</span>}</span>
            <span className="font-mono text-right text-[var(--ink)]">{r.price}</span>
            <span className="font-mono text-right text-[var(--ink-muted)]">{r.perMonth}</span>
          </div>
        ))}
      </div>
    )
    case 'combos': return (
      <div className="grid gap-2">
        {b.combos.map((c, i) => (
          <div key={i} className="rounded-xl border border-[var(--a-line)] bg-[var(--a-soft)] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              {c.items.map(p => <PlatformLogo key={p.id} name={p.platformName} filename={p.logo_filename} size={26} />)}
              <span className="ml-auto font-mono text-[14px] text-[var(--ink)]">{fmtPEN(c.total, ctx.rate)}</span>
            </div>
            <p className="text-[12px] text-[var(--ink-muted)] leading-snug">{c.items.map(p => p.name).join(' + ')}</p>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[11px] text-[var(--ink-faint)]">{c.left > 0.004 ? `Te sobran ${fmtPEN(c.left, ctx.rate)}` : 'Usa todo tu presupuesto'}</span>
              {onAdd && <button onClick={() => onAdd(c.items)} className="btn-accent btn-sm"><IconShoppingCart size={13} />Agregar combo</button>}
            </div>
          </div>
        ))}
      </div>
    )
    case 'steps': return (
      <ol className="space-y-2">
        {b.steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            <span className="w-6 h-6 rounded-full grid place-items-center flex-shrink-0 text-[11px] font-mono font-semibold bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)]">{i + 1}</span>
            <span className="pt-0.5"><Rich text={s} /></span>
          </li>
        ))}
      </ol>
    )
    case 'methods': return <ul className="space-y-1.5">{b.methods.map(m => <MethodRow key={m.id || m.label} m={m} />)}</ul>
    case 'detail': return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
        <p className="text-[12.5px] font-semibold text-[var(--ink)] flex items-center gap-1.5"><IconShield size={13} className="text-[var(--a)]" />{b.title}</p>
        <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">{b.products.join(' · ')}</p>
        <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed mt-1.5 whitespace-pre-wrap">{b.text}</p>
      </div>
    )
    case 'platforms': return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {b.rows.map(r => (
          <button key={r.name} onClick={() => onAsk(`Precios de ${r.name}`)} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left border border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--a-line)] transition-colors ${r.available ? '' : 'opacity-55'}`}>
            <PlatformLogo name={r.name} filename={r.logo} size={26} />
            <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-[var(--ink)] truncate">{r.name}</span>
              <span className="block text-[10.5px] text-[var(--ink-faint)]">{r.available ? r.sub : 'agotado'}</span></span>
          </button>
        ))}
      </div>
    )
    case 'actions': return (
      <div className="flex flex-wrap gap-2">
        {b.actions.map(a => (
          <button key={a.label} onClick={() => (a.wa ? window.open(waLink(a.wa), '_blank') : navigate(a.to))} className={`btn-sm ${a.primary ? 'btn-primary' : 'btn-secondary'}`}>{a.label}</button>
        ))}
      </div>
    )
    case 'chips': return (
      <div className="flex flex-wrap gap-1.5">
        {b.chips.map(c => <button key={c} onClick={() => onAsk(c)} className="chip-ask">{c}</button>)}
      </div>
    )
    default: return null
  }
}

/**
 * Chat del asistente. Sin IA: responde con reglas usando solo los datos de la tienda.
 * ctx = { products, methods, rate, provider, balance, config }
 */
export default function AssistantChat({ ctx, storageKey = null, onAdd = null, preview = false }) {
  const navigate = useNavigate()
  const index = useMemo(() => buildIndex(ctx.products), [ctx.products])
  const name = ctx.config?.name || 'Asistente'
  const initial = () => [{ from: 'bot', blocks: [{ type: 'text', text: ctx.config?.welcome || welcomeText(ctx) }, { type: 'chips', chips: SUGGESTIONS(ctx) }] }]
  const [msgs, setMsgs] = useState(() => {
    if (storageKey) { try { const s = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); if (Array.isArray(s) && s.length) return s } catch {} }
    return initial()
  })
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, typing])
  useEffect(() => { if (storageKey) { try { sessionStorage.setItem(storageKey, JSON.stringify(msgs.slice(-40))) } catch {} } }, [msgs, storageKey])

  function ask(q) {
    const question = String(q || '').trim()
    if (!question || typing) return
    setText('')
    setMsgs(m => [...m, { from: 'me', text: question }])
    setTyping(true)
    setTimeout(() => {
      let blocks
      try { blocks = answer(question, ctx, index) } catch { blocks = [{ type: 'text', text: 'Algo salió mal al buscar eso. Intenta con otras palabras.' }] }
      setMsgs(m => [...m, { from: 'bot', blocks }])
      setTyping(false)
    }, 380 + Math.random() * 260)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-3 text-[11.5px] leading-snug text-[var(--ink-muted)] bg-[var(--surface-overlay)] border border-[var(--surface-border)]">
        <IconInfo size={13} className="flex-shrink-0 mt-[1px]" />
        <span className="sm:hidden">Asistente automático · <b className="font-semibold">sin IA</b> · responde solo con datos de esta tienda.</span>
        <span className="hidden sm:inline">Asistente automático: <b className="font-semibold">no usa inteligencia artificial</b>. Responde solo con la información de esta tienda (productos, precios, stock y guías). Si algo no está aquí, te lo dice.</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-4" aria-live="polite">
        {msgs.map((m, i) => m.from === 'me' ? (
          <div key={i} className="flex justify-end animate-fade-in">
            <p className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] bg-[var(--accent)] text-[var(--accent-ink)] whitespace-pre-wrap break-words">{m.text}</p>
          </div>
        ) : (
          <div key={i} className="flex gap-2.5 animate-slide-up">
            <span className="w-8 h-8 rounded-xl grid place-items-center flex-shrink-0 bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)]"><AssistantIcon size={16} /></span>
            <div className="min-w-0 flex-1 space-y-2.5 max-w-[640px]">
              {m.blocks.map((b, k) => <Block key={k} b={b} ctx={ctx} onAdd={onAdd} onAsk={ask} navigate={preview ? () => {} : navigate} />)}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2.5 items-center">
            <span className="w-8 h-8 rounded-xl grid place-items-center bg-[var(--a-soft)] border border-[var(--a-line)] text-[var(--a)]"><AssistantIcon size={16} /></span>
            <span className="typing-dots"><i /><i /><i /></span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); ask(text) }} className="mt-3 flex items-end gap-2">
        <button type="button" onClick={() => { setMsgs(initial()) }} className="btn-ghost p-2.5" title="Nueva conversación" aria-label="Nueva conversación"><IconRefreshCw size={16} /></button>
        <input className="input flex-1" placeholder={`Pregúntale a ${name}: "precio de Netflix", "tengo 20 soles"…`} value={text} onChange={e => setText(e.target.value)} maxLength={200} aria-label="Escribe tu pregunta" />
        <button type="submit" disabled={!text.trim() || typing} className="btn-primary btn-icon" aria-label="Enviar"><IconSend size={16} /></button>
      </form>
    </div>
  )
}
