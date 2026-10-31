import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Alert, Spinner, Modal, Tabs, useToast, useConfirm } from '@/components/ui'
import { IconDollar, IconPlus, IconEdit, IconTrash } from '@/assets/icons'

// Extrae el ID de video de YouTube o devuelve null
function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?/\s]{11})/)
  return m ? m[1] : null
}

// Genera thumbnail de YouTube o usa Google Drive preview
function getThumbnail(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  // Google Drive: extraer file ID
  const driveMatch = url.match(/\/d\/([^/]+)/)
  if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w400`
  return null
}

function TutorialCard({ tutorial, onEdit, onDelete, onToggle }) {
  const thumb = getThumbnail(tutorial.drive_url)
  return (
    <article className={`product-card flex flex-col ${tutorial.is_active ? '' : 'opacity-55'}`}>
      <div className="relative w-full overflow-hidden bg-[var(--surface-overlay)]" style={{ aspectRatio: '16 / 9' }}>
        {thumb
          ? <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
          : <div className="w-full h-full" style={{ background: 'radial-gradient(120% 100% at 30% 0%, var(--a-soft), transparent 60%), radial-gradient(120% 100% at 100% 100%, var(--b-soft), transparent 60%)' }} />}
        <span className="absolute top-2.5 left-2.5 badge !bg-[var(--surface-raised)] font-mono">#{tutorial.sort_order}</span>
        {!tutorial.is_active && <span className="absolute top-2.5 right-2.5 badge !bg-[var(--surface-raised)]">Oculto</span>}
      </div>
      <div className="p-3.5 flex-1 flex flex-col gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[13.5px] text-[var(--ink)] truncate">{tutorial.title}</p>
          {tutorial.description && <p className="text-xs text-[var(--ink-faint)] line-clamp-2 mt-0.5">{tutorial.description}</p>}
        </div>
        <div className="flex gap-1.5 items-center mt-auto">
          <button onClick={() => onEdit(tutorial)} className="btn-secondary btn-sm flex-1"><IconEdit size={13} />Editar</button>
          <button onClick={() => onToggle(tutorial)} className="btn-ghost btn-sm">{tutorial.is_active ? 'Ocultar' : 'Mostrar'}</button>
          <button onClick={() => onDelete(tutorial.id)} className="btn-ghost btn-sm !px-2 hover:!text-[var(--status-red)]" aria-label="Eliminar tutorial"><IconTrash size={13} /></button>
        </div>
      </div>
    </article>
  )
}

export default function AdminConfiguracion() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [tutTab, setTutTab] = useState('distribuidor')
  // ── Tipo de cambio ──
  const [rate, setRate] = useState('3.50')
  const [rateLoading, setRateLoading] = useState(true)
  const [rateSaving, setRateSaving] = useState(false)
  const [rateSuccess, setRateSuccess] = useState(false)

  // ── Tutoriales ──
  const [tutorials, setTutorials] = useState([])
  const [tutLoading, setTutLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', drive_url: '', target_role: 'proveedor', sort_order: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'exchange_rate').single()
      .then(({ data }) => { if (data) setRate(data.value); setRateLoading(false) })
    fetchTutorials()
  }, [])

  async function fetchTutorials() {
    const { data } = await supabase.from('tutorials').select('*').order('target_role').order('sort_order')
    setTutorials(data || [])
    setTutLoading(false)
  }

  async function saveRate() {
    setRateSaving(true); setRateSuccess(false)
    await supabase.from('settings').update({ value: rate }).eq('key', 'exchange_rate')
    setRateSaving(false)
    toast.success(`Tipo de cambio: 1 USD = S/ ${rate}`)
  }

  function openCreate(role = 'proveedor') {
    setForm({ title: '', description: '', drive_url: '', target_role: role, sort_order: tutorials.filter(t => t.target_role === role).length })
    setError(''); setModal({ type: 'form' })
  }

  function openEdit(t) {
    setForm({ title: t.title, description: t.description || '', drive_url: t.drive_url, target_role: t.target_role, sort_order: t.sort_order })
    setError(''); setModal({ type: 'form', data: t })
  }

  async function saveTutorial() {
    if (!form.title.trim()) return setError('El título es requerido')
    if (!form.drive_url.trim()) return setError('El enlace es requerido')
    setSaving(true); setError('')
    try {
      const payload = { title: form.title.trim(), description: form.description.trim() || null, drive_url: form.drive_url.trim(), target_role: form.target_role, sort_order: parseInt(form.sort_order) || 0, is_active: true }
      if (modal?.data) {
        await supabase.from('tutorials').update(payload).eq('id', modal.data.id)
      } else {
        await supabase.from('tutorials').insert(payload)
      }
      setModal(null); fetchTutorials()
      toast.success('Tutorial guardado')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function deleteTutorial(id) {
    if (!await confirmDialog({ title: '¿Eliminar este tutorial?', danger: true, confirmText: 'Eliminar' })) return
    await supabase.from('tutorials').delete().eq('id', id)
    fetchTutorials()
  }

  async function toggleTutorial(t) {
    await supabase.from('tutorials').update({ is_active: !t.is_active }).eq('id', t.id)
    fetchTutorials()
  }

  const shownTutorials = tutorials.filter(t => t.target_role === tutTab)
  const rateNum = parseFloat(rate) || 0

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes globales de la plataforma" />

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
        {/* Tipo de cambio */}
        <section className="card card-sig p-5 sm:p-6 xl:sticky xl:top-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-xl inset grid place-items-center text-[var(--ink-muted)]"><IconDollar size={18} /></span>
            <div>
              <h2 className="font-display font-semibold text-[var(--ink)]">Tipo de cambio</h2>
              <p className="text-xs text-[var(--ink-muted)]">Convierte dólares a soles en toda la app</p>
            </div>
          </div>
          {rateLoading ? <div className="sk h-12" /> : (
            <div className="space-y-4">
              <label className="inset flex items-center gap-2 px-4 py-3 focus-within:border-[var(--a)]">
                <span className="font-mono text-sm text-[var(--ink-faint)] whitespace-nowrap">1 USD =</span>
                <span className="font-mono text-lg text-[var(--ink-faint)]">S/</span>
                <input type="number" step="0.01" min="1" className="flex-1 min-w-0 bg-transparent outline-none font-mono text-2xl text-[var(--ink)]" value={rate} onChange={e => setRate(e.target.value)} aria-label="Soles por dólar" />
              </label>
              {rateNum > 0 && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[1, 5, 10].map(v => (
                    <div key={v} className="rounded-xl py-2 bg-[var(--surface-side)] border border-[var(--surface-border)]">
                      <p className="text-[11px] text-[var(--ink-faint)]">${v}</p>
                      <p className="font-mono text-sm text-[var(--ink)]">S/ {(v * rateNum).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={saveRate} disabled={rateSaving} className="btn-primary w-full">{rateSaving ? <Spinner size={16} /> : 'Guardar tipo de cambio'}</button>
            </div>
          )}
        </section>

        {/* Tutoriales */}
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display font-semibold text-[var(--ink)]">Tutoriales</h2>
              <p className="text-xs text-[var(--ink-muted)]">Videos que ve cada rol en su panel</p>
            </div>
            <button className="btn-primary btn-sm" onClick={() => openCreate(tutTab)}><IconPlus size={14} />Agregar</button>
          </div>
          <Tabs className="mb-5" tabs={[
            { label: 'Distribuidores', value: 'distribuidor', count: tutorials.filter(t => t.target_role === 'distribuidor').length },
            { label: 'Proveedores', value: 'proveedor', count: tutorials.filter(t => t.target_role === 'proveedor').length },
          ]} active={tutTab} onChange={setTutTab} />
          {tutLoading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="sk h-48" />)}</div> : shownTutorials.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-dashed border-[var(--surface-border-strong)]">
              <p className="text-sm text-[var(--ink-muted)]">Aún no hay tutoriales para {tutTab === 'proveedor' ? 'proveedores' : 'distribuidores'}.</p>
              <button className="btn-secondary btn-sm mt-3" onClick={() => openCreate(tutTab)}><IconPlus size={14} />Agregar el primero</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
              {shownTutorials.map(t => <TutorialCard key={t.id} tutorial={t} onEdit={openEdit} onDelete={deleteTutorial} onToggle={toggleTutorial} />)}
            </div>
          )}
        </section>
      </div>

      <Modal
        open={modal?.type === 'form'}
        onClose={() => setModal(null)}
        title={modal?.data ? 'Editar tutorial' : 'Nuevo tutorial'}
        maxWidth="max-w-md"
        footer={<>
          <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
          <button onClick={saveTutorial} disabled={saving} className="btn-primary min-w-[110px]">{saving ? <Spinner size={15} /> : 'Guardar'}</button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[['distribuidor', 'Distribuidores'], ['proveedor', 'Proveedores']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setForm(f => ({ ...f, target_role: v }))} className={`btn-secondary btn-sm ${form.target_role === v ? 'is-down !text-[var(--a)]' : ''}`}>{l}</button>
            ))}
          </div>
          <div>
            <label className="label">Título</label>
            <input className="input" placeholder="Cómo comprar tu primera cuenta" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea className="input" rows={2} placeholder="Descripción breve..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Enlace del video</label>
            <input className="input" placeholder="https://youtu.be/... o enlace de Google Drive" value={form.drive_url} onChange={e => setForm(f => ({ ...f, drive_url: e.target.value }))} />
            {form.drive_url && getThumbnail(form.drive_url) && (
              <div className="mt-2 rounded-xl overflow-hidden border border-[var(--surface-border)]" style={{ aspectRatio: '16/9' }}>
                <img src={getThumbnail(form.drive_url)} alt="" className="w-full h-full object-cover" onError={e => { e.target.parentElement.style.display = 'none' }} />
              </div>
            )}
          </div>
          <div>
            <label className="label">Orden</label>
            <input type="number" min="0" className="input font-mono" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
            <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Menor número = aparece primero.</p>
          </div>
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
