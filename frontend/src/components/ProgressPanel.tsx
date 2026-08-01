import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/format'
import type { Job, JobStage } from '../types'

interface Props {
  job: Job
  onCancel: () => void
  connected: boolean
}

/** Visual timeline phases — maps to backend JobStage values. */
const STEPS: Array<{ stage: JobStage; name: string; short: string }> = [
  { stage: 'queued', name: 'Validasi', short: 'Validasi' },
  { stage: 'downloading', name: 'Unduh', short: 'Unduh' },
  { stage: 'transcribing', name: 'Transkripsi', short: 'Transkrip' },
  { stage: 'analyzing', name: 'Analisis', short: 'Analisis' },
  { stage: 'rendering', name: 'Render', short: 'Render' },
]

const ORDER: JobStage[] = [
  'queued',
  'downloading',
  'transcribing',
  'analyzing',
  'rendering',
  'done',
]

type StepState = 'done' | 'active' | 'pending' | 'error'

/**
 * When the job ends as failed/cancelled the backend only reports the terminal
 * stage. Approximate which pipeline step failed using percent bands so the
 * stepper still communicates something useful — never invents time estimates.
 */
function resolveStep(job: Job, stepStage: JobStage): StepState {
  const stepIdx = ORDER.indexOf(stepStage)
  const currentIdx = ORDER.indexOf(job.stage)

  if (job.stage === 'done') return 'done'

  if (job.stage === 'failed') {
    const p = job.percent
    const errorStage: JobStage =
      p >= 90 ? 'rendering' : p >= 70 ? 'analyzing' : p >= 40 ? 'transcribing' : p >= 10 ? 'downloading' : 'queued'
    const errorIdx = ORDER.indexOf(errorStage)
    if (stepIdx < errorIdx) return 'done'
    if (stepIdx === errorIdx) return 'error'
    return 'pending'
  }

  if (job.stage === 'cancelled') {
    // Cancelled may still carry the last active stage if backend preserves it;
    // otherwise fall back to percent heuristic.
    if (currentIdx >= 0) {
      if (stepIdx < currentIdx) return 'done'
      if (stepIdx === currentIdx) return 'error'
      return 'pending'
    }
    const p = job.percent
    const stopStage: JobStage =
      p >= 90 ? 'rendering' : p >= 70 ? 'analyzing' : p >= 40 ? 'transcribing' : p >= 10 ? 'downloading' : 'queued'
    const stopIdx = ORDER.indexOf(stopStage)
    if (stepIdx < stopIdx) return 'done'
    if (stepIdx === stopIdx) return 'error'
    return 'pending'
  }

  if (currentIdx < 0) return 'pending'
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

export default function ProgressPanel({ job, onCancel, connected }: Props) {
  const [showLog, setShowLog] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (showLog && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [showLog, job.log.length])

  const failed = job.stage === 'failed'
  const cancelled = job.stage === 'cancelled'
  const done = job.stage === 'done'
  const running = !failed && !cancelled && !done

  const statusHeadline = failed
    ? 'Proses gagal'
    : cancelled
      ? 'Proses dibatalkan'
      : done
        ? 'Selesai'
        : job.stage_label || 'Memproses…'

  const detailMessage =
    job.message && job.message !== statusHeadline && job.message !== job.stage_label
      ? job.message
      : running && job.stage_label && job.stage_label !== statusHeadline
        ? job.stage_label
        : job.message && job.message !== statusHeadline
          ? job.message
          : null

  return (
    <section className="card animate-fade-up p-5 sm:p-6" aria-labelledby="progress-title">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="progress-title" className="truncate text-base font-bold text-white">
              {job.source?.title || statusHeadline}
            </h2>
            {running && (
              <span
                className={`status-pill ${
                  connected
                    ? 'border-brand-400/25 bg-brand-500/10 text-brand-300'
                    : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-brand-400 animate-pulse-soft' : 'bg-amber-400'}`}
                  aria-hidden="true"
                />
                {connected ? 'Langsung' : 'Mode polling'}
              </span>
            )}
            {done && (
              <span className="status-pill border-brand-400/25 bg-brand-500/10 text-brand-300">Selesai</span>
            )}
            {failed && (
              <span className="status-pill border-rose-400/30 bg-rose-500/10 text-rose-300">Gagal</span>
            )}
            {cancelled && (
              <span className="status-pill border-slate-400/30 bg-white/5 text-slate-300">Dibatalkan</span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">
            {job.source?.uploader && <span>{job.source.uploader} · </span>}
            {job.source?.duration ? formatDuration(job.source.duration) : null}
            {job.source?.width ? ` · ${job.source.width}×${job.source.height}` : null}
            {job.detected_language ? ` · bahasa terdeteksi: ${job.detected_language}` : null}
            {!job.source && running ? ' Menyiapkan sumber video…' : null}
          </p>
        </div>

        {running && (
          <button type="button" onClick={onCancel} className="btn-danger !min-h-[40px] !px-3.5 !py-2 text-sm">
            Batalkan
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-sm text-slate-300">
            <span className="font-medium text-slate-100">{statusHeadline}</span>
            {detailMessage && <span className="text-slate-400"> — {detailMessage}</span>}
          </p>
          <span
            className={`shrink-0 text-sm font-bold tabular-nums ${
              failed ? 'text-rose-300' : cancelled ? 'text-slate-400' : 'text-brand-400'
            }`}
          >
            {Math.round(job.percent)}%
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(job.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres pemrosesan"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              failed ? 'bg-rose-500' : cancelled ? 'bg-slate-500' : 'bg-brand-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(done ? 100 : 2, job.percent))}%` }}
          />
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Tahap pemrosesan">
        {STEPS.map((s, i) => {
          const state = resolveStep(job, s.stage)
          return (
            <li
              key={s.stage}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2.5 text-xs ${
                state === 'active'
                  ? 'border-brand-400/45 bg-brand-500/10 text-brand-300'
                  : state === 'done'
                    ? 'border-white/[0.08] bg-ink-850/80 text-slate-300'
                    : state === 'error'
                      ? 'border-rose-400/40 bg-rose-500/10 text-rose-300'
                      : 'border-white/[0.05] bg-ink-900/40 text-slate-500'
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  state === 'done'
                    ? 'bg-brand-500 text-ink-950'
                    : state === 'active'
                      ? 'bg-brand-500/25 text-brand-300'
                      : state === 'error'
                        ? 'bg-rose-500/30 text-rose-200'
                        : 'bg-white/10 text-slate-500'
                }`}
                aria-hidden="true"
              >
                {state === 'done' ? '✓' : state === 'error' ? '!' : i + 1}
              </span>
              <span className="min-w-0 truncate font-medium">
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.name}</span>
              </span>
              {state === 'active' && (
                <svg
                  viewBox="0 0 24 24"
                  className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  aria-hidden="true"
                >
                  <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                </svg>
              )}
              <span className="sr-only">
                {state === 'done'
                  ? 'selesai'
                  : state === 'active'
                    ? 'sedang berjalan'
                    : state === 'error'
                      ? 'gagal'
                      : 'menunggu'}
              </span>
            </li>
          )
        })}
      </ol>

      {job.error && (
        <div role="alert" className="mt-5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-4">
          <p className="text-sm font-semibold text-rose-200">Tidak dapat menyelesaikan proses</p>
          <p className="mt-1.5 text-sm leading-relaxed text-rose-100/90">{job.error}</p>
          <p className="mt-2 text-xs text-rose-200/70">
            Periksa koneksi internet (untuk unduhan), dependensi di header, lalu coba proses ulang dengan URL yang
            sama.
          </p>
        </div>
      )}

      {cancelled && !job.error && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300"
        >
          Proses dihentikan. Anda dapat memulai ulang dengan URL yang sama atau video lain.
        </div>
      )}

      {job.log.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
            className="min-h-[36px] text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            {showLog ? 'Sembunyikan' : 'Tampilkan'} log teknis ({job.log.length})
          </button>
          {showLog && (
            <div
              ref={logRef}
              className="scroll-slim mt-2 max-h-44 overflow-y-auto rounded-xl border border-white/[0.08] bg-ink-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-400"
            >
              {job.log.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
