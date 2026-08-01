import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/format'
import type { Job, JobStage } from '../types'

interface Props {
  job: Job
  onCancel: () => void
  connected: boolean
}

const STEPS: Array<{ stage: JobStage; name: string }> = [
  { stage: 'downloading', name: 'Unduh' },
  { stage: 'transcribing', name: 'Transkripsi' },
  { stage: 'analyzing', name: 'Analisis' },
  { stage: 'rendering', name: 'Render' },
]

const ORDER: JobStage[] = ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering', 'done']

export default function ProgressPanel({ job, onCancel, connected }: Props) {
  const [showLog, setShowLog] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (showLog && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [showLog, job.log.length])

  const currentIdx = ORDER.indexOf(job.stage)
  const failed = job.stage === 'failed'
  const cancelled = job.stage === 'cancelled'
  const running = !failed && !cancelled && job.stage !== 'done'

  return (
    <section className="card animate-fade-up p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-bold text-white">
              {job.source?.title || 'Menyiapkan video…'}
            </h2>
            {running && !connected && (
              <span className="chip border-amber-400/30 bg-amber-400/10 text-amber-300">mode polling</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {job.source?.uploader && <span>{job.source.uploader} · </span>}
            {job.source?.duration ? formatDuration(job.source.duration) : ''}
            {job.source?.width ? ` · ${job.source.width}×${job.source.height}` : ''}
            {job.detected_language ? ` · bahasa: ${job.detected_language}` : ''}
          </p>
        </div>

        {running && (
          <button type="button" onClick={onCancel} className="btn-danger !px-3 !py-2 text-xs">
            Batalkan
          </button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="truncate text-xs text-slate-300">{job.message || job.stage_label}</span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-brand-400">
            {Math.round(job.percent)}%
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(job.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres pemrosesan"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              failed ? 'bg-rose-500' : cancelled ? 'bg-slate-500' : 'bg-gradient-to-r from-brand-500 to-accent-500'
            }`}
            style={{ width: `${Math.max(2, job.percent)}%` }}
          />
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s) => {
          const idx = ORDER.indexOf(s.stage)
          const done = currentIdx > idx || job.stage === 'done'
          const active = job.stage === s.stage
          return (
            <li
              key={s.stage}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs ${
                active
                  ? 'border-brand-400/50 bg-brand-500/10 text-brand-400'
                  : done
                    ? 'border-white/10 bg-ink-850 text-slate-300'
                    : 'border-white/5 bg-ink-900/50 text-slate-500'
              }`}
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                  done ? 'bg-brand-500 text-ink-950' : active ? 'bg-brand-500/30' : 'bg-white/10'
                }`}
              >
                {done ? '✓' : ''}
              </span>
              <span className="truncate font-medium">{s.name}</span>
              {active && (
                <svg viewBox="0 0 24 24" className="ml-auto h-3 w-3 shrink-0 animate-spin" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                </svg>
              )}
            </li>
          )
        })}
      </ol>

      {job.error && (
        <div role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
          <p className="text-xs font-semibold text-rose-300">Proses gagal</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-200/90">{job.error}</p>
        </div>
      )}

      {job.log.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
          >
            {showLog ? 'Sembunyikan' : 'Tampilkan'} log aktivitas ({job.log.length})
          </button>
          {showLog && (
            <div
              ref={logRef}
              className="scroll-slim mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-ink-950/60 p-2.5 font-mono text-[10.5px] leading-relaxed text-slate-400"
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
