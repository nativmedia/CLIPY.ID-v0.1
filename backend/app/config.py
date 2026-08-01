"""Runtime configuration and workspace paths for Clipper."""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path

# Project root = .../clipper
ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = Path(os.environ.get("CLIPPER_DATA_DIR", ROOT / "data"))
DOWNLOAD_DIR = DATA_DIR / "downloads"
JOBS_DIR = DATA_DIR / "jobs"
MODELS_DIR = DATA_DIR / "models"
LOGS_DIR = DATA_DIR / "logs"

FRONTEND_DIST = ROOT / "frontend" / "dist"


def ensure_dirs() -> None:
    for d in (DATA_DIR, DOWNLOAD_DIR, JOBS_DIR, MODELS_DIR, LOGS_DIR):
        d.mkdir(parents=True, exist_ok=True)


def job_dir(job_id: str) -> Path:
    d = JOBS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


@dataclass(frozen=True)
class Tooling:
    """Resolved paths to external binaries."""

    ffmpeg: str | None = field(default=None)
    ffprobe: str | None = field(default=None)

    @property
    def ok(self) -> bool:
        return bool(self.ffmpeg and self.ffprobe)


def _which(name: str) -> str | None:
    # Allow explicit override, e.g. CLIPPER_FFMPEG=C:\ffmpeg\bin\ffmpeg.exe
    override = os.environ.get(f"CLIPPER_{name.upper()}")
    if override and Path(override).exists():
        return override
    return shutil.which(name)


def detect_tooling() -> Tooling:
    return Tooling(ffmpeg=_which("ffmpeg"), ffprobe=_which("ffprobe"))


TOOLING = detect_tooling()

# --- Processing defaults (overridable per job) ---
DEFAULT_MAX_CLIP_SECONDS = 60
DEFAULT_MIN_CLIP_SECONDS = 12
DEFAULT_MAX_CLIPS = 6
DEFAULT_MIN_SCORE = 45

# Output video spec (portrait short)
OUT_WIDTH = 720
OUT_HEIGHT = 1280
OUT_VIDEO_BITRATE = "6M"
OUT_VIDEO_MAXRATE = "8M"
OUT_AUDIO_BITRATE = "192k"

# Whisper
WHISPER_MODEL = os.environ.get("CLIPPER_WHISPER_MODEL", "base")
WHISPER_DEVICE = os.environ.get("CLIPPER_WHISPER_DEVICE", "auto")
WHISPER_COMPUTE = os.environ.get("CLIPPER_WHISPER_COMPUTE", "")

# Cap analysis work on very long sources
MAX_SOURCE_SECONDS = int(os.environ.get("CLIPPER_MAX_SOURCE_SECONDS", 2 * 60 * 60))
