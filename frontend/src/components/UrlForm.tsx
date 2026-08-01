import { useId, useState } from 'react'

interface Props {
  onSubmit: (url: string) => void
  busy: boolean
  disabled: boolean
  disabledReason?: string | null
}

// Mirrors the backend's accepted YouTube shapes (watch / youtu.be / shorts / embed / live).
const YT =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|live\/)[\w-]+|youtu\.be\/[\w-]+)/i

const EXAMPLE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

export default function UrlForm({ onSubmit, busy, disabled, disabledReason }: Props) {
  const [url, setUrl] = useState('')
  const [touched, setTouched] = useState(false)
  const errorId = useId()
  const helpId = useId()

  const trimmed = url.trim()
  const emptyAfterTouch = touched && trimmed.length === 0
  const invalidFormat = trimmed.length > 0 && !YT.test(trimmed)
  const showError = emptyAfterTouch || (touched && invalidFormat)
  const canSubmit = trimmed.length > 0 && !invalidFormat && !busy && !disabled

  let errorMessage: string | null = null
  if (emptyAfterTouch) {
    errorMessage = 'Masukkan URL YouTube terlebih dahulu.'
  } else if (touched && invalidFormat) {
    errorMessage =
      'Format URL tidak dikenali. Gunakan tautan watch, youtu.be, Shorts, embed, atau live. Contoh: https://www.youtube.com/watch?v=abc123'
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!trimmed || !YT.test(trimmed)) return
        onSubmit(trimmed)
      }}
      className="card p-5 sm:p-6"
      noValidate
    >
      <div className="mb-4">
        <h2 className="section-title">Mulai dari satu URL YouTube</h2>
        <p className="section-sub max-w-2xl">
          Tempel tautan video. klipersid akan mengunduh, mentranskrip, menemukan momen terbaik, lalu merender
          beberapa klip vertikal 9:16 bersubtitle — semuanya di komputer Anda.
        </p>
      </div>

      <label htmlFor="yt-url" className="label mb-2">
        URL YouTube
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
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
            aria-invalid={showError}
            aria-describedby={[showError ? errorId : null, helpId].filter(Boolean).join(' ') || undefined}
            className={`field pr-11 text-[15px] sm:text-sm ${showError ? 'field-error' : ''}`}
            disabled={busy || disabled}
          />
          {trimmed.length > 0 && !busy && (
            <button
              type="button"
              onClick={() => {
                setUrl('')
                setTouched(false)
              }}
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-200"
              aria-label="Kosongkan URL"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary w-full shrink-0 sm:w-auto sm:min-w-[11.5rem]"
          title={
            disabled && disabledReason
              ? disabledReason
              : !trimmed
                ? 'Masukkan URL YouTube'
                : invalidFormat
                  ? 'Perbaiki format URL'
                  : undefined
          }
        >
          {busy ? (
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
              Memulai…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Buat Klip
            </>
          )}
        </button>
      </div>

      {showError && errorMessage && (
        <p id={errorId} role="alert" className="mt-2.5 text-sm text-rose-300">
          {errorMessage}
        </p>
      )}

      {disabled && disabledReason && !busy && (
        <p className="mt-2.5 text-sm text-amber-200/90" role="status">
          {disabledReason}
        </p>
      )}

      <div id={helpId} className="mt-4 space-y-2">
        <p className="helper">
          Contoh:{' '}
          <button
            type="button"
            className="font-medium text-slate-400 underline decoration-white/15 underline-offset-2 hover:text-brand-300"
            onClick={() => {
              setUrl(EXAMPLE)
              setTouched(true)
            }}
            disabled={busy || disabled}
          >
            youtube.com/watch?v=…
          </button>
          {' · '}
          youtu.be/… · Shorts · live
        </p>

        <ol className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
          <li className="card-soft flex gap-2 px-3 py-2.5">
            <span className="font-semibold text-brand-400" aria-hidden="true">
              1
            </span>
            <span>Unduh &amp; transkrip lokal</span>
          </li>
          <li className="card-soft flex gap-2 px-3 py-2.5">
            <span className="font-semibold text-brand-400" aria-hidden="true">
              2
            </span>
            <span>Deteksi momen terbaik</span>
          </li>
          <li className="card-soft flex gap-2 px-3 py-2.5">
            <span className="font-semibold text-brand-400" aria-hidden="true">
              3
            </span>
            <span>Render klip 9:16 + subtitle</span>
          </li>
        </ol>

        <p className="flex items-start gap-1.5 pt-1 text-xs leading-relaxed text-slate-500">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
          </svg>
          Proses hanya video yang Anda miliki haknya. Tidak ada unggahan ke layanan pihak ketiga setelah unduhan.
        </p>
      </div>
    </form>
  )
}
