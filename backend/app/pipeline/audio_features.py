"""Audio prosody features: RMS energy envelope, peaks, dynamics."""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


def load_wav_mono(path: str | Path) -> tuple[np.ndarray, int]:
    """Read a 16-bit PCM mono WAV into float32 [-1, 1]."""
    with wave.open(str(path), "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    dtype = {1: np.uint8, 2: np.int16, 4: np.int32}.get(width, np.int16)
    data = np.frombuffer(frames, dtype=dtype).astype(np.float32)

    if width == 1:
        data = (data - 128.0) / 128.0
    elif width == 2:
        data /= 32768.0
    else:
        data /= 2147483648.0

    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)

    return data, rate


def energy_envelope(
    samples: np.ndarray, sample_rate: int, *, hop_seconds: float = 0.25
) -> tuple[np.ndarray, np.ndarray]:
    """RMS energy per hop. Returns (times, rms_normalized_0_1)."""
    hop = max(1, int(sample_rate * hop_seconds))
    n = len(samples) // hop
    if n == 0:
        return np.zeros(1), np.zeros(1)

    trimmed = samples[: n * hop].reshape(n, hop)
    rms = np.sqrt(np.mean(trimmed**2, axis=1) + 1e-12)

    # Log scale tracks perceived loudness far better than raw amplitude.
    db = 20.0 * np.log10(rms + 1e-9)
    lo, hi = float(np.percentile(db, 5)), float(np.percentile(db, 97))
    norm = np.clip((db - lo) / (hi - lo + 1e-9), 0.0, 1.0) if hi > lo else np.zeros_like(db)

    times = np.arange(n) * hop_seconds
    return times, norm.astype(np.float32)


def window_stats(
    times: np.ndarray, values: np.ndarray, start: float, end: float
) -> dict[str, float]:
    """Aggregate an envelope over [start, end)."""
    if len(times) == 0:
        return {"mean": 0.0, "max": 0.0, "std": 0.0, "range": 0.0}
    mask = (times >= start) & (times < end)
    if not mask.any():
        idx = int(np.clip(np.searchsorted(times, start), 0, len(values) - 1))
        v = float(values[idx])
        return {"mean": v, "max": v, "std": 0.0, "range": 0.0}
    w = values[mask]
    return {
        "mean": float(np.mean(w)),
        "max": float(np.max(w)),
        "std": float(np.std(w)),
        "range": float(np.max(w) - np.min(w)),
    }


def find_peak_time(times: np.ndarray, values: np.ndarray, start: float, end: float) -> float:
    """Timestamp of maximum energy inside [start, end) - used to place the zoom."""
    if len(times) == 0:
        return (start + end) / 2.0
    mask = (times >= start) & (times < end)
    if not mask.any():
        return (start + end) / 2.0
    sub_t, sub_v = times[mask], values[mask]
    return float(sub_t[int(np.argmax(sub_v))])
