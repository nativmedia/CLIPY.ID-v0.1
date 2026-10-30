import type { Health } from '../types'

export default function Header({ health, onOpenCache }: { health: Health | null; onOpenCache: () => void }) {
  const ready = health && health.ffmpeg && health.ffprobe && health.yt_dlp && health.faster_whisper && health.opencv && health.numpy
  return <header className="topbar">
    <a className="wordmark" href="#studio" aria-label="CLIPY.ID studio"><img src="/clipy.svg" alt="" width="32" height="32" /><span>CLIPY.ID</span><span className="version">v0.2</span></a>
    <div className="topbar-actions">
      <span className="system-status" role="status"><span className={ready ? 'status-dot' : 'status-dot pending'} />{!health ? 'Server belum tersambung' : ready ? 'Sistem siap' : 'Periksa komponen'}</span>
      <button type="button" onClick={onOpenCache} className="btn-ghost" aria-label="Kelola penyimpanan lokal"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></svg><span className="storage-label">Penyimpanan</span></button>
    </div>
  </header>
}
