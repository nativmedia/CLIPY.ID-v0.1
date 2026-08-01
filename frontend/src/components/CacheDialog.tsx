import { useEffect, useId, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import { formatBytes } from '../lib/format'
import type { CacheSize } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onCleared: () => void
}

export default function CacheDialog({ open, onClose, onCleared }: Props) {
  const [size, setSize] = useState<CacheSize | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const descId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSize(null)
    api.cacheSize().then(setSize, () => setError('Gagal membaca ukuran cache.'))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Focus primary dismiss control for keyboard users
    window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const empty = size !== null && size.total_bytes === 0

  const clear = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.clearCache()
      onCleared()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membersihkan cache.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md p-5 sm:p-6 animate-fade-up">
        <h2 id={titleId} className="text-lg font-bold text-white">
          Bersihkan Cache
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-slate-400">
          Menghapus video sumber yang diunduh, klip hasil render, thumbnail, dan file sementara di folder data
          aplikasi. Tindakan ini tidak bisa dibatalkan.
        </p>

        <dl className="mt-5 space-y-2 rounded-xl border border-white/[0.08] bg-ink-950/50 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Video unduhan</dt>
            <dd className="tabular-nums text-slate-200">{size ? formatBytes(size.downloads_bytes) : '…'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Klip &amp; aset</dt>
            <dd className="tabular-nums text-slate-200">{size ? formatBytes(size.jobs_bytes) : '…'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold">
            <dt className="text-slate-100">Total</dt>
            <dd className="tabular-nums text-brand-400">{size ? formatBytes(size.total_bytes) : '…'}</dd>
          </div>
        </dl>

        {empty && (
          <p className="mt-3 text-sm text-slate-400" role="status">
            Cache sudah kosong. Tidak ada yang perlu dihapus.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button ref={closeRef} type="button" onClick={onClose} className="btn-secondary flex-1">
            Batal
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={busy || empty || size === null}
            className="btn-danger flex-1"
            title={empty ? 'Cache sudah kosong' : undefined}
          >
            {busy ? 'Membersihkan…' : 'Hapus Sekarang'}
          </button>
        </div>
      </div>
    </div>
  )
}
