"""Pydantic models shared by the API and the pipeline."""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class JobStage(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    RENDERING = "rendering"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


STAGE_LABELS: dict[str, str] = {
    JobStage.QUEUED: "Menunggu antrian",
    JobStage.DOWNLOADING: "Mengunduh video",
    JobStage.TRANSCRIBING: "Transkripsi audio",
    JobStage.ANALYZING: "Analisis momen",
    JobStage.RENDERING: "Render klip",
    JobStage.DONE: "Selesai",
    JobStage.FAILED: "Gagal",
    JobStage.CANCELLED: "Dibatalkan",
}


MomentLabel = Literal[
    "aha",
    "insight",
    "surprising",
    "funny",
    "emotional",
    "inspiring",
    "controversial",
    "viral",
    "hook",
    "retention",
]

MOMENT_LABELS_ID: dict[str, str] = {
    "aha": "Aha Moment",
    "insight": "Insight Penting",
    "surprising": "Fakta Mengejutkan",
    "funny": "Momen Lucu",
    "emotional": "Momen Emosional",
    "inspiring": "Inspiratif",
    "controversial": "Kontroversial",
    "viral": "Potensi Viral",
    "hook": "Hook Kuat",
    "retention": "Retensi Tinggi",
}


class JobOptions(BaseModel):
    max_clip_seconds: int = Field(60, ge=10, le=180)
    min_clip_seconds: int = Field(12, ge=5, le=120)
    max_clips: int = Field(6, ge=1, le=15)
    min_score: int = Field(45, ge=0, le=100)
    moment_filter: list[str] = Field(default_factory=list)
    subtitle_style: Literal["outline", "shadow", "box"] = "outline"
    enable_zoom: bool = True
    enable_reframe: bool = True
    language: str | None = None  # None => autodetect
    whisper_model: str | None = None
    keep_source: bool = True


class CreateJobRequest(BaseModel):
    url: str
    options: JobOptions = Field(default_factory=JobOptions)


class TranscriptWord(BaseModel):
    start: float
    end: float
    text: str


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    words: list[TranscriptWord] = Field(default_factory=list)


class ClipAssets(BaseModel):
    title: str = ""
    hook: str = ""
    description: str = ""
    hashtags: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    thumbnail_url: str | None = None
    platform_tags: dict[str, list[str]] = Field(default_factory=dict)


class Clip(BaseModel):
    id: str
    index: int
    start: float
    end: float
    duration: float
    score: int
    labels: list[str] = Field(default_factory=list)
    transcript: str = ""
    video_url: str | None = None
    thumbnail_url: str | None = None
    subtitle_url: str | None = None
    face_coverage: float = 0.0
    assets: ClipAssets | None = None
    selected: bool = False


class SourceInfo(BaseModel):
    title: str = ""
    uploader: str = ""
    duration: float = 0.0
    thumbnail: str | None = None
    webpage_url: str = ""
    width: int = 0
    height: int = 0
    fps: float = 0.0


class ProgressEvent(BaseModel):
    stage: str
    label: str
    percent: float = 0.0
    message: str = ""
    detail: dict[str, Any] = Field(default_factory=dict)


class Job(BaseModel):
    id: str
    url: str
    options: JobOptions
    stage: str = JobStage.QUEUED
    stage_label: str = STAGE_LABELS[JobStage.QUEUED]
    percent: float = 0.0
    message: str = ""
    error: str | None = None
    created_at: float = 0.0
    updated_at: float = 0.0
    source: SourceInfo | None = None
    clips: list[Clip] = Field(default_factory=list)
    log: list[str] = Field(default_factory=list)
    detected_language: str | None = None
