import { useState } from 'react'
import { mediaUrl } from '../api'
import { copyText, formatDuration } from '../lib/format'
import { PLATFORM_NAMES, type Clip } from '../types'

interface Props {
  clips: Clip[]
}

function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!text.trim()) return null

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text)
        if (ok) {
          setDone(true)
          setFailed(false)
          window.setTimeout(() => setDone(false), 1600)
        } else {
          setFailed(true)
          window.setTimeout(() => setFailed(false), 2000)
        }
      }}
      className="min-h-[36px] shrink-0 rounded-lg border border-white/12 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
      aria-live="polite"
    >
      {done ? 'Tersalin ✓' : failed ? 'Gagal salin' : label}
    </button>
  )
}

function FieldBlock({ title, value, multiline = false }: { title: string; value: string; multiline?: boolean }) {
  if (!value?.trim()) return null
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="label text-slate-300">{title}</h4>
        <CopyButton text={value} />
      </div>
      <p
        className={`rounded-xl border border-white/[0.07] bg-ink-950/55 p-3 text-sm leading-relaxed text-slate-200 ${
          multiline ? 'whitespace-pre-wrap' : ''
        }`}
      >
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
  const clipNo = clip.index + 1

  return (
    <article className="card p-4 sm:p-5" aria-labelledby={`asset-clip-${clip.id}`}>
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Thumbnail recommendation — visual hierarchy first */}
        <div className="mx-auto w-full max-w-[9.5rem] shrink-0 sm:mx-0">
          {thumb ? (
            <img
              src={thumb}
              alt={`Rekomendasi thumbnail klip ${clipNo}`}
              loading="lazy"
              className="aspect-[9/16] w-full rounded-xl border border-white/10 object-cover shadow-lift"
            />
          ) : (
            <div className="grid aspect-[9/16] w-full place-items-center rounded-xl border border-white/10 bg-ink-850 text-xs text-slate-500">
              Thumbnail tidak tersedia
            </div>
          )}
          <p className="mt-2 text-center text-xs text-slate-500">Rekomendasi thumbnail</p>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <header className="flex flex-wrap items-center gap-2">
            <h3 id={`asset-clip-${clip.id}`} className="text-base font-bold text-white">
              Klip {clipNo}
            </h3>
            <span className="chip border-brand-400/35 bg-brand-500/12 text-brand-300">
              Skor {Math.round(clip.score)}
            </span>
            <span className="text-xs tabular-nums text-slate-500">
              {formatDuration(clip.start)} – {formatDuration(clip.end)} · {formatDuration(clip.duration)}
            </span>
            {video && (
              <a
                href={video}
                download
                className="btn-primary ml-auto !min-h-[36px] !px-3 !py-1.5 text-xs"
              >
                Unduh MP4
              </a>
            )}
          </header>

          <FieldBlock title={`Judul (${a.title.length}/100)`} value={a.title} />
          <FieldBlock title="Hook pembuka" value={a.hook} />
          <FieldBlock title={`Deskripsi SEO (${a.description.length}/5000)`} value={a.description} multiline />

          {a.hashtags.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h4 className="label text-slate-300">Hashtag ({a.hashtags.length})</h4>
                <CopyButton text={a.hashtags.join(' ')} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.hashtags.map((h) => (
                  <span key={h} className="chip border-accent-400/30 bg-accent-500/10 text-accent-300">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {a.keywords.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h4 className="label text-slate-300">Keyword SEO ({a.keywords.length})</h4>
                <CopyButton text={a.keywords.join(', ')} />
              </div>
              <p className="text-sm leading-relaxed text-slate-400">{a.keywords.join(' · ')}</p>
            </div>
          )}

          {a.tags.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h4 className="label text-slate-300">Tag ({a.tags.length})</h4>
                <CopyButton text={a.tags.join(', ')} />
              </div>
              <p className="text-sm leading-relaxed text-slate-400">{a.tags.join(', ')}</p>
            </div>
          )}

          {Object.keys(a.platform_tags).length > 0 && (
            <div>
              <h4 className="label mb-2 text-slate-300">Tag per platform</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(a.platform_tags).map(([platform, tags]) => (
                  <div key={platform} className="card-soft p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-200">
                        {PLATFORM_NAMES[platform] ?? platform}
                      </span>
                      {tags.length > 0 && <CopyButton text={tags.join(', ')} />}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {tags.length > 0 ? tags.join(', ') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default function AssetsPanel({ clips }: Props) {
  const withAssets = clips.filter((c) => c.assets)
  if (withAssets.length === 0) return null

  return (
    <section className="animate-fade-up space-y-4" aria-labelledby="assets-title">
      <div>
        <h2 id="assets-title" className="section-title">
          Aset publikasi ({withAssets.length})
        </h2>
        <p className="section-sub">
          Judul, hook, deskripsi SEO, hashtag, tag platform, dan thumbnail — siap disalin untuk unggah manual.
        </p>
      </div>
      <div className="space-y-4">
        {withAssets.map((c) => (
          <AssetBlock key={c.id} clip={c} />
        ))}
      </div>
    </section>
  )
}
