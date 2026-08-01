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
  const [labels, setLabels] = useState<MomentLabel[]>([])
  const [options, setOptions] = useState<JobOptions>(DEFAULT_OPTIONS)
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [cacheOpen, setCacheOpen] = useState(false)

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
        !health.ffmpeg && 'ffmpeg',
        !health.yt_dlp && 'yt-dlp',
        !health.faster_whisper && 'faster-whisper',
        !health.opencv && 'opencv',
      ].filter(Boolean)
    : []

  return (
    <div className="min-h-screen">
      <Header health={health} onOpenCache={() => setCacheOpen(true)} />

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
        {missingDeps.length > 0 && (
          <div
            role="alert"
            className="card border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
          >
            <p className="font-semibold">Dependensi belum lengkap</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/90">
              Tidak terdeteksi: {missingDeps.join(', ')}. Sebagian tahap pipeline akan gagal. Pasang dependensi lalu
              muat ulang halaman ini.
            </p>
          </div>
        )}

        <section className="animate-fade-up space-y-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Ubah video panjang jadi <span className="text-brand-400">shorts</span> siap unggah
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
              Tempel URL YouTube, klipersid akan mengunduh, mentranskrip, menilai momen terbaik, lalu merender klip 9:16
              bersubtitle — semuanya berjalan lokal di komputer Anda.
            </p>
          </div>

          <UrlForm onSubmit={start} busy={starting} disabled={running} />
          <OptionsPanel options={options} onChange={setOptions} labels={labels} disabled={running} />
        </section>

        {error && (
          <div
            role="alert"
            className="card flex items-start gap-3 border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100"
          >
            <span aria-hidden="true">⚠</span>
            <p className="flex-1 leading-relaxed">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-xs text-rose-300 hover:text-rose-100">
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
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
        klipersid — pemrosesan lokal, tanpa unggahan ke layanan pihak ketiga.
      </footer>

      <CacheDialog open={cacheOpen} onClose={() => setCacheOpen(false)} onCleared={reset} />
    </div>
  )
}
