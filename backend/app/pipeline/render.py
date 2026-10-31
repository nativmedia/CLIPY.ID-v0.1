"""Render a scored moment into a ready-to-upload 9:16 short.

Filter chain per clip:
  trim -> held or following 9:16 crop -> scale 720x1280 -> optional zoom -> burn ASS subs
When no face is found we centre-crop; if the source is narrower than 9:16 we pad with a
blurred copy of the frame instead of black bars.
"""
from __future__ import annotations

import logging
from pathlib import Path

from ..config import (
    OUT_AUDIO_BITRATE,
    OUT_HEIGHT,
    OUT_VIDEO_BITRATE,
    OUT_VIDEO_MAXRATE,
    OUT_WIDTH,
)
from .media import ffmpeg, probe_media

log = logging.getLogger("clipper.render")

TARGET_AR = OUT_WIDTH / OUT_HEIGHT  # 0.5625
OUTPUT_SIZES = {"9:16": (720, 1280), "4:5": (720, 900), "1:1": (720, 720), "16:9": (1280, 720), "4:3": (960, 720)}


def _expr_from_keyframes(keyframes: list[tuple[float, float]], crop_w: int, src_w: int, *, stable: bool = False) -> str:
    """Piecewise-linear ffmpeg expression for crop x over time.

    Built as nested if(lt(t,..)) so the crop glides between face positions.
    """
    max_x = max(0, src_w - crop_w)

    def clamp_px(cx_norm: float) -> float:
        return min(float(max_x), max(0.0, cx_norm * src_w - crop_w / 2.0))

    pts = [(t, clamp_px(cx)) for t, cx in keyframes]
    if not pts:
        return f"{max_x / 2:.1f}"
    if len(pts) == 1:
        return f"{pts[0][1]:.1f}"

    # Innermost fallback: hold the final position.
    expr = f"{pts[-1][1]:.1f}"
    for i in range(len(pts) - 2, -1, -1):
        t0, x0 = pts[i]
        t1, x1 = pts[i + 1]
        span = max(1e-3, t1 - t0)
        slope = (x1 - x0) / span
        lerp = f"{x0:.1f}" if stable else f"({x0:.1f}+({slope:.4f})*(t-{t0:.3f}))"
        expr = f"if(lt(t,{t1:.3f}),{lerp},{expr})"
    return expr


def _crop_filter(
    src_w: int, src_h: int, keyframes: list[tuple[float, float]], enable_reframe: bool,
    *, stable: bool = False, width: int = OUT_WIDTH, height: int = OUT_HEIGHT,
) -> tuple[str, bool]:
    """Return (filter_chain, needs_blur_pad)."""
    src_ar = src_w / max(1, src_h)

    target_ar = width / height
    if src_ar <= target_ar + 1e-3:
        # Already portrait-ish (or narrower): scale to width and pad vertically.
        return (
            f"scale={width}:-2:flags=lanczos",
            True,
        )

    # Landscape source: crop a 9:16 column out of it.
    crop_w = max(2, int(round(src_h * target_ar)))
    crop_w -= crop_w % 2
    crop_w = min(crop_w, src_w)

    if enable_reframe and keyframes:
        x_expr = _expr_from_keyframes(keyframes, crop_w, src_w, stable=stable)
    else:
        x_expr = f"{max(0, (src_w - crop_w) // 2)}"

    chain = (
        f"crop=w={crop_w}:h={src_h}:x='{x_expr}':y=0,"
        f"scale={width}:{height}:flags=lanczos"
    )
    return chain, False


def _blur_pad_chain(width: int = OUT_WIDTH, height: int = OUT_HEIGHT) -> str:
    """Blurred-background pad so portrait/square sources fill 720x1280 without black bars."""
    return (
        f"split=2[bg][fg];"
        f"[bg]scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},gblur=sigma=28[bgb];"
        f"[fg]scale={width}:{height}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2"
    )


