"""Locked, shot-based framing, adapted from CLIPY.ID 2's held-crop approach.

The picture continues playing. Only the framing is held: no interpolated pans or
zoom within a camera shot. Face detection still uses the existing local Haar scan;
this module does not identify the active speaker or require downloaded models.
"""
from __future__ import annotations

from bisect import bisect_right
import logging
import math
from pathlib import Path
import re
from statistics import median
from subprocess import TimeoutExpired

from .media import FFmpegError, ffmpeg

log = logging.getLogger("clipper.framing")


def detect_shot_cuts(source: str | Path) -> list[float]:
    """Read source-camera cut times, normalized to the beginning of the video."""
    try:
        metadata = ffmpeg([
            "-i", str(source), "-an",
            "-vf", "setpts=PTS-STARTPTS,scdet=threshold=10,metadata=mode=print:key=lavfi.scd.time:file=-",
            "-f", "null", "-",
        ], timeout=1800)
    except (FFmpegError, TimeoutExpired) as exc:
        # A locked crop remains usable when a build lacks the scdet filter.
        log.warning("Deteksi shot tidak tersedia; framing dikunci sepanjang klip: %s", exc)
        return []
    return sorted({float(t) for t in re.findall(r"lavfi\.scd\.time=([\d.]+)", metadata) if float(t) > 0})


def _subject_center(centers: list[float]) -> float:
    """Pick the most persistent position, never average two separate people."""
    if not centers:
        return 0.5
    ordered = sorted(centers)
    # A sliding window avoids a quadratic search over long single-camera videos.
    best = (0, 0)
    left = 0
    for right, x in enumerate(ordered):
        while x - ordered[left] > 0.12:
            left += 1
        if right - left > best[1] - best[0]:
            best = (left, right)
    return float(median(ordered[best[0]:best[1] + 1]))


def build_stable_track(
    scan_centers: list[tuple[float, float, float]], *, start: float, end: float,
    shot_cuts: list[float] | None = None,
) -> list[tuple[float, float]]:
    """One crop position per source shot; changes use clip-relative timestamps.

    Geometry is calculated from the full source shot, including when a clip begins
    halfway through it. Missing detections within a shot cannot create crop jumps.
    A new shot with no face uses a centered crop instead of the previous subject.
    """
    if end <= start:
        raise ValueError("Clip end must be after start")
    cuts = sorted({float(t) for t in (shot_cuts or []) if math.isfinite(t) and t > 0})
    boundaries = [start, *(t for t in cuts if start < t < end)]
    points = [(t, min(1.0, max(0.0, x))) for t, x, _ in scan_centers
              if math.isfinite(t) and math.isfinite(x)]
    track: list[tuple[float, float]] = []
    for boundary in boundaries:
        index = bisect_right(cuts, boundary)
        shot_start = cuts[index - 1] if index else 0.0
        shot_end = cuts[index] if index < len(cuts) else float("inf")
        center = _subject_center([x for t, x in points if shot_start <= t < shot_end])
        if not track or abs(center - track[-1][1]) > 1e-6:
            track.append((round(boundary - start, 6), center))
    return track
