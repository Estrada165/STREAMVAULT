import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, SkeletonGrid } from '@/components/ui'
import { IconBook } from '@/assets/icons'

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?/\s]{11})/)
  return m ? m[1] : null
}

function getThumbnail(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  const driveMatch = url?.match(/\/d\/([^/]+)/)
  if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w600`
  return null
}

function TutorialCard({ tutorial, index }) {
  const [thumbErr, setThumbErr] = useState(false)
  const [playing, setPlaying] = useState(false)
  const thumb = getThumbnail(tutorial.drive_url)
  const ytId = getYouTubeId(tutorial.drive_url)
  const driveId = tutorial.drive_url?.match(/\/d\/([^/]+)/)?.[1]
  const embeddable = !!(ytId || driveId)

  function play() {
    if (embeddable) setPlaying(true)
    else window.open(tutorial.drive_url, '_blank', 'noopener')
  }

  return (
    <article className="product-card group flex flex-col">
      <div className="relative w-full overflow-hidden bg-[var(--surface-overlay)]" style={{ aspectRatio: '16 / 9' }}>
        {playing ? (
          <iframe
            title={tutorial.title}
            src={ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1` : `https://drive.google.com/file/d/${driveId}/preview`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media" allowFullScreen
          />
        ) : (
          <button onClick={play} className="absolute inset-0 w-full h-full" aria-label={`Ver ${tutorial.title}`}>
            {thumb && !thumbErr
              ? <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" onError={() => setThumbErr(true)} />
              : <div className="w-full h-full" style={{ background: 'radial-gradient(120% 100% at 30% 0%, var(--a-soft), transparent 60%), radial-gradient(120% 100% at 100% 100%, var(--b-soft), transparent 60%), var(--surface-overlay)' }} />}
            <span className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl grid place-items-center bg-[var(--key)] text-[var(--ink)] border border-[var(--surface-border-strong)] shadow-[inset_0_1px_0_var(--hl),0_3px_0_var(--a-edge),0_10px_24px_rgba(0,0,0,.25)] transition-transform group-hover:scale-110">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4" /></svg>
            </span>
            <span className="absolute top-3 left-3 badge !bg-[var(--surface-raised)] font-mono">{String(index + 1).padStart(2, '0')}</span>
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold text-[15px] text-[var(--ink)] leading-snug">{tutorial.title}</h3>
        {tutorial.description && <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed mt-1 line-clamp-2">{tutorial.description}</p>}
      </div>
    </article>
  )
}

export default function TutorialsPage({ role }) {
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('tutorials').select('*')
      .eq('target_role', role).eq('is_active', true)
      .order('sort_order').order('created_at')
      .then(({ data }) => { setTutorials(data || []); setLoading(false) })
  }, [role])

  return (
    <div>
      <PageHeader title="Tutoriales" subtitle="Videos cortos para sacarle el máximo a la plataforma" />
      {loading ? <SkeletonGrid count={6} height={300} /> : tutorials.length === 0 ? (
        <div className="card">
          <EmptyState icon={IconBook} title="Aún no hay tutoriales" description="Pronto publicaremos guías en video aquí." />
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {tutorials.map((t, i) => <TutorialCard key={t.id} tutorial={t} index={i} />)}
        </div>
      )}
    </div>
  )
}
