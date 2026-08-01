import type { Health } from '../types'

interface Props {
  health: Health | null
  healthLoading: boolean
  onOpenCache: () => void
}

type DepItem = { key: string; label: string; ok: boolean }

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        ok ? 'bg-brand-400' : 'bg-rose-400'
      }`}
      aria-hidden="true"
    />
  )
}

export default function Header({ health, healthLoading, onOpenCache }: Props) {
  const deps: DepItem[] = health
    ? [
        { key: 'ffmpeg', label: 'FFmpeg', ok: health.ffmpeg && health.ffprobe },
        { key: 'ytdlp', label: 'yt-dlp', ok: health.yt_dlp },
        { key: 'whisper', label: 'Whisper', ok: health.faster_whisper },
        { key: 'opencv', label: 'OpenCV', ok: health.opencv },
      ]
    : []

  const allOk = deps.length > 0 && deps.every((d) => d.ok)
  const offline = !healthLoading && health === null
  const readyLabel = healthLoading
    ? 'Memeriksa sistem…'
    : offline
      ? 'Backend tidak terhubung'
      : allOk
        ? 'Sistem siap'
        : 'Dependensi belum lengkap'

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 sm:px-6">
        <a href="#main" className="flex min-w-0 items-center gap-3 rounded-xl">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 shadow-lift"
            aria-hidden="true"
          >
            <img src="./klipersid.svg" alt="" className="h-5 w-5 brightness-0" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-base font-bold tracking-tight text-white">klipersid</p>
            <p className="truncate text-xs text-slate-400">
              Pemrosesan lokal · video panjang → shorts 9:16
            </p>
          </div>
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          {/* Desktop: detailed dependency strip */}
          <div
            className="hidden items-center gap-1 rounded-xl border border-white/[0.08] bg-ink-900/70 px-2 py-1.5 lg:flex"
            role="status"
            aria-label={readyLabel}
          >
            {healthLoading && (
              <span className="px-2 text-xs text-slate-500">Memeriksa dependensi…</span>
            )}
            {offline && (
              <span className="flex items-center gap-1.5 px-2 text-xs text-amber-300">
                <StatusDot ok={false} />
                Backend tidak terhubung
              </span>
            )}
            {deps.map((d) => (
              <span
                key={d.key}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-300"
                title={d.ok ? `${d.label} siap` : `${d.label} tidak terdeteksi`}
              >
                <StatusDot ok={d.ok} />
                <span className={d.ok ? '' : 'text-rose-300'}>{d.label}</span>
                <span className="sr-only">{d.ok ? 'siap' : 'tidak tersedia'}</span>
              </span>
            ))}
          </div>

          {/* Compact status for smaller screens */}
          <span
            className={`status-pill lg:hidden ${
              healthLoading
                ? 'border-white/10 bg-white/5 text-slate-400'
                : offline
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : allOk
                    ? 'border-brand-400/30 bg-brand-500/10 text-brand-300'
                    : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
            }`}
            role="status"
          >
            <StatusDot
              ok={!healthLoading && !offline && allOk}
            />
            {healthLoading ? 'Memeriksa…' : offline ? 'Offline' : allOk ? 'Siap' : 'Periksa dependensi'}
          </span>

          <button
            type="button"
            onClick={onOpenCache}
            className="btn-secondary !min-h-[40px] !px-3 !py-2 text-xs sm:text-sm"
            aria-label="Bersihkan cache data lokal"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Bersihkan Cache</span>
            <span className="sm:hidden">Cache</span>
          </button>
        </div>
      </div>
    </header>
  )
}
