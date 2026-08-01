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
  const allSelected = clips.length > 0 && selected.size === clips.length

  return (
    <section className="animate-fade-up space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white">
            {clips.length} klip siap ditinjau
          </h2>
          <p className="text-[11px] text-slate-400">
            Centang klip yang ingin dilanjutkan, lalu konfirmasi untuk membuat judul, deskripsi, hashtag, dan thumbnail.
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? onClearAll : onSelectAll}
            className="btn-ghost !px-3 !py-2 text-xs"
          >
            {allSelected ? 'Kosongkan' : 'Pilih semua'}
          </button>
        </div>
      </div>

      <div className="scroll-slim grid max-h-[75vh] grid-cols-2 gap-3 overflow-y-auto pr-1 lg:grid-cols-3 xl:grid-cols-4">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            labels={labels}
            selected={selected.has(clip.id)}
            onToggle={onToggle}
          />
        ))}
      </div>

      {/* Sticky action bar so the confirm button is always reachable on mobile. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/10 bg-ink-950/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-300">
            <span className="font-bold text-brand-400">{selected.size}</span> dari {clips.length} klip dipilih
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selected.size === 0 || confirming}
            className="btn-primary ml-auto"
          >
            {confirming ? (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                </svg>
                Menyiapkan aset…
              </>
            ) : (
              'Konfirmasi Pilihan'
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
