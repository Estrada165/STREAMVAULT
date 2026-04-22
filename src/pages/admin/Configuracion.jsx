import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Alert, Spinner, Modal } from '@/components/ui'
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
    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 14, overflow: 'hidden', opacity: tutorial.is_active ? 1 : 0.5 }}>
      {/* Thumbnail */}
      <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--surface-overlay)', position: 'relative', overflow: 'hidden' }}>
        {thumb
          ? <img src={thumb} alt={tutorial.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
        }
        {/* Badge rol */}
        <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 99, background: tutorial.target_role === 'proveedor' ? '#5822b4' : '#006e99', color: '#fff' }}>
          {tutorial.target_role}
        </span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tutorial.title}</p>
        {tutorial.description && <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{tutorial.description}</p>}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => onEdit(tutorial)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '6px 10px' }}>
            <IconEdit size={13} />Editar
          </button>
          <button onClick={() => onToggle(tutorial)} className="btn-ghost"
            style={{ fontSize: 12, padding: '6px 10px', color: tutorial.is_active ? 'var(--status-yellow)' : 'var(--status-green)' }}>
            {tutorial.is_active ? 'Ocultar' : 'Mostrar'}
          </button>
          <button onClick={() => onDelete(tutorial.id)} className="btn-ghost" style={{ padding: '6px 9px', color: 'var(--status-red)' }}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminConfiguracion() {
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
    setRateSuccess(true); setRateSaving(false)
    setTimeout(() => setRateSuccess(false), 3000)
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
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function deleteTutorial(id) {
    if (!confirm('¿Eliminar este tutorial?')) return
    await supabase.from('tutorials').delete().eq('id', id)
    fetchTutorials()
  }

  async function toggleTutorial(t) {
    await supabase.from('tutorials').update({ is_active: !t.is_active }).eq('id', t.id)
    fetchTutorials()
  }

  const provTutorials = tutorials.filter(t => t.target_role === 'proveedor')
  const distTutorials = tutorials.filter(t => t.target_role === 'distribuidor')

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes globales de la plataforma" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>

        {/* ── Tipo de cambio ── */}
        <div className="card" style={{ padding: 24, maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconDollar size={18} style={{ color: 'var(--ink-muted)' }} />
            </div>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Tipo de cambio</p>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>1 USD equivale a X soles peruanos</p>
            </div>
          </div>
          {rateLoading ? <Spinner /> : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label className="label">1 USD = ? PEN</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" step="0.01" min="1" className="input" value={rate} onChange={e => setRate(e.target.value)} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>soles</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Ejemplo: si rate = 3.80, $1 → S/ 3.80</p>
              </div>
              {rateSuccess && <Alert type="success" style={{ marginBottom: 10 }}>Tipo de cambio actualizado</Alert>}
              <button onClick={saveRate} disabled={rateSaving} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {rateSaving ? <Spinner size={16} /> : 'Guardar cambios'}
              </button>
            </>
          )}
        </div>

        {/* ── Tutoriales proveedores ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Tutoriales para Proveedores</p>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Los proveedores verán estos videos en su panel</p>
            </div>
            <button className="btn-primary" onClick={() => openCreate('proveedor')} style={{ flexShrink: 0 }}>
              <IconPlus size={14} />Agregar
            </button>
          </div>
          {tutLoading ? <Spinner /> : provTutorials.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-raised)', borderRadius: 12, border: '1px dashed var(--surface-border)' }}>
              <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Sin tutoriales para proveedores. Agrega el primero.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {provTutorials.map(t => <TutorialCard key={t.id} tutorial={t} onEdit={openEdit} onDelete={deleteTutorial} onToggle={toggleTutorial} />)}
            </div>
          )}
        </div>

        {/* ── Tutoriales distribuidores ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Tutoriales para Distribuidores</p>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Los distribuidores verán estos videos en su panel</p>
            </div>
            <button className="btn-primary" onClick={() => openCreate('distribuidor')} style={{ flexShrink: 0 }}>
              <IconPlus size={14} />Agregar
            </button>
          </div>
          {tutLoading ? <Spinner /> : distTutorials.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-raised)', borderRadius: 12, border: '1px dashed var(--surface-border)' }}>
              <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Sin tutoriales para distribuidores. Agrega el primero.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {distTutorials.map(t => <TutorialCard key={t.id} tutorial={t} onEdit={openEdit} onDelete={deleteTutorial} onToggle={toggleTutorial} />)}
            </div>
          )}
        </div>
      </div>

      {/* Modal crear/editar tutorial */}
      <Modal open={modal?.type === 'form'} onClose={() => setModal(null)} title={modal?.data ? 'Editar tutorial' : 'Nuevo tutorial'} maxWidth="max-w-md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Título *</label>
            <input className="input" placeholder="Ej: Tutorial de inicio rápido" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Descripción <span style={{ fontWeight: 400, color: 'var(--ink-faint)', textTransform: 'none' }}>opcional</span></label>
            <textarea className="input" rows={2} placeholder="Descripción breve del tutorial..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="label">Enlace del video *</label>
            <input className="input" placeholder="https://drive.google.com/... o https://youtu.be/..." value={form.drive_url} onChange={e => setForm(f => ({ ...f, drive_url: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
              Compatible con Google Drive, YouTube y cualquier URL de video
            </p>
            {/* Preview del thumbnail */}
            {form.drive_url && getThumbnail(form.drive_url) && (
              <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--surface-border)', aspectRatio: '16/9' }}>
                <img src={getThumbnail(form.drive_url)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.parentElement.style.display = 'none' }} />
              </div>
            )}
          </div>
          <div>
            <label className="label">Para</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ value: 'proveedor', label: 'Proveedores', color: '#5822b4' }, { value: 'distribuidor', label: 'Distribuidores', color: '#006e99' }].map(r => (
                <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, target_role: r.value }))}
                  style={{ padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', border: form.target_role === r.value ? `2px solid ${r.color}` : '1px solid var(--surface-border)', background: form.target_role === r.value ? `${r.color}15` : 'var(--surface-raised)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: form.target_role === r.value ? r.color : 'var(--ink)' }}>{r.label}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Orden <span style={{ fontWeight: 400, color: 'var(--ink-faint)', textTransform: 'none' }}>opcional</span></label>
            <input type="number" min="0" className="input" placeholder="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Número menor = aparece primero</p>
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModal(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={saveTutorial} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <Spinner size={15} /> : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}