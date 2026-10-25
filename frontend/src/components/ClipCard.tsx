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

  return (
    <article
      className={`card group overflow-hidden transition-colors ${
        selected ? 'border-brand-400/60 ring-1 ring-brand-400/40' : 'hover:border-white/20'
      }`}
    >
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
          />
        ) : (
          <>
            {thumb ? (
              <img
                src={thumb}
                alt={`Pratinjau klip ${clip.index + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-slate-600">
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
                aria-label={`Putar klip ${clip.index + 1}`}
                className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/70 via-black/10 to-black/30 transition-colors hover:bg-black/40"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink-950 shadow-lg transition-transform group-hover:scale-105">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor">
                    <path d="M8 5v14l11-7L8 5Z" />
                  </svg>
                </span>
              </button>
            )}
          </>
        )}

        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">
          {formatDuration(clip.duration)}
        </span>

        <span
          className={`pointer-events-none absolute left-2 top-2 chip backdrop-blur ${scoreTone(clip.score)}`}
          title="Skor momen berbasis aturan (0–100)"
        >
          {clip.score}
        </span>

        <label
          className="absolute right-2 top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-black/60 backdrop-blur transition-colors hover:bg-black/80"
          title={selected ? 'Batalkan pilihan' : 'Pilih klip ini'}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(clip.id)}
            aria-label={`Pilih klip ${clip.index + 1}`}
            className="h-4 w-4 rounded border-white/30 bg-transparent accent-brand-500"
          />
        </label>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1">
          {primary && (
            <span className="chip border-accent-400/40 bg-accent-500/15 text-accent-400">
              {labelName(primary)}
            </span>
          )}
          {clip.labels.slice(1, 3).map((l) => (
            <span key={l} className="chip border-white/10 bg-white/5 text-slate-400">
              {labelName(l)}
            </span>
          ))}
        </div>

        <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">
          {clip.assets?.hook || clip.transcript || 'Tanpa transkrip.'}
        </p>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums">
            {formatDuration(clip.start)} – {formatDuration(clip.end)}
          </span>
          {clip.face_coverage > 0 && <span>wajah {Math.round(clip.face_coverage * 100)}%</span>}
        </div>
      </div>
    </article>
  )
}