def _zoom_filter(duration: float, peak_rel: float, fps: float, *, strength: float = 0.10, width: int = OUT_WIDTH, height: int = OUT_HEIGHT) -> str:
    """Slow push-in centred on the scored peak, easing in and back out.

    zoompan does not expose `t`, so time is derived from the output frame
    counter: `on/fps`. Commas inside the expression must be escaped, otherwise
    the surrounding filter chain splits on them.
    """
    peak = max(0.5, min(duration - 0.5, peak_rel)) if duration > 1.5 else duration / 2.0
    ramp = max(1.0, min(4.0, duration * 0.28))
    f = max(1.0, fps)

    # Triangular ease centred on `peak`, clamped to [0,1].
    tri = rf"max(0\,1-abs(on/{f:.3f}-{peak:.3f})/{ramp:.3f})"
    z = f"1+{strength:.3f}*{tri}"

    return (
        f"zoompan=z='{z}':"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d=1:s={width}x{height}:fps={f:.3f}"
    )


def _ass_filter_arg(ass_path: Path, cwd: Path) -> str:
    """Build the `ass=` filter argument.

    A Windows absolute path contains a drive colon, which ffmpeg's filter parser
    reads as an option separator. ffmpeg runs with cwd set to the clip directory,
    so when the subtitle lives there we can pass a bare filename and sidestep
    escaping entirely.
    """
    try:
        if ass_path.parent.resolve() == cwd.resolve():
            return ass_path.name
    except OSError:
        pass
    # Fallback: forward slashes, single-backslash-escaped colon.
    return str(ass_path).replace("\\", "/").replace(":", r"\:")


def render_clip(
    src: str | Path,
    dst: str | Path,
    *,
    start: float,
    end: float,
    ass_path: Path | None,
    keyframes: list[tuple[float, float]],
    peak_time_rel: float,
    enable_zoom: bool = False,
    enable_reframe: bool = True,
    framing_mode: str = "stable",
    aspect_ratio: str = "9:16",
    src_meta: dict | None = None,
) -> Path:
    """Encode one clip. Raises FFmpegError on failure."""
    src, dst = Path(src), Path(dst)
    meta = src_meta or probe_media(src)
    src_w, src_h = int(meta.get("width") or 0), int(meta.get("height") or 0)
    if src_w <= 0 or src_h <= 0:
        raise ValueError(f"Dimensi video sumber tidak valid: {src_w}x{src_h}")

    duration = max(0.5, end - start)
    fps = float(meta.get("fps") or 30.0)
    out_fps = max(24.0, min(60.0, fps if fps > 0 else 30.0))

    if framing_mode not in ("stable", "follow"):
        raise ValueError("Unknown framing mode")
    if aspect_ratio not in OUTPUT_SIZES:
        raise ValueError("Unknown aspect ratio")
    width, height = OUTPUT_SIZES[aspect_ratio]
    stable = framing_mode == "stable"
    crop_chain, needs_pad = _crop_filter(src_w, src_h, keyframes, enable_reframe, stable=stable, width=width, height=height)

    parts = [crop_chain]
    if needs_pad:
        parts.append(_blur_pad_chain(width, height))
    if enable_zoom and not stable:
        parts.append(_zoom_filter(duration, peak_time_rel, out_fps, width=width, height=height))
    parts.append("setsar=1")
    if ass_path is not None and ass_path.exists():
        parts.append(f"ass='{_ass_filter_arg(ass_path, dst.parent)}'")
    parts.append("format=yuv420p")

    vf = ",".join(parts)

    args = [
        # Coarse seek before -i is fast; -ss after -i would decode from 0.
        "-ss", f"{max(0.0, start):.3f}",
        "-t", f"{duration:.3f}",
        "-i", str(src),
        "-vf", vf,
        "-r", f"{out_fps:.3f}",
        "-c:v", "libx264",
        "-preset", "medium",
        "-profile:v", "high",
        "-level", "4.1",
        "-b:v", OUT_VIDEO_BITRATE,
        "-maxrate", OUT_VIDEO_MAXRATE,
        "-bufsize", "16M",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", OUT_AUDIO_BITRATE,
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        "-shortest",
        str(dst),
    ]

    # Run with cwd=dst.parent so relative font/subtitle lookups resolve predictably.
    ffmpeg(args, cwd=dst.parent, timeout=1800)

    if not dst.exists() or dst.stat().st_size < 1024:
        raise RuntimeError(f"Render menghasilkan file tidak valid: {dst}")
    return dst
