"""Thin wrappers around ffmpeg/ffprobe."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Iterable

from ..config import TOOLING

# Prevent console windows from flashing on Windows
_CREATE_NO_WINDOW = 0x08000000
_FLAGS = _CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0


class FFmpegError(RuntimeError):
    pass


def _require(tool: str | None, name: str) -> str:
    if not tool:
        raise FFmpegError(
            f"{name} tidak ditemukan di PATH. Install ffmpeg lalu tambahkan ke PATH, "
            f"atau set env CLIPPER_{name.upper()}=<path ke {name}.exe>."
        )
    return tool


def run(
    args: Iterable[str], *, timeout: int | None = None, cwd: str | Path | None = None
) -> str:
    cmd = list(args)
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        creationflags=_FLAGS,
        cwd=str(cwd) if cwd else None,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or "").strip().splitlines()[-12:]
        raise FFmpegError(
            f"Perintah gagal ({proc.returncode}): {cmd[0]}\n" + "\n".join(tail)
        )
    return proc.stdout


def ffmpeg(
    args: Iterable[str], *, timeout: int | None = None, cwd: str | Path | None = None
) -> str:
    exe = _require(TOOLING.ffmpeg, "ffmpeg")
    return run(
        [exe, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", *args],
        timeout=timeout,
        cwd=cwd,
    )


def ffprobe_json(path: str | Path) -> dict[str, Any]:
    exe = _require(TOOLING.ffprobe, "ffprobe")
    out = run(
        [
            exe,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(path),
        ]
    )
    return json.loads(out or "{}")


def probe_media(path: str | Path) -> dict[str, Any]:
    """Return normalized {duration, width, height, fps, has_audio}."""
    data = ffprobe_json(path)
    streams = data.get("streams", []) or []
    fmt = data.get("format", {}) or {}

    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)

    duration = 0.0
    for candidate in (fmt.get("duration"), (video or {}).get("duration")):
        try:
            duration = float(candidate)
            if duration > 0:
                break
        except (TypeError, ValueError):
            continue

    fps = 0.0
    if video:
        raw = video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"
        try:
            num, _, den = raw.partition("/")
            den_f = float(den or 1)
            fps = float(num) / den_f if den_f else 0.0
        except (TypeError, ValueError):
            fps = 0.0

    return {
        "duration": duration,
        "width": int((video or {}).get("width") or 0),
        "height": int((video or {}).get("height") or 0),
        "fps": round(fps, 3) if fps else 0.0,
        "has_audio": audio is not None,
        "codec": (video or {}).get("codec_name", ""),
    }


def extract_audio_wav(src: str | Path, dst: str | Path, *, sample_rate: int = 16000) -> Path:
    """Extract mono PCM audio - the format Whisper and the energy analyzer expect."""
    dst = Path(dst)
    ffmpeg([
        "-i", str(src),
        "-vn",
        "-ac", "1",
        "-ar", str(sample_rate),
        "-c:a", "pcm_s16le",
        str(dst),
    ])
    return dst


def extract_frame(src: str | Path, dst: str | Path, timestamp: float, *, width: int = 0) -> Path:
    """Grab a single JPEG frame at `timestamp` seconds."""
    dst = Path(dst)
    args = ["-ss", f"{max(0.0, timestamp):.3f}", "-i", str(src), "-frames:v", "1", "-q:v", "3"]
    if width:
        args += ["-vf", f"scale={width}:-2"]
    args.append(str(dst))
    ffmpeg(args)
    return dst
