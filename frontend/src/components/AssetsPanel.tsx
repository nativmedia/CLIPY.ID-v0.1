import { useState } from 'react'
import { mediaUrl } from '../api'
import { copyText, formatDuration } from '../lib/format'
import { PLATFORM_NAMES, type Clip } from '../types'

interface Props {
  clips: Clip[]
}

function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          window.setTimeout(() => setDone(false), 1600)
        }
      }}
      className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-[10.5px] font-medium text-slate-300 transition-colors hover:bg-white/5"
    >
      {done ? 'Tersalin ✓' : label}
    </button>
  )
}

function Row({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="label">{title}</span>
        <CopyButton text={value} />
      </div>
      <p className="whitespace-pre-wrap rounded-xl border border-white/10 bg-ink-950/50 p-2.5 text-[11.5px] leading-relaxed text-slate-300">
        {value}
      </p>
    </div>
  )
}

function AssetBlock({ clip }: { clip: Clip }) {
  const a = clip.assets
  if (!a) return null
  const thumb = mediaUrl(a.thumbnail_url ?? clip.thumbnail_url)
  const video = mediaUrl(clip.video_url)

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {thumb && (
          <div className="sm:w-36 sm:shrink-0">
            <img
              src={thumb}
              alt={`Thumbnail rekomendasi klip ${clip.index + 1}`}
              loading="lazy"
              className="aspect-[9/16] w-full rounded-xl border border-white/10 object-cover"
            />
            <p className="mt-1.5 text-center text-[10px] text-slate-500">Rekomendasi thumbnail</p>
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-white/10 bg-white/5 text-slate-300">Klip {clip.index + 1}</span>
            <span className="chip border-brand-400/40 bg-brand-500/15 text-brand-400">Skor {clip.score}</span>
            <span className="text-[11px] tabular-nums text-slate-500">
              {formatDuration(clip.start)} – {formatDuration(clip.end)} · {formatDuration(clip.duration)}
            </span>
            {video && (
              <a
                href={video}
                download
                className="ml-auto rounded-lg border border-brand-400/40 bg-brand-500/10 px-2.5 py-1 text-[10.5px] font-semibold text-brand-400 hover:bg-brand-500/20"
              >
                Unduh MP4
              </a>
            )}
          </div>

          <Row title={`Judul (${a.title.length}/100)`} value={a.title} />
          <Row title="Hook" value={a.hook} />
          <Row title={`Deskripsi SEO (${a.description.length}/5000)`} value={a.description} />

          {a.hashtags.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="label">Hashtag ({a.hashtags.length})</span>
                <CopyButton text={a.hashtags.join(' ')} />
              </div>
              <div className="flex flex-wrap gap-1">
                {a.hashtags.map((h) => (
                  <span key={h} className="chip border-accent-400/30 bg-accent-500/10 text-accent-400">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {a.keywords.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="label">Keyword SEO ({a.keywords.length})</span>
                <CopyButton text={a.keywords.join(', ')} />
              </div>
              <p className="text-[11.5px] text-slate-400">{a.keywords.join(' · ')}</p>
            </div>
          )}

          {Object.keys(a.platform_tags).length > 0 && (
            <div>
              <span className="label mb-1.5">Tag per platform</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(a.platform_tags).map(([platform, tags]) => (
                  <div key={platform} className="rounded-xl border border-white/10 bg-ink-950/40 p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-200">
                        {PLATFORM_NAMES[platform] ?? platform}
                      </span>
                      <CopyButton text={tags.join(', ')} />
                    </div>
                    <p className="text-[10.5px] leading-relaxed text-slate-400">{tags.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AssetsPanel({ clips }: Props) {
  const withAssets = clips.filter((c) => c.assets)
  if (withAssets.length === 0) return null

  return (
    <section className="animate-fade-up space-y-3">
      <div>
        <h2 className="text-sm font-bold text-white">Aset pendukung ({withAssets.length})</h2>
        <p className="text-[11px] text-slate-400">
          Judul, hook, deskripsi SEO, hashtag, tag per platform, dan rekomendasi thumbnail — siap dipakai unggah manual.
        </p>
      </div>
      <div className="space-y-3">
        {withAssets.map((c) => (
          <AssetBlock key={c.id} clip={c} />
        ))}
      </div>
    </section>
  )
}
