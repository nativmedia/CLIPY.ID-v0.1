import { useState } from 'react'

interface Props {
  onSubmit: (url: string) => void
  busy: boolean
  disabled: boolean
}

// Mirrors the backend's accepted YouTube shapes (watch / youtu.be / shorts / embed / live).
const YT = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|live\/)[\w-]+|youtu\.be\/[\w-]+)/i

export default function UrlForm({ onSubmit, busy, disabled }: Props) {
  const [url, setUrl] = useState('')
  const [touched, setTouched] = useState(false)

  const trimmed = url.trim()
  const invalid = touched && trimmed.length > 0 && !YT.test(trimmed)
  const canSubmit = trimmed.length > 0 && !invalid && !busy && !disabled

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!YT.test(trimmed)) return
        onSubmit(trimmed)
      }}
      className="card p-4 sm:p-5"
    >
      <label htmlFor="yt-url" className="label mb-2">
        URL YouTube
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <input
            id="yt-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="https://www.youtube.com/watch?v=..."
            aria-invalid={invalid}
            aria-describedby={invalid ? 'yt-url-error' : undefined}
            className={`field pr-10 ${invalid ? 'border-rose-500/60' : ''}`}
            disabled={busy || disabled}
          />
          {trimmed.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setUrl('')
                setTouched(false)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-200"
              aria-label="Kosongkan URL"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <button type="submit" disabled={!canSubmit} className="btn-primary sm:w-44">
          {busy ? (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
              </svg>
              Memproses…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Buat Klip
            </>
          )}
        </button>
      </div>

      {invalid && (
        <p id="yt-url-error" role="alert" className="mt-2 text-xs text-rose-300">
          Format URL YouTube tidak dikenal. Contoh: https://www.youtube.com/watch?v=abc123
        </p>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
        <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
        </svg>
        Proses hanya video yang Anda miliki haknya, konten sendiri, atau dengan izin pemilik. Semua pemrosesan
        berjalan lokal di komputer ini.
      </p>
    </form>
  )
}
