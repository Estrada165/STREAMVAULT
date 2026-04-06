import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Alert, Spinner, Toggle } from '@/components/ui'
import { IconPlus, IconEdit, IconMonitor } from '@/assets/icons'
import { getLogoPath } from '@/utils'

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

      {loading ? <div className="flex justify-center py-20"><Spinner size={32} /></div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 stagger">
          {platforms.map(p => (
            <div key={p.id} className={`card p-4 flex flex-col items-center gap-2 text-center relative ${!p.is_active ? 'opacity-40' : ''}`}>
              <div className="w-14 h-14 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center overflow-hidden">
                <img src={getLogoPath(p.logo_filename)} alt={p.name}
                  className="w-12 h-12 object-contain"
                  onError={e => { e.target.style.display = 'none' }} />
              </div>
              <p className="text-xs font-semibold text-[var(--ink)] leading-tight">{p.name}</p>
              <p className="text-[10px] font-mono text-[var(--ink-faint)]">{p.logo_filename}</p>
              <div className="flex gap-1 mt-1">
                <button onClick={() => { setForm({ name: p.name, logo_filename: p.logo_filename }); setModal({ type: 'form', data: p }) }}
                  className="btn-ghost p-1.5 text-xs"><IconEdit size={13} /></button>
                <Toggle checked={p.is_active} onChange={() => togglePlatform(p)} />
              </div>
            </div>
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
            <div className="flex items-center gap-3 bg-[var(--surface-overlay)] p-3 rounded-xl">
              <img src={getLogoPath(form.logo_filename)} alt="Preview" className="w-10 h-10 object-contain rounded-lg"
                onError={e => { e.target.src = '' }} />
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
