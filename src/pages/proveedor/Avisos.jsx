import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageHeader, Modal, Alert, Spinner, EmptyState, Toggle, Badge, PageLoader, useToast, useConfirm } from '@/components/ui'
import { AnnouncementCard, AnnImage } from '@/components/shared/Announcements'
import { IconPlus, IconEdit, IconTrash, IconBell, IconImage, IconLink, IconCalendar } from '@/assets/icons'
import { formatDate } from '@/utils'

const EMPTY = { title: '', message: '', image_url: '', link_url: '', link_label: '', tone: 'a', is_active: true, starts_at: '', ends_at: '' }
const DURATIONS = [[null, 'Sin fin'], [1, '1 día'], [3, '3 días'], [7, '7 días'], [15, '15 días']]

const toLocal = iso => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '')

function statusOf(a) {
  const now = new Date()
  if (!a.is_active) return ['Pausado', 'neutral']
  if (a.starts_at && new Date(a.starts_at) > now) return ['Programado', 'violet']
  if (a.ends_at && new Date(a.ends_at) <= now) return ['Terminado', 'neutral']
  return ['Visible', 'green']
}

export default function ProveedorAvisos() {
  const { provider } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (provider) fetchList() }, [provider])

  async function fetchList() {
    const { data, error: err } = await supabase.from('announcements').select('*').eq('provider_id', provider.id).order('created_at', { ascending: false })
    if (err) setError(err.message?.includes('announcements') ? 'Falta ejecutar el SQL 008 en Supabase.' : err.message)
    setList(data || []); setLoading(false)
  }

  function openNew() { setForm({ ...EMPTY, starts_at: toLocal(new Date().toISOString()) }); setError(''); setModal({}) }
  function openEdit(a) {
    setForm({ ...EMPTY, ...a, message: a.message || '', image_url: a.image_url || '', link_url: a.link_url || '', link_label: a.link_label || '', starts_at: toLocal(a.starts_at), ends_at: toLocal(a.ends_at) })
    setError(''); setModal({ data: a })
  }
  function setDuration(d) {
    if (d === null) return setForm(f => ({ ...f, ends_at: '' }))
    const start = form.starts_at ? new Date(form.starts_at) : new Date()
    setForm(f => ({ ...f, ends_at: toLocal(new Date(start.getTime() + d * 864e5).toISOString()) }))
  }

  async function save() {
    if (!form.title.trim()) return setError('Escribe un título')
    for (const k of ['image_url', 'link_url']) if (form[k] && !/^https?:\/\//i.test(form[k].trim())) return setError('Los enlaces deben empezar con https://')
    if (form.ends_at && form.starts_at && new Date(form.ends_at) <= new Date(form.starts_at)) return setError('La fecha de fin debe ser después del inicio')
    setSaving(true); setError('')
    const payload = {
      provider_id: provider.id,
      title: form.title.trim(), message: form.message.trim() || null,
      image_url: form.image_url.trim() || null, link_url: form.link_url.trim() || null, link_label: form.link_label.trim() || null,
      tone: form.tone, is_active: form.is_active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    }
    const { error: err } = modal?.data
      ? await supabase.from('announcements').update(payload).eq('id', modal.data.id)
      : await supabase.from('announcements').insert(payload)
    if (err) setError(err.message)
    else { setModal(null); fetchList(); toast.success(modal?.data ? 'Aviso actualizado' : 'Aviso publicado') }
    setSaving(false)
  }

  async function toggle(a) {
    setList(l => l.map(x => x.id === a.id ? { ...x, is_active: !a.is_active } : x))
    await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id)
  }
  async function remove(a) {
    if (!await confirm({ title: '¿Eliminar este aviso?', message: `"${a.title}" dejará de mostrarse.`, danger: true, confirmText: 'Eliminar' })) return
    await supabase.from('announcements').delete().eq('id', a.id); fetchList()
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Avisos a tu"
        accent="red"
        subtitle="Precios nuevos, promociones o recomendaciones. Tus distribuidores los ven al entrar y en el botón Avisos de la tienda."
        action={<button onClick={openNew} className="btn-primary"><IconPlus size={16} />Nuevo aviso</button>}
      />
      {error && !modal && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {list.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconBell} title="Aún no publicas avisos"
            description='Ejemplo: "Netflix sube a S/ 12 desde el lunes" o "Esta semana hay partido: recomienda Max".'
            action={<button onClick={openNew} className="btn-primary"><IconPlus size={16} />Crear el primero</button>} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 stagger">
          {list.map(a => {
            const [label, color] = statusOf(a)
            return (
              <article key={a.id} className={`card overflow-hidden flex flex-col ${label === 'Visible' ? '' : 'opacity-80'}`}>
                {a.image_url
                  ? <AnnImage src={a.image_url} className="aspect-[16/9]" />
                  : <div className="h-1.5" style={{ background: a.tone === 'b' ? 'var(--b)' : a.tone === 'neutral' ? 'var(--surface-border-strong)' : 'var(--a)' }} />}
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-[var(--ink)] leading-snug">{a.title}</h3>
                    <Badge color={color} dot>{label}</Badge>
                  </div>
                  {a.message && <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed line-clamp-3">{a.message}</p>}
                  <p className="text-[11.5px] text-[var(--ink-faint)] flex items-center gap-1.5 mt-auto pt-1"><IconCalendar size={12} />
                    {formatDate(a.starts_at)}{a.ends_at ? ` → ${formatDate(a.ends_at)}` : ' · sin fecha de fin'}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--surface-border)]">
                  <Toggle checked={a.is_active} onChange={() => toggle(a)} label={a.is_active ? 'Activo' : 'Pausado'} />
                  <button onClick={() => openEdit(a)} className="btn-secondary btn-sm ml-auto"><IconEdit size={13} />Editar</button>
                  <button onClick={() => remove(a)} className="btn-secondary btn-sm btn-icon hover:!text-[var(--status-red)]" aria-label="Eliminar aviso"><IconTrash size={14} /></button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.data ? 'Editar aviso' : 'Nuevo aviso'} maxWidth="max-w-3xl"
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary min-w-[130px]">{saving ? <Spinner size={15} /> : modal?.data ? 'Guardar' : 'Publicar'}</button>
        </>}>
        <div className="grid md:grid-cols-[1fr_300px] gap-5">
          <div className="space-y-4 min-w-0">
            <div>
              <label className="label !flex justify-between">Título <span className="font-mono font-normal text-[var(--ink-faint)]">{form.title.length}/80</span></label>
              <input className="input" maxLength={80} placeholder="Netflix sube de precio desde el lunes" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label !flex justify-between">Mensaje <span className="font-mono font-normal text-[var(--ink-faint)]">{form.message.length}/400</span></label>
              <textarea className="input" rows={3} maxLength={400} placeholder="Compra hoy al precio actual. Desde el lunes el perfil pasa a S/ 12." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
            </div>
            <div>
              <label className="label !flex items-center gap-1.5"><IconImage size={13} />Imagen (URL, opcional)</label>
              <input className="input" placeholder="https://i.postimg.cc/banner.png" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value.trim() }))} />
              <p className="text-[11px] text-[var(--ink-faint)] mt-1">Cualquier forma sirve: se muestra completa, sin recortes.</p>
            </div>
            <div className="grid grid-cols-[1fr_130px] gap-2.5">
              <div>
                <label className="label !flex items-center gap-1.5"><IconLink size={13} />Enlace (opcional)</label>
                <input className="input" placeholder="https://wa.me/..." value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value.trim() }))} />
              </div>
              <div>
                <label className="label">Texto del botón</label>
                <input className="input" maxLength={30} placeholder="Ver más" value={form.link_label} onChange={e => setForm(f => ({ ...f, link_label: e.target.value }))} />
              </div>
            </div>
            <div>
              <p className="label">Color del aviso</p>
              <div className="inset flex p-1 gap-1 w-fit">
                {[['a', 'Principal'], ['b', 'Secundario'], ['neutral', 'Neutro']].map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setForm(f => ({ ...f, tone: k }))} aria-pressed={form.tone === k}
                    className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-[.55rem] text-xs font-semibold border transition-all ${form.tone === k ? 'bg-[var(--key)] text-[var(--ink)] border-[var(--surface-border-strong)] shadow-[inset_0_1px_0_var(--hl),0_2px_0_var(--key-edge)]' : 'border-transparent text-[var(--ink-faint)]'}`}>
                    <span className="dot" style={{ color: k === 'a' ? 'var(--a)' : k === 'b' ? 'var(--b)' : 'var(--ink-faint)' }} />{v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div>
                <label className="label">Se muestra desde</label>
                <input type="datetime-local" className="input" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input type="datetime-local" className="input" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map(([d, l]) => (
                <button key={l} type="button" onClick={() => setDuration(d)} className="btn-secondary btn-sm">{l}</button>
              ))}
            </div>
            <div className="flex items-center justify-between inset px-3.5 py-2.5">
              <span className="text-sm text-[var(--ink-muted)]">Visible para tus distribuidores</span>
              <Toggle checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
            {error && <Alert type="error">{error}</Alert>}
          </div>
          <div className="md:sticky md:top-0 self-start">
            <p className="label">Así lo verán tus distribuidores</p>
            <AnnouncementCard ann={form} from={provider?.display_name} />
            <p className="text-[11px] text-[var(--ink-faint)] mt-2 leading-relaxed">Aparece al entrar (una vez) y siempre en el botón <b>Avisos</b> de la tienda. La imagen se muestra completa, tenga la forma que tenga.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
