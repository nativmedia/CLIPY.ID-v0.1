"""Visual analysis with OpenCV: motion energy, face presence, and reframe tracking.

MediaPipe has no CPython 3.13 wheel, so face detection uses OpenCV's bundled Haar
cascades (frontal + profile). No model download is required - fully offline.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np

log = logging.getLogger("clipper.vision")

ProgressCb = Callable[[float, str], None]

_ANALYSIS_WIDTH = 320  # downscale for the scan pass - plenty for motion/face presence
_TRACK_WIDTH = 480     # slightly higher res for the reframe track


@dataclass
class VisualScan:
    times: np.ndarray
    motion: np.ndarray        # 0..1 normalized frame-difference energy
    face_presence: np.ndarray  # 0..1 fraction of sampled frames containing a face
    face_centers: list[tuple[float, float, float]]  # (t, cx_norm, cy_norm)


def _load_cascades():
    import cv2  # noqa: PLC0415

    cascade_factory = getattr(cv2, "CascadeClassifier", None)
    data = getattr(cv2, "data", None)
    cascade_dir = getattr(data, "haarcascades", None)
    if cascade_factory is None or not cascade_dir:
        log.warning(
            "OpenCV tidak menyediakan Haar Cascade API/model; "
            "deteksi wajah dinonaktifkan"
        )
        return None, None

    base = Path(cascade_dir)
    frontal = cascade_factory(str(base / "haarcascade_frontalface_default.xml"))
    profile = cascade_factory(str(base / "haarcascade_profileface.xml"))
    if frontal.empty():
        log.warning("Haar cascade frontal gagal dimuat; deteksi wajah dinonaktifkan")
        return None, None
    return frontal, (None if profile.empty() else profile)


def _detect_faces(gray, frontal, profile):
    """Return list of (x, y, w, h). Tries frontal, then profile, then mirrored profile."""
    import cv2  # noqa: PLC0415

    kw = {"scaleFactor": 1.15, "minNeighbors": 5, "minSize": (24, 24)}
    faces = frontal.detectMultiScale(gray, **kw)
    if len(faces):
        return list(faces)

    if profile is not None:
        faces = profile.detectMultiScale(gray, **kw)
        if len(faces):
            return list(faces)
        flipped = cv2.flip(gray, 1)
        faces = profile.detectMultiScale(flipped, **kw)
        if len(faces):
            w_img = gray.shape[1]
            return [(w_img - x - w, y, w, h) for (x, y, w, h) in faces]

    return []


def _pick_primary(faces, frame_w: int) -> tuple[float, float]:
    """Largest face wins; ties broken toward frame centre. Returns normalized (cx, cy)."""
    best = max(faces, key=lambda f: f[2] * f[3] - 0.15 * abs((f[0] + f[2] / 2) - frame_w / 2))
    x, y, w, h = best
    return (x + w / 2.0), (y + h / 2.0)


def scan_video(
    video_path: str | Path,
    *,
    duration: float,
    sample_fps: float = 2.0,
    on_progress: ProgressCb | None = None,
) -> VisualScan:
    """Single sequential pass over the video collecting motion + face signals."""
    try:
        import cv2  # noqa: PLC0415
    except ImportError:
        log.warning("opencv tidak tersedia; analisis visual dilewati")
        n = max(1, int(duration))
        t = np.arange(n, dtype=np.float32)
        return VisualScan(t, np.zeros(n, np.float32), np.zeros(n, np.float32), [])

    frontal, profile = _load_cascades()
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV tidak dapat membuka video: {video_path}")

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    if src_fps <= 0 or src_fps > 240:
        src_fps = 30.0
    stride = max(1, int(round(src_fps / max(0.25, sample_fps))))

    times: list[float] = []
    motion: list[float] = []
    face_flags: list[float] = []
    centers: list[tuple[float, float, float]] = []

    prev_small = None
    idx = 0
    # Run face detection on a subset of sampled frames - it is the expensive part.
    face_every = max(1, int(round(sample_fps / 1.0)))
    sample_i = 0
    last_face: tuple[float, float] | None = None

    while True:
        ok = cap.grab()
        if not ok:
            break
        if idx % stride != 0:
            idx += 1
            continue

        ok, frame = cap.retrieve()
        idx += 1
        if not ok or frame is None:
            continue

        t = (idx / src_fps) if src_fps else len(times)
        h, w = frame.shape[:2]
        if w == 0 or h == 0:
            continue

        scale = _ANALYSIS_WIDTH / float(w)
        small = cv2.resize(frame, (_ANALYSIS_WIDTH, max(2, int(h * scale))))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        # --- motion ---
        if prev_small is None:
            motion.append(0.0)
        else:
            diff = cv2.absdiff(gray, prev_small)
            motion.append(float(np.mean(diff)) / 255.0)
        prev_small = gray

        # --- faces ---
        has_face = 0.0
        if frontal is not None and (sample_i % face_every == 0):
            eq = cv2.equalizeHist(gray)
            faces = _detect_faces(eq, frontal, profile)
            if faces:
                has_face = 1.0
                cx, cy = _pick_primary(faces, gray.shape[1])
                nx, ny = cx / gray.shape[1], cy / gray.shape[0]
                centers.append((t, nx, ny))
                last_face = (nx, ny)
            elif last_face is not None:
                has_face = 0.0
        face_flags.append(has_face)

        times.append(t)
        sample_i += 1

        if on_progress and duration > 0 and sample_i % 40 == 0:
            pct = min(99.0, t / duration * 100.0)
            on_progress(pct, f"Analisis visual {pct:.0f}%")

    cap.release()

    if not times:
        n = max(1, int(duration))
        t_arr = np.arange(n, dtype=np.float32)
        return VisualScan(t_arr, np.zeros(n, np.float32), np.zeros(n, np.float32), [])

    t_arr = np.asarray(times, dtype=np.float32)
    m_arr = np.asarray(motion, dtype=np.float32)
    hi = float(np.percentile(m_arr, 95)) if len(m_arr) else 0.0
    m_norm = np.clip(m_arr / hi, 0.0, 1.0) if hi > 1e-6 else np.zeros_like(m_arr)

    f_arr = np.asarray(face_flags, dtype=np.float32)
    # Smooth face presence so brief detection misses don't read as "no speaker".
    if len(f_arr) >= 5:
        kernel = np.ones(5, dtype=np.float32) / 5.0
        f_arr = np.convolve(f_arr, kernel, mode="same")

    if on_progress:
        on_progress(100.0, f"Analisis visual selesai ({len(times)} sampel, {len(centers)} wajah)")

    return VisualScan(t_arr, m_norm, f_arr, centers)


# --------------------------------------------------------------------------
# Reframe track
# --------------------------------------------------------------------------

def build_reframe_track(
    scan_centers: list[tuple[float, float, float]],
    *,
    start: float,
    end: float,
    default_x: float = 0.5,
    smoothing: float = 0.25,
    max_keyframes: int = 24,
) -> list[tuple[float, float]]:
    """Smoothed (t_rel, cx_norm) keyframes for the crop window inside [start, end].

    Returns [] when no face was ever seen, signalling a centre crop.
    """
    pts = [(t - start, cx) for (t, cx, _cy) in scan_centers if start <= t <= end]
    if not pts:
        return []

    pts.sort(key=lambda p: p[0])

    # Exponential smoothing kills jitter; the camera should glide, not snap.
    smoothed: list[tuple[float, float]] = []
    acc = pts[0][1]
    for t_rel, cx in pts:
        acc = (1.0 - smoothing) * acc + smoothing * cx
        smoothed.append((t_rel, acc))

    # Clamp to the clip window and guarantee an anchor at both ends.
    span = max(0.1, end - start)
    if smoothed[0][0] > 0.0:
        smoothed.insert(0, (0.0, smoothed[0][1]))
    if smoothed[-1][0] < span:
        smoothed.append((span, smoothed[-1][1]))

    if len(smoothed) <= max_keyframes:
        return smoothed

    # Uniformly decimate, always keeping first and last.
    step = len(smoothed) / float(max_keyframes)
    picked = [smoothed[min(len(smoothed) - 1, int(i * step))] for i in range(max_keyframes)]
    picked[-1] = smoothed[-1]
    return picked


def face_coverage(scan: VisualScan, start: float, end: float) -> float:
    """Fraction of the window where a face was detected - an acceptance-criteria metric."""
    if len(scan.times) == 0:
        return 0.0
    mask = (scan.times >= start) & (scan.times <= end)
    if not mask.any():
        return 0.0
    return round(float(np.mean(scan.face_presence[mask])), 3)
