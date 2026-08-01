import { useMemo, useState } from 'react'
import ClipCard from './ClipCard'
import type { Clip, MomentLabel } from '../types'

interface Props {
  clips: Clip[]
  labels: MomentLabel[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onConfirm: () => void
  confirming: boolean
}

type SortKey = 'score-desc' | 'score-asc' | 'duration-desc' | 'duration-asc' | 'index'

export default function ClipGrid({
  clips,
  labels,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  onConfirm,
  confirming,
}: Props) {
  const [sort, setSort] = useState<SortKey>('score-desc')
  const [filterLabel, setFilterLabel] = useState<string>('')

  const availableLabels = useMemo(() => {
    const keys = new Set<string>()
    for (const c of clips) for (const l of c.labels) keys.add(l)
    return labels.filter((l) => keys.has(l.key))
  }, [clips, labels])

  const visible = useMemo(() => {
    let list = [...clips]
    if (filterLabel) {
      list = list.filter((c) => c.labels.includes(filterLabel))
    }
    list.sort((a, b) => {
      switch (sort) {
        case 'score-asc':
          return a.score - b.score
        case 'duration-desc':
          return b.duration - a.duration
        case 'duration-asc':
          return a.duration - b.duration
        case 'index':
          return a.index - b.index
        case 'score-desc':
        default:
          return b.score - a.score
      }
    })
    return list
  }, [clips, sort, filterLabel])

  const allSelected = clips.length > 0 && selected.size === clips.length
  const canConfirm = selected.size > 0 && !confirming
  const disabledReason =
    selected.size === 0
      ? 'Pilih minimal satu klip untuk membuat aset publikasi'
      : confirming
        ? 'Sedang menyiapkan aset…'
        : null

  return (
    <section className="animate-fade-up space-y-4" aria-labelledby="clips-title">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="clips-title" className="section-title">
            {clips.length} klip siap ditinjau
          </h2>
          <p className="section-sub">
            Putar pratinjau, pilih klip terbaik, lalu buat judul, deskripsi, hashtag, dan thumbnail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="clip-sort">
            Urutkan klip
          </label>
          <select
            id="clip-sort"
            className="field !min-h-[40px] w-auto !py-2 text-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="score-desc">Skor tertinggi</option>
            <option value="score-asc">Skor terendah</option>
            <option value="duration-desc">Durasi terpanjang</option>
            <option value="duration-asc">Durasi terpendek</option>
            <option value="index">Urutan asli</option>
          </select>

          {availableLabels.length > 0 && (
            <>
              <label className="sr-only" htmlFor="clip-filter">
                Filter momen
              </label>
              <select
                id="clip-filter"
                className="field !min-h-[40px] w-auto !py-2 text-xs"
                value={filterLabel}
                onChange={(e) => setFilterLabel(e.target.value)}
              >
                <option value="">Semua momen</option>
                {availableLabels.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            type="button"
            onClick={allSelected ? onClearAll : onSelectAll}
            className="btn-secondary !min-h-[40px] !px-3 !py-2 text-xs"
          >
            {allSelected ? 'Kosongkan pilihan' : 'Pilih semua'}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-300">Tidak ada klip yang cocok dengan filter ini.</p>
          <button
            type="button"
            onClick={() => setFilterLabel('')}
            className="btn-ghost mt-3 text-sm"
          >
            Hapus filter
          </button>
        </div>
      ) : (
        <div className="scroll-slim grid max-h-[min(75vh,56rem)] grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-0.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              labels={labels}
              selected={selected.has(clip.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/[0.08] bg-ink-950/95 px-4 py-3.5 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:shadow-panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-200">
              <span className="font-bold tabular-nums text-brand-400">{selected.size}</span>
              <span className="text-slate-400"> dari </span>
              <span className="font-semibold tabular-nums">{clips.length}</span>
              <span className="text-slate-400"> klip dipilih</span>
            </p>
            {disabledReason && (
              <p className="mt-0.5 text-xs text-slate-500" id="confirm-hint">
                {disabledReason}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            aria-describedby={!canConfirm ? 'confirm-hint' : undefined}
            className="btn-primary w-full sm:w-auto sm:min-w-[14rem]"
          >
            {confirming ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                </svg>
                Menyiapkan aset…
              </>
            ) : (
              'Buat Aset untuk Klip Terpilih'
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
