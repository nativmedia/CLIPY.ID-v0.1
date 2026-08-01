import type { Health } from '../types'

interface Props {
  health: Health | null
  onOpenCache: () => void
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-brand-400' : 'bg-rose-400'}`}
      aria-hidden="true"
    />
  )
}

export default function Header({ health, onOpenCache }: Props) {
  const deps: Array<[string, boolean]> = health
    ? [
        ['ffmpeg', health.ffmpeg && health.ffprobe],
        ['yt-dlp', health.yt_dlp],
        ['whisper', health.faster_whisper],
        ['opencv', health.opencv],
      ]
    : []

  const allOk = deps.length > 0 && deps.every(([, ok]) => ok)

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-400 shadow-lg shadow-brand-500/15">
            <img src="./klipersid.svg" alt="" className="h-5.5 w-5.5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-white">klipersid</h1>
            <p className="text-[11px] text-slate-400">Video panjang → shorts 9:16, sepenuhnya lokal</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="hidden items-center gap-3 rounded-xl border border-white/10 bg-ink-900/60 px-3 py-1.5 md:flex"
            title={allOk ? 'Semua dependensi siap' : 'Sebagian dependensi belum siap'}
          >
            {deps.map(([name, ok]) => (
              <span key={name} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <Dot ok={ok} />
                {name}
              </span>
            ))}
            {!health && <span className="text-[11px] text-slate-500">memeriksa…</span>}
          </div>

          <span
            className={`chip md:hidden ${
              allOk ? 'border-brand-400/30 bg-brand-500/10 text-brand-400' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {health ? (allOk ? 'siap' : 'periksa dependensi') : '…'}
          </span>

          <button type="button" onClick={onOpenCache} className="btn-ghost !px-3 !py-2 text-xs">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Bersihkan Cache</span>
          </button>
        </div>
      </div>
    </header>
  )
}
