"""Subtitle generation in ASS format, styled for vertical short-form video."""
from __future__ import annotations

from pathlib import Path

from ..models import TranscriptSegment, TranscriptWord

# Canvas matches the output frame so font sizes map 1:1.
PLAY_W, PLAY_H = 720, 1280

# WCAG AA contrast: white text on dark outline/box stays >= 4.5:1 in all styles.
_STYLES: dict[str, str] = {
    # name, font, size, primary, secondary, outline, back, bold,...
    "outline": (
        "Style: Main,Arial Black,64,&H00FFFFFF,&H000000FF,&H00101010,&H90000000,"
        "-1,0,0,0,100,100,0,0,1,6,2,2,60,60,190,1"
    ),
    "shadow": (
        "Style: Main,Arial Black,64,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,"
        "-1,0,0,0,100,100,0,0,1,3,6,2,60,60,190,1"
    ),
    "box": (
        "Style: Main,Arial Black,60,&H00FFFFFF,&H000000FF,&H00000000,&HC0000000,"
        "-1,0,0,0,100,100,0,0,3,4,0,2,60,60,190,1"
    ),
}

# Highlight colour for the currently spoken word (BGR order in ASS).
_HIGHLIGHT = "&H0033D6FF"  # amber


def _ts(seconds: float) -> str:
    """Format seconds as ASS timestamp H:MM:SS.cc"""
    s = max(0.0, seconds)
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    return f"{h:d}:{m:02d}:{sec:05.2f}"


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").strip()


def _chunk_words(
    words: list[TranscriptWord], *, max_chars: int = 26, max_words: int = 5, max_dur: float = 2.4
) -> list[list[TranscriptWord]]:
    """Group words into short caption lines that fit a vertical frame."""
    chunks: list[list[TranscriptWord]] = []
    cur: list[TranscriptWord] = []
    cur_chars = 0

    for w in words:
        text = w.text.strip()
        if not text:
            continue
        would_be = cur_chars + len(text) + (1 if cur else 0)
        too_long = cur and (
            would_be > max_chars
            or len(cur) >= max_words
            or (w.end - cur[0].start) > max_dur
        )
        if too_long:
            chunks.append(cur)
            cur, cur_chars = [w], len(text)
        else:
            cur.append(w)
            cur_chars = would_be

        # Punctuation is a natural caption break.
        if text.endswith((".", "!", "?", ",", "…")) and len(cur) >= 2:
            chunks.append(cur)
            cur, cur_chars = [], 0

    if cur:
        chunks.append(cur)
    return chunks


def _split_plain(seg: TranscriptSegment, max_chars: int = 26) -> list[tuple[float, float, str]]:
    """Fallback when word timings are missing: split evenly by character count."""
    words = seg.text.split()
    if not words:
        return []
    lines: list[str] = []
    cur = ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > max_chars:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)

    total = max(0.1, seg.end - seg.start)
    per = total / len(lines)
    return [(seg.start + i * per, seg.start + (i + 1) * per, ln) for i, ln in enumerate(lines)]


def build_ass(
    segments: list[TranscriptSegment],
    *,
    clip_start: float,
    clip_end: float,
    out_path: str | Path,
    style: str = "outline",
    highlight_words: bool = True,
    width: int = PLAY_W,
    height: int = PLAY_H,
) -> Path:
    """Write an ASS subtitle file covering [clip_start, clip_end], time-shifted to 0."""
    out_path = Path(out_path)
    style_line = _STYLES.get(style, _STYLES["outline"])
    fields = style_line.split(",")
    factor = min(width / PLAY_W, height / PLAY_H)
    for index in (2, 16, 17, 19, 20, 21):
        fields[index] = str(max(0, round(int(fields[index]) * factor)))
    style_line = ",".join(fields)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
{style_line}

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""

    events: list[str] = []

    for seg in segments:
        # Keep any segment that overlaps the clip window.
        if seg.end <= clip_start or seg.start >= clip_end:
            continue

        if seg.words:
            in_window = [w for w in seg.words if w.end > clip_start and w.start < clip_end]
            if not in_window:
                continue
            for chunk in _chunk_words(in_window):
                if not chunk:
                    continue
                c_start = max(clip_start, chunk[0].start) - clip_start
                c_end = min(clip_end, chunk[-1].end) - clip_start
                if c_end - c_start < 0.08:
                    c_end = c_start + 0.08

                if highlight_words and len(chunk) > 1:
                    # Per-word colour flip via \t transforms - reads as a karaoke pop.
                    parts: list[str] = []
                    for w in chunk:
                        w_s = max(0.0, w.start - clip_start - c_start)
                        w_e = max(w_s + 0.05, w.end - clip_start - c_start)
                        ms_s, ms_e = int(w_s * 1000), int(w_e * 1000)
                        parts.append(
                            f"{{\\c&H00FFFFFF&"
                            f"\\t({ms_s},{ms_s + 40},\\c{_HIGHLIGHT}&)"
                            f"\\t({ms_e},{ms_e + 40},\\c&H00FFFFFF&)}}"
                            f"{_escape(w.text)}"
                        )
                    text = " ".join(parts)
                else:
                    text = _escape(" ".join(w.text for w in chunk))

                if text:
                    events.append(
                        f"Dialogue: 0,{_ts(c_start)},{_ts(c_end)},Main,,0,0,0,,{text}"
                    )
        else:
            for s, e, line in _split_plain(seg):
                if e <= clip_start or s >= clip_end:
                    continue
                c_start = max(clip_start, s) - clip_start
                c_end = min(clip_end, e) - clip_start
                if c_end - c_start < 0.08:
                    continue
                events.append(
                    f"Dialogue: 0,{_ts(c_start)},{_ts(c_end)},Main,,0,0,0,,{_escape(line)}"
                )

    out_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return out_path


def clip_text(segments: list[TranscriptSegment], start: float, end: float) -> str:
    """Plain transcript text for a clip window."""
    parts = [s.text.strip() for s in segments if s.end > start and s.start < end]
    return " ".join(p for p in parts if p).strip()
