"""YouTube download via yt-dlp (Python API, with CLI fallback)."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable

from ..models import SourceInfo

ProgressCb = Callable[[float, str], None]
_SESSION_JAR = None

def connect_chrome():
    """Load consented YouTube cookies into memory only."""
    global _SESSION_JAR
    from yt_dlp import YoutubeDL
    from yt_dlp.cookies import YoutubeDLCookieJar
    class QuietLogger:
        def debug(self, msg): pass
        def warning(self, msg): pass
        def error(self, msg): pass
    try:
        with YoutubeDL({'cookiesfrombrowser': ('chrome',), 'quiet': True, 'logger': QuietLogger()}) as ydl:
            jar = YoutubeDLCookieJar()
            for cookie in ydl.cookiejar:
                domain = cookie.domain.lstrip('.')
                if domain == 'youtube.com' or domain.endswith('.youtube.com'):
                    jar.set_cookie(cookie)
            if not len(jar):
                raise RuntimeError('Sesi YouTube tidak ditemukan di profil Chrome utama. Buka YouTube dan masuk di profil tersebut.')
        _SESSION_JAR = jar
        return {'connected': True}
    except Exception as exc:
        text = str(exc).lower()
        if 'copy' in text or 'permission' in text:
            raise RuntimeError('Chrome masih mengunci sesi. Tutup semua jendela Chrome dan proses latarnya, lalu sambungkan lagi.') from None
        if 'decrypt' in text or 'dpapi' in text:
            raise RuntimeError('Enkripsi Chrome di Windows tidak didukung pembaca sesi ini. Koneksi belum berhasil.') from None
        raise RuntimeError('Sesi Chrome belum dapat dibaca. Pastikan profil utama sudah masuk ke YouTube.') from None

def import_session(text):
    """Parse an explicitly supplied Netscape cookie export without writing it."""
    global _SESSION_JAR
    import io
    import time
    from http.cookiejar import MozillaCookieJar
    from yt_dlp.cookies import YoutubeDLCookieJar
    if not isinstance(text, str) or len(text.encode('utf-8')) > 262144:
        raise RuntimeError('Ukuran file sesi maksimal 256 KB.')
    parsed = MozillaCookieJar()
    try:
        parsed._really_load(io.StringIO(text), '<memory>', True, False)
    except Exception:
        raise RuntimeError('Format sesi tidak valid. Gunakan ekspor cookie Netscape untuk youtube.com.') from None
    jar = YoutubeDLCookieJar()
    for cookie in parsed:
        domain = cookie.domain.lstrip('.')
        if (domain == 'youtube.com' or domain.endswith('.youtube.com')) and (cookie.expires is None or cookie.expires > time.time()):
            jar.set_cookie(cookie)
    if not any(c.name in ('SID', '__Secure-1PSID', '__Secure-3PSID', 'LOGIN_INFO') for c in jar):
        raise RuntimeError('File ini tidak berisi sesi login YouTube yang masih berlaku.')
    _SESSION_JAR = jar
    return {'connected': True}

def disconnect_chrome():
    global _SESSION_JAR
    _SESSION_JAR = None

def session_status():
    return {'connected': _SESSION_JAR is not None}


_YT_PATTERNS = (
    r"^(https?://)?(www\.)?(m\.)?youtube\.com/watch\?[^ ]*v=[\w-]{11}",
    r"^(https?://)?(www\.)?youtu\.be/[\w-]{11}",
    r"^(https?://)?(www\.)?youtube\.com/embed/[\w-]{11}",
    r"^(https?://)?(www\.)?youtube\.com/shorts/[\w-]{11}",
    r"^(https?://)?(www\.)?youtube\.com/live/[\w-]{11}",
)


class DownloadError(RuntimeError):
    pass


def validate_url(url: str) -> bool:
    u = (url or "").strip()
    return any(re.match(p, u, re.IGNORECASE) for p in _YT_PATTERNS)


# Prefer <=1080p H.264 + m4a so the result is directly editable without transcode surprises.
_FORMAT = (
    "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/"
    "bestvideo[height<=1080]+bestaudio/"
    "best[height<=1080]/best"
)


def _info_to_source(info: dict[str, Any]) -> SourceInfo:
    return SourceInfo(
        title=info.get("title") or "Untitled",
        uploader=info.get("uploader") or info.get("channel") or "",
        duration=float(info.get("duration") or 0.0),
        thumbnail=info.get("thumbnail"),
        webpage_url=info.get("webpage_url") or info.get("original_url") or "",
        width=int(info.get("width") or 0),
        height=int(info.get("height") or 0),
        fps=float(info.get("fps") or 0.0),
    )


def download(url: str, out_dir: Path, on_progress: ProgressCb | None = None) -> tuple[Path, SourceInfo]:
    """Download `url` into `out_dir`. Returns (video_path, source_info)."""
    if not validate_url(url):
        raise DownloadError(
            "URL bukan tautan YouTube yang valid. Dukungan: youtube.com/watch, youtu.be, "
            "youtube.com/embed, /shorts, /live."
        )
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        return _download_python_api(url, out_dir, on_progress)
    except ImportError:
        return _download_cli(url, out_dir, on_progress)


def _download_python_api(url: str, out_dir: Path, on_progress: ProgressCb | None):
    from yt_dlp import YoutubeDL  # noqa: PLC0415  (optional import path)
    from yt_dlp.utils import DownloadError as YtDlpDownloadError  # noqa: PLC0415

    state: dict[str, Any] = {"path": None}

    def hook(d: dict[str, Any]) -> None:
        if d.get("status") == "downloading" and on_progress:
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            got = d.get("downloaded_bytes") or 0
            pct = (got / total * 100.0) if total else 0.0
            speed = d.get("speed") or 0
            speed_s = f" @ {speed / 1_048_576:.1f} MB/s" if speed else ""
            on_progress(pct, f"Mengunduh {pct:.0f}%{speed_s}")
        elif d.get("status") == "finished":
            state["path"] = d.get("filename")
            if on_progress:
                on_progress(100.0, "Unduhan selesai, menggabungkan stream...")

    opts = {
        "format": _FORMAT,
        "merge_output_format": "mp4",
        "outtmpl": str(out_dir / "%(id)s.%(ext)s"),
        "progress_hooks": [hook],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": False,
        "retries": 5,
        "fragment_retries": 5,
        "overwrites": True,
    }

    try:
        with YoutubeDL(opts) as ydl:
            if _SESSION_JAR is not None:
                ydl.cookiejar = _SESSION_JAR
            info = ydl.extract_info(url, download=True)
    except YtDlpDownloadError as exc:
        raise DownloadError(_friendly_ytdlp_error(str(exc))) from exc

    if info is None:
        raise DownloadError("yt-dlp tidak mengembalikan metadata video.")

    path = _resolve_output(info, out_dir, state.get("path"))
    return path, _info_to_source(info)


def _resolve_output(info: dict[str, Any], out_dir: Path, hook_path: str | None) -> Path:
    """Find the real file on disk; yt-dlp may remux to a different extension."""
    candidates: list[Path] = []
    req = (info.get("requested_downloads") or [{}])[0]
    for c in (req.get("filepath"), info.get("_filename"), hook_path):
        if c:
            candidates.append(Path(c))

    vid = info.get("id")
    if vid:
        candidates.extend(sorted(out_dir.glob(f"{vid}.*")))

    for c in candidates:
        if c.exists() and c.is_file() and c.suffix.lower() not in {".part", ".ytdl"}:
            return c

    raise DownloadError("File hasil unduhan tidak ditemukan di disk.")


def _download_cli(url: str, out_dir: Path, on_progress: ProgressCb | None):
    exe = shutil.which("yt-dlp")
    if not exe:
        raise DownloadError(
            "yt-dlp tidak terpasang. Jalankan: pip install -r backend/requirements.txt"
        )
    if on_progress:
        on_progress(0.0, "Mengunduh via yt-dlp CLI...")

    tmpl = str(out_dir / "%(id)s.%(ext)s")
    proc = subprocess.run(
        [exe, "-f", _FORMAT, "--merge-output-format", "mp4", "--no-playlist",
         "--print", "after_move:filepath", "-o", tmpl, url],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        raise DownloadError(_friendly_ytdlp_error(proc.stderr or "yt-dlp gagal"))

    line = (proc.stdout or "").strip().splitlines()
    path = Path(line[-1]) if line else None
    if not path or not path.exists():
        raise DownloadError("File hasil unduhan tidak ditemukan.")

    from .media import probe_media  # local import to avoid cycles

    meta = probe_media(path)
    return path, SourceInfo(
        title=path.stem,
        duration=meta["duration"],
        width=meta["width"],
        height=meta["height"],
        fps=meta["fps"],
        webpage_url=url,
    )


def _friendly_ytdlp_error(raw: str) -> str:
    low = raw.lower()
    if "not a bot" in low:
        return "YouTube menolak akses otomatis. Sambungkan atau impor sesi YouTube di atas kolom URL, lalu coba lagi."
    if "private video" in low:
        return "Video bersifat privat sehingga tidak dapat diunduh."
    if "video unavailable" in low or "not available" in low:
        return "Video tidak tersedia (mungkin dihapus atau dibatasi wilayah)."
    if "sign in" in low or "age" in low and "confirm" in low:
        return "Video memerlukan login / verifikasi umur sehingga tidak dapat diunduh."
    if "copyright" in low:
        return "Video diblokir karena alasan hak cipta."
    if any(k in low for k in ("urlopen", "timed out", "connection", "resolve", "network")):
        return "Gagal terhubung ke YouTube. Periksa koneksi internet Anda."
    tail = raw.strip().splitlines()
    return "Unduhan gagal: " + (tail[-1][:300] if tail else "penyebab tidak diketahui")
