import { useState, useEffect } from 'react'

interface Props {
  onSubmit: (url: string) => void
  busy: boolean
  disabled: boolean
}

function validYoutubeUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) return false
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null
    return /^[\w-]{11}$/.test(id || '')
  } catch { return false }
}

export default function UrlForm({ onSubmit, busy, disabled }: Props) {
  const [connected,setConnected]=useState(false)
  const [connecting,setConnecting]=useState(false)
  const [sessionError,setSessionError]=useState('')
  useEffect(()=>{fetch('/api/youtube-session').then(r=>r.json()).then(s=>setConnected(s.connected)).catch(()=>{})},[])
  async function connect() {
    setConnecting(true);setSessionError('')
    try {
      const r=await fetch('/api/youtube-session',{method:connected?'DELETE':'POST'})
      const data=await r.json()
      if(!r.ok)throw new Error(data.detail||'Sesi belum tersambung.')
      setConnected(data.connected)
    }catch(e){setSessionError((e as Error).message)}finally{setConnecting(false)}
  }
  async function importSession(file?:File) {
    if(!file)return
    setConnecting(true);setSessionError('')
    try {
      if(file.size>262144)throw new Error('Ukuran file sesi maksimal 256 KB.')
      const response=await fetch('/api/youtube-session/import',{method:'POST',headers:{'Content-Type':'text/plain'},body:await file.text()})
      const data=await response.json()
      if(!response.ok)throw new Error(data.detail||'Impor sesi gagal.')
      setConnected(data.connected)
    }catch(e){setSessionError((e as Error).message)}finally{setConnecting(false)}
  }
  const [url, setUrl] = useState('')
  const [touched, setTouched] = useState(false)

  const trimmed = url.trim()
  const invalid = touched && trimmed.length > 0 && !validYoutubeUrl(trimmed)
  const canSubmit = validYoutubeUrl(trimmed) && !busy && !disabled

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!canSubmit) return
        onSubmit(trimmed)
      }}
      className="card source-form"
    >
      <div className="panel-heading"><h2><span className="source-number">1</span>Sumber video</h2><span className="small-tag">YouTube</span></div>
      <label htmlFor="yt-url" className="label mb-2">
        URL YouTube
      </label>
      <div className="url-row">
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
            aria-describedby={invalid ? 'yt-url-error' : 'source-hint'}
            className={`field pr-10 ${invalid ? 'border-slate-500/60' : ''}`}
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
              Buat klip
            </>
          )}
        </button>
      </div>

      {invalid && (
        <p id="yt-url-error" role="alert" className="mt-2 text-xs text-slate-300">
          Format URL YouTube tidak dikenal. Gunakan tautan watch, youtu.be, Shorts, atau live dengan ID video lengkap.
        </p>
      )}

      <p id="source-hint" className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
        <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
        </svg>
        Proses hanya video yang Anda miliki haknya, konten sendiri, atau dengan izin pemilik. Semua pemrosesan
        berjalan lokal di komputer ini.
      </p>
      <details className="session-options"><summary>Sesi YouTube (opsional)</summary><div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-sm">YouTube · {connected?'Sesi tersedia':'Tanpa sesi akun'}</strong><button type="button" className="btn-secondary" disabled={connecting||busy||disabled} onClick={connect}>{connecting?'Menyambungkan…':connected?'Putuskan sesi':'Sambungkan Chrome'}</button></div>
        <p className="mt-2 text-xs text-slate-400">Tombol ini mengizinkan pembacaan cookie YouTube dari profil Chrome utama secara lokal. Sesi disimpan sementara di memori dan hilang saat server ditutup. Sambungan tidak menjamin YouTube menerima unduhan.</p>
        <details className="mt-3 text-sm"><summary className="cursor-pointer">Chrome tidak dapat tersambung?</summary>
          <p className="my-2 text-xs text-slate-400">Jika enkripsi Windows menghalangi pembacaan Chrome, pilih file sesi YouTube yang Anda ekspor sendiri dalam format Netscape. Pilih hanya cookie youtube.com. File ini memberi akses sesi akun; jangan bagikan melalui chat.</p>
          <label className="label">Impor sesi YouTube<input type="file" accept=".txt" className="field mt-2" disabled={busy||connecting||disabled} onChange={e=>{void importSession(e.target.files?.[0]);e.target.value=''}}/></label>
          <p className="mt-2 text-xs text-slate-400">Sesi diproses di memori server lokal dan dapat dihapus dengan Putuskan sesi.</p>
        </details>
        {sessionError&&<p role="alert" className="mt-2 text-sm text-slate-300">{sessionError}</p>}
      </div></details>
    </form>
  )
}
