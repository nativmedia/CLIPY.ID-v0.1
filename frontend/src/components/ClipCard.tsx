import { useRef, useState } from 'react'
import { mediaUrl } from '../api'
import { formatDuration, scoreTone } from '../lib/format'
import type { Clip, MomentLabel } from '../types'

interface Props {
  clip: Clip
  labels: MomentLabel[]
  selected: boolean
  onToggle: (id: string) => void
}

export default function ClipCard({ clip, labels, selected, onToggle }: Props) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const labelName = (key: string) => labels.find((l) => l.key === key)?.name ?? key
  const primary = clip.labels[0]
  const video = mediaUrl(clip.video_url)
  const thumb = mediaUrl(clip.assets?.thumbnail_url ?? clip.thumbnail_url)
  const clipNo = clip.index + 1

  return (
    <article
      className={`card group relative overflow-hidden transition-[box-shadow,border-color,background-color] duration-200 ${
        selected
          ? 'border-brand-400/55 bg-brand-500/[0.06] shadow-lift ring-2 ring-brand-400/35'
          : 'hover:border-white/15'
      }`}
    >
      {/* Selected ribbon */}
      {selected && (
        <div
          className="absolute left-0 top-0 z-10 h-full w-1 bg-brand-400"
          aria-hidden="true"
        />
      )}

      <div className="relative aspect-[9/16] bg-ink-950">
        {playing && video ? (
          <video
            ref={videoRef}
            src={video}
            controls
            autoPlay
            playsInline
            onEnded={() => setPlaying(false)}
            className="h-full w-full object-contain"
            aria-label={`Pemutar klip ${clipNo}`}
          />
        ) : (
          <>
            {thumb ? (
              <img
                src={thumb}
                alt={`Pratinjau klip ${clipNo}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-slate-600" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="m8 12 4-3v6l-4-3Z" />
                </svg>
              </div>
            )}

            {video && (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`Putar klip ${clipNo}`}
                className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/75 via-black/15 to-black/35 transition-colors hover:bg-black/45 focus-visible:bg-black/45"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink-950 shadow-lg transition-transform group-hover:scale-105">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7L8 5Z" />
                  </svg>
                </span>
              </button>
            )}
          </>
        )}

        {/* Clip number */}
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">
          Klip {clipNo}
        </span>

        {/* Duration */}
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {formatDuration(clip.duration)}
        </span>

        {/* Score 0–100 */}
        <span
          className={`pointer-events-none absolute left-2 top-2 chip backdrop-blur-sm ${scoreTone(clip.score)}`}
          title="Skor potensi (0–100)"
        >
          <span className="sr-only">Skor </span>
          {Math.round(clip.score)}
          <span className="opacity-70">/100</span>
        </span>

        {/* Selection control — large touch target */}
        <label
          className={`absolute right-2 top-2 grid h-10 w-10 cursor-pointer place-items-center rounded-xl border transition-colors ${
            selected
              ? 'border-brand-400/50 bg-brand-500 text-ink-950 shadow-md'
              : 'border-white/20 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75'
          }`}
          title={selected ? 'Batalkan pilihan' : 'Pilih klip ini'}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(clip.id)}
            aria-label={`Pilih klip ${clipNo}${selected ? ', terpilih' : ''}`}
            className="sr-only"
          />
          {selected ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="h-4 w-4 rounded border-2 border-white/50" aria-hidden="true" />
          )}
        </label>
      </div>

      <div className="space-y-2.5 p-3.5">
        <div className="flex flex-wrap gap-1.5">
          {primary ? (
            <span className="chip border-accent-400/35 bg-accent-500/12 text-accent-300">
              {labelName(primary)}
            </span>
          ) : (
            <span className="chip border-white/10 bg-white/5 text-slate-500">Tanpa label</span>
          )}
          {clip.labels.slice(1, 3).map((l) => (
            <span key={l} className="chip border-white/10 bg-white/5 text-slate-400">
              {labelName(l)}
            </span>
          ))}
        </div>

        <p className="line-clamp-3 text-sm leading-relaxed text-slate-400">
          {clip.assets?.hook || clip.transcript || 'Transkrip tidak tersedia untuk klip ini.'}
        </p>

        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="tabular-nums">
            {formatDuration(clip.start)} – {formatDuration(clip.end)}
          </span>
          {clip.face_coverage > 0 && (
            <span title="Estimasi cakupan wajah di frame">
              wajah {Math.round(clip.face_coverage * 100)}%
            </span>
          )}
        </div>

        {selected && (
          <p className="text-xs font-medium text-brand-300" aria-live="polite">
            Dipilih untuk aset publikasi
          </p>
        )}
      </div>
    </article>
  )
}
