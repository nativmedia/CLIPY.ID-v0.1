import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!open) return
    setError(null)
    setSize(null)
    api.cacheSize().then(setSize, () => setError('Gagal membaca ukuran cache.'))

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
      aria-labelledby="cache-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md p-5">
        <h2 id="cache-title" className="text-base font-bold text-white">
          Bersihkan Cache
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Menghapus video sumber yang diunduh, klip hasil render, thumbnail, dan file sementara di folder data aplikasi.
          Tindakan ini tidak bisa dibatalkan.
        </p>

        <dl className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-ink-950/50 p-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-slate-400">Video unduhan</dt>
            <dd className="tabular-nums text-slate-200">{size ? formatBytes(size.downloads_bytes) : '…'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Klip &amp; aset</dt>
            <dd className="tabular-nums text-slate-200">{size ? formatBytes(size.jobs_bytes) : '…'}</dd>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-1.5 font-semibold">
            <dt className="text-slate-200">Total</dt>
            <dd className="tabular-nums text-brand-400">{size ? formatBytes(size.total_bytes) : '…'}</dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Batal
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={busy || (size?.total_bytes ?? 0) === 0}
            className="btn-danger flex-1"
          >
            {busy ? 'Membersihkan…' : 'Hapus Sekarang'}
          </button>
        </div>
      </div>
    </div>
  )
}
