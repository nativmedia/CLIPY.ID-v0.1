"""Local speech-to-text using faster-whisper (CTranslate2)."""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable

from ..config import MODELS_DIR, WHISPER_COMPUTE, WHISPER_DEVICE, WHISPER_MODEL
from ..models import TranscriptSegment, TranscriptWord

log = logging.getLogger("clipper.transcribe")

ProgressCb = Callable[[float, str], None]

_MODEL_CACHE: dict[tuple[str, str, str], object] = {}


class TranscriptionError(RuntimeError):
    pass


def _pick_device() -> tuple[str, str]:
    """Resolve (device, compute_type). Try CUDA, fall back to CPU int8."""
    if WHISPER_DEVICE != "auto":
        compute = WHISPER_COMPUTE or ("float16" if WHISPER_DEVICE == "cuda" else "int8")
        return WHISPER_DEVICE, compute
    try:
        import ctranslate2  # noqa: PLC0415

        if ctranslate2.get_cuda_device_count() > 0:
            # CTranslate2 can see the NVIDIA driver even when the CUDA runtime
            # DLLs required for actual inference are missing. In that case the
            # model loads, but iteration over transcribe() fails later with
            # e.g. "cublas64_12.dll is not found". Verify the runtime first so
            # automatic mode can reliably fall back to CPU.
            if os.name == "nt":
                import ctypes  # noqa: PLC0415

                try:
                    ctypes.WinDLL("cublas64_12.dll")
                except OSError:
                    log.warning("CUDA terdeteksi, tetapi cuBLAS 12 tidak tersedia; memakai CPU int8")
                    return "cpu", WHISPER_COMPUTE or "int8"
            return "cuda", WHISPER_COMPUTE or "float16"
    except Exception:  # noqa: BLE001 - probing hardware must never be fatal
        pass
    return "cpu", WHISPER_COMPUTE or "int8"


def _load_model(model_name: str):
    from faster_whisper import WhisperModel  # noqa: PLC0415

    device, compute = _pick_device()
    key = (model_name, device, compute)
    if key in _MODEL_CACHE:
        return _MODEL_CACHE[key]

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute,
            download_root=str(MODELS_DIR),
        )
    except Exception as exc:  # noqa: BLE001
        if device == "cuda":
            log.warning("CUDA init gagal (%s); fallback ke CPU int8", exc)
            model = WhisperModel(
                model_name, device="cpu", compute_type="int8", download_root=str(MODELS_DIR)
            )
            key = (model_name, "cpu", "int8")
        else:
            raise TranscriptionError(
                f"Gagal memuat model Whisper '{model_name}': {exc}. "
                "Pastikan koneksi internet aktif saat pengunduhan model pertama kali."
            ) from exc

    _MODEL_CACHE[key] = model
    return model


def transcribe(
    audio_path: str | Path,
    *,
    duration: float,
    language: str | None = None,
    model_name: str | None = None,
    on_progress: ProgressCb | None = None,
) -> tuple[list[TranscriptSegment], str | None]:
    """Transcribe with word timestamps. Returns (segments, detected_language)."""
    try:
        model = _load_model(model_name or WHISPER_MODEL)
    except ImportError as exc:
        details = str(exc)
        if "Application Control policy" in details or "Code Integrity" in details:
            raise TranscriptionError(
                "Faster-Whisper sudah terpasang, tetapi Windows Smart App Control "
                "memblokir DLL PyAV yang diperlukan untuk membaca audio. "
                "Izinkan aplikasi/DLL Python ini melalui kebijakan keamanan Windows, "
                "lalu mulai ulang backend."
            ) from exc
        raise TranscriptionError(
            "faster-whisper belum terpasang. Jalankan: pip install -r backend/requirements.txt"
        ) from exc

    if on_progress:
        on_progress(2.0, "Model Whisper siap, memulai transkripsi...")

    try:
        # FFmpeg already produces mono 16 kHz PCM. Pass samples directly so
        # Whisper does not reopen the WAV through an incompatible PyAV decoder.
        from .audio_features import load_wav_mono
        samples, sample_rate = load_wav_mono(audio_path)
        if sample_rate != 16000:
            raise TranscriptionError('Audio transkripsi harus PCM 16 kHz. Ekstrak ulang audio dengan FFmpeg.')
        raw_segments, info = model.transcribe(
            samples,
            language=language,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
            beam_size=5,
            condition_on_previous_text=False,
        )
    except Exception as exc:  # noqa: BLE001
        raise TranscriptionError(f"Transkripsi gagal: {exc}") from exc

    detected = getattr(info, "language", None) or language
    total = duration or getattr(info, "duration", 0.0) or 0.0

    segments: list[TranscriptSegment] = []
    for seg in raw_segments:  # generator - consumed lazily, so progress is meaningful
        words = [
            TranscriptWord(start=float(w.start), end=float(w.end), text=(w.word or "").strip())
            for w in (getattr(seg, "words", None) or [])
            if w.start is not None and w.end is not None
        ]
        text = (seg.text or "").strip()
        if not text:
            continue
        segments.append(
            TranscriptSegment(
                start=float(seg.start), end=float(seg.end), text=text, words=words
            )
        )
        if on_progress and total > 0:
            pct = min(99.0, seg.end / total * 100.0)
            on_progress(pct, f"Transkripsi {pct:.0f}% ({len(segments)} segmen)")

    if not segments:
        raise TranscriptionError(
            "Tidak ada ucapan terdeteksi pada audio. Video mungkin tanpa narasi/dialog."
        )

    if on_progress:
        on_progress(100.0, f"Transkripsi selesai: {len(segments)} segmen, bahasa={detected}")

    return segments, detected
