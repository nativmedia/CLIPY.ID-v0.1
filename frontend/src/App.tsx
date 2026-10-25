import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from './api'
import AssetsPanel from './components/AssetsPanel'
import CacheDialog from './components/CacheDialog'
import ClipGrid from './components/ClipGrid'
import Header from './components/Header'
import Guide from './components/Guide'
import OptionsPanel from './components/OptionsPanel'
import ProgressPanel from './components/ProgressPanel'
import UrlForm from './components/UrlForm'
import { useJobSocket } from './hooks/useJobSocket'
import type { Health, JobOptions, MomentLabel } from './types'
import { ACTIVE_STAGES, DEFAULT_OPTIONS } from './types'

export default function App() {
  const [page, setPage] = useState<'studio' | 'guide'>(location.hash === '#guide' ? 'guide' : 'studio')
  useEffect(() => {
    const sync = () => setPage(location.hash === '#guide' ? 'guide' : 'studio')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const [health, setHealth] = useState<Health | null>(null)
  const [labels, setLabels] = useState<MomentLabel[]>([])
  const [options, setOptions] = useState<JobOptions>(DEFAULT_OPTIONS)
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [cacheOpen, setCacheOpen] = useState(false)
  const closeCache = useCallback(() => setCacheOpen(false), [])

  const { job, status, setJob, patchJob } = useJobSocket(jobId)

  useEffect(() => {
    api.health().then(setHealth, () => setHealth(null))
    api.momentLabels().then(setLabels, () => setLabels([]))
    // Recover the newest job after a refresh. The worker keeps running in the
    // backend, so hiding its progress here makes a healthy job look lost.
    api.listJobs().then(
      (jobs) => {
        const latest = [...jobs].sort((a, b) => b.updated_at - a.updated_at)[0]
        if (latest) {
          setJobId(latest.id)
          setJob(latest)
        }
      },
      () => undefined,
    )
  }, [setJob])

  const running = job !== null && ACTIVE_STAGES.includes(job.stage)
  const clips = useMemo(() => job?.clips ?? [], [job])

  // Pre-select everything the first time a finished job's clips arrive.
  useEffect(() => {
    if (job?.stage === 'done' && clips.length > 0 && selected.size === 0) {
      setSelected(new Set(clips.map((c) => c.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.stage, clips.length])

  const start = useCallback(
    async (url: string) => {
      setStarting(true)
      setError(null)
      setSelected(new Set())
      setJob(null)
      try {
        const created = await api.createJob(url, options)
        setJobId(created.id)
        setJob(created)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memulai proses.')
      } finally {
        setStarting(false)
      }
    },
    [options, setJob],
  )

  const cancel = useCallback(async () => {
    if (!jobId) return
    try {
      await api.cancelJob(jobId)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membatalkan proses.')
    }
  }, [jobId])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => setSelected(new Set(clips.map((c) => c.id))), [clips])
  const clearAll = useCallback(() => setSelected(new Set()), [])

  const confirm = useCallback(async () => {
    if (!jobId || selected.size === 0) return
    setConfirming(true)
    setError(null)
    try {
      const updated = await api.generateAssets(jobId, [...selected])
      const byId = new Map(updated.map((c) => [c.id, c]))
      patchJob((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => byId.get(c.id) ?? c),
      }))
      // Scroll the freshly generated assets into view.
      window.setTimeout(() => {
        document.getElementById('assets')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat aset pendukung.')
    } finally {
      setConfirming(false)
    }
  }, [jobId, selected, patchJob])

  const reset = useCallback(() => {
    setJobId(null)
    setJob(null)
    setSelected(new Set())
    setError(null)
  }, [setJob])

  const assetClips = useMemo(() => clips.filter((c) => c.assets !== null), [clips])
  const missingDeps = health
    ? [
        !(health.ffmpeg && health.ffprobe) && 'FFmpeg / FFprobe',
        !health.numpy && 'NumPy',
        !health.yt_dlp && 'yt-dlp',
        !health.faster_whisper && 'faster-whisper',
        !health.opencv && 'opencv',
      ].filter(Boolean)
    : []

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">Langsung ke konten</a>
      <Header health={health} onOpenCache={() => setCacheOpen(true)} />
      <div className="app-shell">
        <aside className="sidebar">
          <nav aria-label="Navigasi utama">
            <a href="#studio" className={`nav-button ${page === 'studio' ? 'active' : ''}`} aria-current={page === 'studio' ? 'page' : undefined}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m10 8 6 4-6 4Z"/></svg>Studio</a>
            <a href="#guide" className={`nav-button ${page === 'guide' ? 'active' : ''}`} aria-current={page === 'guide' ? 'page' : undefined}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5c4-2 6-2 9 0 3-2 5-2 9 0v15c-4-2-6-2-9 0-3-2-5-2-9 0ZM12 5v15"/></svg>Panduan</a>
          </nav>
          <div className="sidebar-note"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg><p><strong>Studio lokal Anda.</strong><br/>Video diproses dan disimpan di komputer ini.</p><a href="https://github.com/nativmedia/CLIPY.ID-v0.1" target="_blank" rel="noreferrer">Project di GitHub ↗</a></div>
        </aside>
        <main id="main-content" className="workspace" tabIndex={-1}>
          <div className="workspace-path"><span>Ruang kerja</span><span aria-hidden="true">/</span><span>{page === 'studio' ? 'Studio' : 'Panduan'}</span></div>
          {page === 'guide' ? <Guide /> : <>

        {missingDeps.length > 0 && (
          <div
            role="alert"
            className="card border-slate-500/40 bg-slate-500/10 p-4 text-sm text-slate-100"
          >
            <p className="font-semibold">Dependensi belum lengkap</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-200/90">
              Tidak terdeteksi: {missingDeps.join(', ')}. Sebagian tahap pipeline akan gagal. Pasang dependensi lalu
              muat ulang halaman ini.
            </p>
          </div>
        )}

        <div className="intro"><h1>Cerita panjang.<br/>Potongan yang berarti.</h1><p>Temukan momen terbaik dari video Anda. Jadikan klip vertikal bersubtitle untuk Shorts, Reels, dan TikTok.</p></div>
        <div className="studio-layout">
          <div className="editor-column">
            <UrlForm onSubmit={start} busy={starting} disabled={running || !health || missingDeps.length > 0} />
            <OptionsPanel options={options} onChange={setOptions} labels={labels} disabled={running || starting} />
            {!job && <section className="empty-results" aria-label="Hasil klip"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg><h2>Klip Anda dimulai di sini</h2><p>Tambahkan tautan video untuk mulai. Setelah selesai, tinjau setiap klip dan unduh hasil yang Anda pilih.</p><div className="workflow"><span>Unduh video</span><i/><span>Transkripsi</span><i/><span>Pilih momen</span><i/><span>Render klip</span></div></section>}
          </div>
          <aside className="card output-panel" aria-label="Spesifikasi hasil">
            <h2>Disiapkan untuk layar vertikal</h2>
            <div className="portrait-preview" aria-label="Ilustrasi format vertikal 9 banding 16"><div className="frame-corners"><svg width="43" height="48" viewBox="0 0 43 48" fill="none" stroke="currentColor"><path d="M1 12V1h11M31 1h11v11M42 36v11H31M12 47H1V36"/><circle cx="21.5" cy="20" r="7"/><path d="M9 38c0-12 25-12 25 0"/></svg></div><div className="preview-caption">Setiap cerita punya<br/><span>momennya.</span></div></div>
            <dl className="spec-list"><div><dt>Rasio</dt><dd>9:16 vertikal</dd></div><div><dt>Resolusi</dt><dd>720 × 1280</dd></div><div><dt>Durasi</dt><dd>{options.min_clip_seconds}–{options.max_clip_seconds} detik</dd></div><div><dt>Jumlah</dt><dd>Hingga {options.max_clips} klip</dd></div><div><dt>Subtitle</dt><dd>{options.subtitle_style}</dd></div><div><dt>Format</dt><dd>MP4 + subtitle ASS</dd></div></dl>
            <div className="output-platforms"><span>Shorts</span><span>Reels</span><span>TikTok</span></div><p className="format-note">Tinjau subtitle dan potongan sebelum membagikan. Hasil mengikuti isi dan kualitas video sumber.</p>
          </aside>
        </div>

        {error && (
          <div
            role="alert"
            className="card flex items-start gap-3 border-slate-500/40 bg-slate-500/10 p-4 text-sm text-slate-100"
          >
            <span aria-hidden="true">!</span>
            <p className="flex-1 leading-relaxed">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-xs text-slate-300 hover:text-slate-100">
              Tutup
            </button>
          </div>
        )}

        {job && (
          <div className="mt-7 space-y-5">
            <ProgressPanel job={job} onCancel={cancel} connected={status === 'open'} />

            {job.stage === 'done' && clips.length > 0 && (
              <ClipGrid
                clips={clips}
                labels={labels}
                selected={selected}
                onToggle={toggle}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                onConfirm={confirm}
                confirming={confirming}
              />
            )}

            {job.stage === 'done' && clips.length === 0 && (
              <div className="card p-6 text-center text-sm text-slate-400">
                Tidak ada momen yang melewati ambang skor {job.options.min_score}. Coba turunkan skor minimum atau
                longgarkan filter momen, lalu jalankan ulang.
              </div>
            )}

            {assetClips.length > 0 && (
              <div id="assets" className="scroll-mt-20">
                <AssetsPanel clips={assetClips} />
              </div>
            )}

            {!running && (
              <div className="flex justify-center pt-2">
                <button type="button" onClick={reset} className="btn-ghost">
                  Proses video lain
                </button>
              </div>
            )}
          </div>
        )}
          </>}
          <footer className="app-footer"><span>CLIPY.ID v0.1 · Dibuat untuk kreator.</span><span>Pemrosesan lokal. Kendali di tangan Anda.</span></footer>
        </main>
      </div>

      <CacheDialog open={cacheOpen} onClose={closeCache} onCleared={reset} />
    </div>
  )
}
