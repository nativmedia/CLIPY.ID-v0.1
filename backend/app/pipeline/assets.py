"""Supporting-asset generation: title, hook, SEO description, hashtags, thumbnail.

Everything here is deterministic and offline - the spec requires no external calls
after the initial video download. Templates are keyword-driven and language-aware
(Indonesian / English).
"""
from __future__ import annotations

import re
from pathlib import Path

from ..models import ClipAssets, MOMENT_LABELS_ID
from .scoring import extract_keywords

_MAX_TITLE = 100
_MAX_HOOK_WORDS = 15
_MAX_DESC = 5000
_MAX_HASHTAGS = 15


# --------------------------------------------------------------------------
# Text helpers
# --------------------------------------------------------------------------

def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?…])\s+", (text or "").strip())
    return [p.strip() for p in parts if len(p.strip()) > 2]


def _titlecase(s: str) -> str:
    small = {"dan", "di", "ke", "dari", "yang", "untuk", "the", "a", "an", "of", "in", "to", "for"}
    words = s.split()
    out = []
    for i, w in enumerate(words):
        out.append(w.capitalize() if (i == 0 or w.lower() not in small) else w.lower())
    return " ".join(out)


def _truncate(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    if " " in cut:
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip(" ,.;:-") + "…"


def _is_indonesian(lang: str | None, text: str) -> bool:
    if lang:
        return lang.lower().startswith("id")
    markers = ("yang", "dan", "tidak", "dengan", "untuk", "adalah", "kita", "saya", "bisa")
    low = f" {text.lower()} "
    return sum(1 for m in markers if f" {m} " in low) >= 2


# --------------------------------------------------------------------------
# Title / hook
# --------------------------------------------------------------------------

_TITLE_TEMPLATES_ID: dict[str, tuple[str, ...]] = {
    "aha": ("Ternyata Ini Rahasia {kw}", "Akhirnya Terungkap: {kw}", "Ini yang Sebenarnya Terjadi pada {kw}"),
    "insight": ("Cara Kerja {kw} yang Jarang Dijelaskan", "Prinsip {kw} yang Harus Kamu Tahu", "Memahami {kw} dalam 1 Menit"),
    "surprising": ("Fakta Mengejutkan tentang {kw}", "Kamu Pasti Tidak Menyangka soal {kw}", "{kw}: Faktanya Tidak Seperti Dugaanmu"),
    "funny": ("Momen Kocak saat Bahas {kw}", "Ngakak! {kw} Ternyata Begini", "Bagian Lucu dari {kw}"),
    "emotional": ("Cerita Menyentuh di Balik {kw}", "Sisi Emosional dari {kw}", "Perjuangan Nyata soal {kw}"),
    "inspiring": ("Motivasi Kuat tentang {kw}", "Pelajaran Hidup dari {kw}", "Ini Alasan Kamu Harus Mulai {kw}"),
    "controversial": ("Kontroversi {kw} yang Jarang Dibahas", "Kenapa Banyak Orang Salah soal {kw}", "Mitos {kw} yang Perlu Diluruskan"),
    "viral": ("{kw} yang Lagi Ramai Dibahas", "Wajib Tahu: {kw}", "{kw} dalam 60 Detik"),
    "hook": ("Pernahkah Kamu Berpikir soal {kw}?", "Bayangkan Kalau {kw}", "Apa Jadinya Jika {kw}?"),
    "retention": ("Penjelasan Lengkap {kw}", "{kw} Dijelaskan Singkat dan Jelas", "Semua tentang {kw}"),
}

_TITLE_TEMPLATES_EN: dict[str, tuple[str, ...]] = {
    "aha": ("The Real Secret Behind {kw}", "Finally Revealed: {kw}", "Here's What Actually Happens With {kw}"),
    "insight": ("How {kw} Really Works", "The {kw} Principle You Should Know", "Understanding {kw} in 60 Seconds"),
    "surprising": ("Surprising Facts About {kw}", "You Won't Believe This About {kw}", "{kw}: Not What You Expected"),
    "funny": ("The Funniest Take on {kw}", "This {kw} Moment Is Hilarious", "When {kw} Goes Wrong"),
    "emotional": ("The Story Behind {kw}", "The Emotional Side of {kw}", "A Real Struggle With {kw}"),
    "inspiring": ("Powerful Motivation About {kw}", "A Life Lesson From {kw}", "Why You Should Start {kw} Today"),
    "controversial": ("The {kw} Controversy Nobody Talks About", "Why Everyone Is Wrong About {kw}", "The {kw} Myth, Debunked"),
    "viral": ("{kw} Everyone Is Talking About", "You Need to Know This About {kw}", "{kw} in 60 Seconds"),
    "hook": ("Have You Ever Thought About {kw}?", "Imagine If {kw}", "What If {kw}?"),
    "retention": ("{kw} Fully Explained", "{kw}, Made Simple", "Everything About {kw}"),
}


def _pick_keyword(keywords: list[str], fallback: str) -> str:
    for kw in keywords:
        if 4 <= len(kw) <= 34:
            return _titlecase(kw)
    return _titlecase(fallback)


def make_title(text: str, labels: list[str], keywords: list[str], *, indo: bool, index: int) -> str:
    templates = _TITLE_TEMPLATES_ID if indo else _TITLE_TEMPLATES_EN
    label = labels[0] if labels else "retention"
    bank = templates.get(label, templates["retention"])
    kw = _pick_keyword(keywords, _first_words(text, 4))
    title = bank[index % len(bank)].format(kw=kw)
    return _truncate(title, _MAX_TITLE)


def _first_words(text: str, n: int) -> str:
    words = re.findall(r"[\w'-]+", text)
    return " ".join(words[:n]) if words else "Topik Ini"


def make_hook(text: str, *, indo: bool) -> str:
    """Strongest opening line, <= 15 words."""
    sents = _sentences(text)
    if not sents:
        return "Simak sampai habis!" if indo else "Watch till the end!"

    # Prefer a question or a short punchy sentence from the first few.
    best = None
    for s in sents[:4]:
        wc = len(s.split())
        if "?" in s and wc <= _MAX_HOOK_WORDS:
            best = s
            break
        if best is None and 4 <= wc <= _MAX_HOOK_WORDS:
            best = s
    if best is None:
        best = " ".join(sents[0].split()[:_MAX_HOOK_WORDS])

    words = best.split()
    if len(words) > _MAX_HOOK_WORDS:
        best = " ".join(words[:_MAX_HOOK_WORDS])
    return best.strip().rstrip(",;:")


# --------------------------------------------------------------------------
# Description / tags
# --------------------------------------------------------------------------

def make_description(
    text: str, title: str, hook: str, keywords: list[str], labels: list[str],
    *, indo: bool, source_url: str = "", source_title: str = "",
) -> str:
    summary = _truncate(" ".join(_sentences(text)[:3]) or text, 600)
    label_names = ", ".join(MOMENT_LABELS_ID.get(l, l) for l in labels[:3])
    kw_line = ", ".join(keywords[:8])

    if indo:
        body = (
            f"{hook}\n\n"
            f"{summary}\n\n"
            f"Di klip ini kita bahas {kw_line or 'topik menarik'} — "
            f"momen yang kami tandai sebagai: {label_names}.\n\n"
            f"👉 Suka konten seperti ini? Follow untuk update harian, "
            f"like kalau bermanfaat, dan share ke teman yang butuh info ini!\n\n"
            f"💬 Menurut kamu gimana? Tulis pendapatmu di komentar.\n"
        )
        if source_title or source_url:
            body += f"\n🎬 Sumber: {source_title}\n{source_url}\n"
        body += "\n" + " ".join(f"#{_slug_tag(k)}" for k in keywords[:6])
    else:
        body = (
            f"{hook}\n\n"
            f"{summary}\n\n"
            f"In this clip we cover {kw_line or 'key ideas'} — "
            f"tagged as: {label_names}.\n\n"
            f"👉 Enjoyed this? Follow for daily clips, drop a like, "
            f"and share it with someone who needs to see it!\n\n"
            f"💬 What do you think? Let us know in the comments.\n"
        )
        if source_title or source_url:
            body += f"\n🎬 Source: {source_title}\n{source_url}\n"
        body += "\n" + " ".join(f"#{_slug_tag(k)}" for k in keywords[:6])

    return _truncate(body, _MAX_DESC)


def _slug_tag(text: str) -> str:
    return re.sub(r"[^0-9a-zA-Z]+", "", (text or "").title()) or "clip"


_BASE_HASHTAGS_ID = ("shorts", "viral", "fyp", "reels", "edukasi", "infopenting")
_BASE_HASHTAGS_EN = ("shorts", "viral", "fyp", "reels", "learnontiktok", "explained")


def make_hashtags(keywords: list[str], labels: list[str], *, indo: bool) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()

    for kw in keywords[:8]:
        t = _slug_tag(kw)
        if len(t) >= 3 and t.lower() not in seen:
            seen.add(t.lower())
            tags.append(f"#{t}")

    for label in labels[:2]:
        t = _slug_tag(MOMENT_LABELS_ID.get(label, label))
        if t.lower() not in seen:
            seen.add(t.lower())
            tags.append(f"#{t}")

    for b in (_BASE_HASHTAGS_ID if indo else _BASE_HASHTAGS_EN):
        if b.lower() not in seen and len(tags) < _MAX_HASHTAGS:
            seen.add(b.lower())
            tags.append(f"#{b}")

    return tags[:_MAX_HASHTAGS]


def make_platform_tags(keywords: list[str], *, indo: bool) -> dict[str, list[str]]:
    base = [k for k in keywords[:10] if len(k) >= 3]
    extra_id = ["shorts indonesia", "video edukasi", "konten viral"]
    extra_en = ["short video", "educational", "viral clip"]
    extra = extra_id if indo else extra_en
    return {
        "youtube_shorts": (base + extra)[:15],
        "tiktok": (base + ["fyp", "foryou"])[:12],
        "instagram_reels": (base + ["reels", "explore"])[:12],
        "facebook_reels": (base + ["reels", "video"])[:12],
    }


def build_assets(
    *,
    text: str,
    labels: list[str],
    index: int,
    language: str | None,
    source_url: str = "",
    source_title: str = "",
    thumbnail_url: str | None = None,
) -> ClipAssets:
    indo = _is_indonesian(language, text)
    keywords = extract_keywords(text, 10)

    title = make_title(text, labels, keywords, indo=indo, index=index)
    hook = make_hook(text, indo=indo)
    description = make_description(
        text, title, hook, keywords, labels,
        indo=indo, source_url=source_url, source_title=source_title,
    )

    return ClipAssets(
        title=title,
        hook=hook,
        description=description,
        hashtags=make_hashtags(keywords, labels, indo=indo),
        tags=keywords[:12],
        keywords=keywords[:10],
        thumbnail_url=thumbnail_url,
        platform_tags=make_platform_tags(keywords, indo=indo),
    )


# --------------------------------------------------------------------------
# Thumbnail
# --------------------------------------------------------------------------

def render_thumbnail(
    src_video: str | Path, dst: str | Path, *, timestamp: float, overlay_text: str = ""
) -> Path:
    """Grab the peak frame, crop to 9:16, and burn a readable headline overlay."""
    from .media import ffmpeg  # local import keeps module import cheap

    dst = Path(dst)
    vf = [
        f"scale=720:-2:flags=lanczos",
        "crop=720:min(1280\\,ih):(iw-720)/2:0",
    ]

    if overlay_text:
        text = _truncate(overlay_text, 60)
        # drawtext needs its own escaping for quotes, colons and percent signs.
        safe = (
            text.replace("\\", "")
            .replace(":", "\\:")
            .replace("'", "")
            .replace("%", "")
        )
        vf.append(
            "drawbox=x=0:y=ih-260:w=iw:h=260:color=black@0.55:t=fill"
        )
        vf.append(
            f"drawtext=text='{safe}':fontcolor=white:fontsize=46:"
            f"box=0:x=(w-text_w)/2:y=h-200:line_spacing=8:"
            f"borderw=3:bordercolor=black@0.9"
        )

    try:
        ffmpeg([
            "-ss", f"{max(0.0, timestamp):.3f}",
            "-i", str(src_video),
            "-frames:v", "1",
            "-vf", ",".join(vf),
            "-q:v", "2",
            str(dst),
        ], timeout=120)
    except Exception:  # noqa: BLE001 - drawtext needs a font; fall back to a plain frame
        ffmpeg([
            "-ss", f"{max(0.0, timestamp):.3f}",
            "-i", str(src_video),
            "-frames:v", "1",
            "-vf", "scale=720:-2:flags=lanczos",
            "-q:v", "2",
            str(dst),
        ], timeout=120)

    return dst
