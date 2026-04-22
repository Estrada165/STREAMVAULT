import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Spinner } from '@/components/ui'

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?/\s]{11})/)
  return m ? m[1] : null
}

function getThumbnail(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  const driveMatch = url?.match(/\/d\/([^/]+)/)
  if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w400`
  return null
}

function TutorialCard({ tutorial }) {
  const [thumbErr, setThumbErr] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const thumb = getThumbnail(tutorial.drive_url)
  const ytId = getYouTubeId(tutorial.drive_url)
  const isDrive = !!tutorial.drive_url?.includes('drive.google.com')

  function handleClick() {
    if (ytId || isDrive) setShowPlayer(true)
    else window.open(tutorial.drive_url, '_blank')
  }

  return (
    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 16, overflow: 'hidden', transition: 'box-shadow 0.2s, transform 0.15s', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.18)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
      onClick={handleClick}
    >
      <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', background: 'var(--surface-overlay)' }}>
        {showPlayer ? (
          <iframe
            src={ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1` : `https://drive.google.com/file/d/${tutorial.drive_url.match(/\/d\/([^/]+)/)?.[1]}/preview`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; encrypted-media" allowFullScreen
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <>
            {thumb && !thumbErr
              ? <img src={thumb} alt={tutorial.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setThumbErr(true)} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #006e9915, #006e9908)' }}>
                  <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#006e99" strokeWidth="1.5" opacity="0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
            }
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#1a1a1a"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>{tutorial.title}</p>
        {tutorial.description && (
          <p style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{tutorial.description}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#006e99' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#006e99' }}>Tutorial</span>
        </div>
      </div>
    </div>
  )
}

export default function DistTutoriales() {
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('tutorials').select('*')
      .eq('target_role', 'distribuidor').eq('is_active', true)
      .order('sort_order').order('created_at')
      .then(({ data }) => { setTutorials(data || []); setLoading(false) })
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader title="Tutoriales" subtitle="Guías y videos de ayuda para usar la plataforma" />
      {tutorials.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface-raised)', borderRadius: 16, border: '1px solid var(--surface-border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#006e9915', border: '1.5px solid #006e9930', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#006e99" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>Sin tutoriales disponibles</p>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>El administrador publicará guías aquí pronto.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }} className="stagger">
          {tutorials.map(t => <TutorialCard key={t.id} tutorial={t} />)}
        </div>
      )}
    </div>
  )
}