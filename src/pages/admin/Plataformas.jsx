import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, Toggle, SkeletonGrid } from '@/components/ui'
import { PlatformLogo } from '@/utils/platform'
import { IconPlus, IconEdit, IconMonitor } from '@/assets/icons'

export default function AdminPlataformas() {
  const [platforms, setPlatforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', logo_filename: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchPlatforms() }, [])

  async function fetchPlatforms() {
    const { data } = await supabase.from('platforms').select('*').order('name')
    setPlatforms(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.name || !form.logo_filename) return setError('Nombre y archivo son requeridos')
    setSaving(true)
    setError('')
    try {
      if (modal?.data) {
        await supabase.from('platforms').update({ name: form.name, logo_filename: form.logo_filename }).eq('id', modal.data.id)
      } else {
        await supabase.from('platforms').insert({ name: form.name, logo_filename: form.logo_filename })
      }
      setModal(null)
      fetchPlatforms()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function togglePlatform(p) {
    await supabase.from('platforms').update({ is_active: !p.is_active }).eq('id', p.id)
    fetchPlatforms()
  }

  return (
    <div>
      <PageHeader
        title="Plataformas"
        subtitle="Logos y plataformas disponibles para los proveedores"
        action={
          <button className="btn-primary" onClick={() => { setForm({ name: '', logo_filename: '' }); setModal({ type: 'form' }) }}>
            <IconPlus size={16} />
            Nueva plataforma
          </button>
        }
      />

      {loading ? <SkeletonGrid count={10} height={150} /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 stagger">
          {platforms.map(p => (
            <article key={p.id} className={`card card-hover p-4 flex flex-col items-center gap-2.5 text-center ${!p.is_active ? 'opacity-50' : ''}`}>
              <PlatformLogo name={p.name} filename={p.logo_filename} size={56} />
              <div className="min-w-0 w-full">
                <p className="text-[13px] font-semibold text-[var(--ink)] leading-tight truncate">{p.name}</p>
                <p className="text-[10.5px] font-mono text-[var(--ink-faint)] truncate">{p.logo_filename}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => { setForm({ name: p.name, logo_filename: p.logo_filename }); setModal({ type: 'form', data: p }) }} className="btn-secondary btn-sm btn-icon" aria-label={`Editar ${p.name}`}><IconEdit size={13} /></button>
                <Toggle checked={p.is_active} onChange={() => togglePlatform(p)} />
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={modal?.type === 'form'} onClose={() => setModal(null)} title={modal?.data ? 'Editar plataforma' : 'Nueva plataforma'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input" placeholder="Netflix" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Archivo de logo</label>
            <input className="input font-mono" placeholder="netflix.png" value={form.logo_filename} onChange={e => setForm(f => ({ ...f, logo_filename: e.target.value }))} />
            <p className="text-xs text-[var(--ink-faint)] mt-1">El archivo debe estar en /public/logos/</p>
          </div>
          {form.logo_filename && (
            <div className="flex items-center gap-3 inset p-3">
              <PlatformLogo key={form.logo_filename} name={form.name} filename={form.logo_filename} size={44} />
              <span className="text-sm text-[var(--ink-muted)]">Vista previa</span>
            </div>
          )}
          {error && <Alert type="error">{error}</Alert>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Spinner size={16} /> : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
