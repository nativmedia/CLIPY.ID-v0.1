import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from './api'
import AssetsPanel from './components/AssetsPanel'
import CacheDialog from './components/CacheDialog'
import ClipGrid from './components/ClipGrid'
import Header from './components/Header'
import OptionsPanel from './components/OptionsPanel'
import ProgressPanel from './components/ProgressPanel'
import UrlForm from './components/UrlForm'
import { useJobSocket } from './hooks/useJobSocket'
import type { Health, JobOptions, MomentLabel } from './types'
import { ACTIVE_STAGES, DEFAULT_OPTIONS } from './types'

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [labels, setLabels] = useState<MomentLabel[]>([])
  const [options, setOptions] = useState<JobOptions>(DEFAULT_OPTIONS)
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [cacheOpen, setCacheOpen] = useState(false)

  const { job, status, setJob, patchJob } = useJobSocket(jobId)

  const refreshHealth = useCallback(() => {
    setHealthLoading(true)
    api
      .health()
      .then((h) => setHealth(h))
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }, [])

  useEffect(() => {
    refreshHealth()
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
  }, [setJob, refreshHealth])

  const running = job !== null && ACTIVE_STAGES.includes(job.stage)
  const clips = useMemo(() => job?.clips ?? [], [job])
  const backendOffline = !healthLoading && health === null

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
    ? (
        [
          !health.ffmpeg && 'FFmpeg',
          !health.yt_dlp && 'yt-dlp',
          !health.faster_whisper && 'faster-whisper',
          !health.opencv && 'OpenCV',
        ] as Array<string | false>
      ).filter((x): x is string => Boolean(x))
    : []

  const formDisabledReason = running
    ? 'Tunggu hingga proses berjalan selesai, atau batalkan dulu.'
    : backendOffline
      ? 'Backend tidak terhubung. Jalankan server klipersid lalu muat ulang.'
      : null

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Loncat ke konten utama
      </a>

      <Header health={health} healthLoading={healthLoading} onOpenCache={() => setCacheOpen(true)} />

      <main id="main" className="mx-auto w-full max-w-content flex-1 space-y-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-24">
        {backendOffline && (
          <div
            role="alert"
            className="card flex flex-col gap-3 border-amber-500/35 bg-amber-500/10 p-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-100">Backend tidak terhubung</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-100/85">
                Tidak dapat menjangkau API klipersid. Pastikan backend berjalan di mesin ini, lalu periksa lagi.
              </p>
            </div>
            <button type="button" onClick={refreshHealth} className="btn-secondary shrink-0 text-sm">
              Coba lagi
            </button>
          </div>
        )}

        {!backendOffline && missingDeps.length > 0 && (
          <div role="alert" className="card border-amber-500/35 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">Dependensi belum lengkap</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-100/85">
              Tidak terdeteksi: <span className="font-medium">{missingDeps.join(', ')}</span>. Sebagian tahap
              pipeline dapat gagal. Pasang dependensi yang hilang, lalu muat ulang halaman.
            </p>
          </div>
        )}

        <section className="animate-fade-up space-y-4" aria-label="Input dan pengaturan">
          <UrlForm
            onSubmit={start}
            busy={starting}
            disabled={running || backendOffline}
            disabledReason={formDisabledReason}
          />
          <OptionsPanel options={options} onChange={setOptions} labels={labels} disabled={running} />
        </section>

        {error && (
          <div
            role="alert"
            className="card flex items-start gap-3 border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-100"
          >
            <span
              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-500/20 text-xs font-bold"
              aria-hidden="true"
            >
              !
            </span>
            <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="min-h-[36px] shrink-0 rounded-lg px-2 text-xs font-medium text-rose-200 hover:bg-rose-500/15 hover:text-rose-50"
            >
              Tutup
            </button>
          </div>
        )}

        {job && (
          <div className="animate-fade-up space-y-5">
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
              <div className="card p-8 text-center" role="status">
                <p className="text-base font-semibold text-white">Belum ada klip yang lolos filter</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                  Tidak ada momen yang melewati ambang skor {job.options.min_score}
                  {job.options.moment_filter.length > 0 ? ' dengan filter momen aktif' : ''}. Turunkan skor
                  minimum atau longgarkan filter di pengaturan lanjutan, lalu jalankan ulang.
                </p>
                <button type="button" onClick={reset} className="btn-primary mt-5">
                  Atur ulang &amp; coba lagi
                </button>
              </div>
            )}

            {(job.stage === 'failed' || job.stage === 'cancelled') && (
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={reset} className="btn-primary">
                  Coba proses lagi
                </button>
              </div>
            )}

            {assetClips.length > 0 && (
              <div id="assets" className="scroll-mt-24">
                <AssetsPanel clips={assetClips} />
              </div>
            )}

            {!running && job.stage === 'done' && (
              <div className="flex justify-center pt-1">
                <button type="button" onClick={reset} className="btn-ghost text-sm">
                  Proses video lain
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.06] py-5 text-center text-xs text-slate-600">
        <p>klipersid — pemrosesan lokal, tanpa unggahan ke layanan pihak ketiga.</p>
      </footer>

      <CacheDialog open={cacheOpen} onClose={() => setCacheOpen(false)} onCleared={reset} />
    </div>
  )
}
