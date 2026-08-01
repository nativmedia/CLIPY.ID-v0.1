"""Moment detection: score transcript windows on semantic + prosodic + visual cues.

The scorer builds candidate windows that respect sentence boundaries, scores each on
ten labelled dimensions, then greedily selects non-overlapping winners.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import numpy as np

from ..models import JobOptions, TranscriptSegment

# --------------------------------------------------------------------------
# Lexicons. Indonesian + English, since the target users work in both.
# --------------------------------------------------------------------------

_LEX: dict[str, tuple[str, ...]] = {
    "aha": (
        "ternyata", "rupanya", "jadi sebenarnya", "kuncinya", "rahasianya", "intinya",
        "the key is", "turns out", "it turns out", "the secret", "that's why", "itulah sebabnya",
        "aha", "realized", "sadar bahwa", "baru sadar", "point is", "the trick",
    ),
    "insight": (
        "karena itu", "oleh karena itu", "kesimpulannya", "artinya", "maksudnya",
        "therefore", "which means", "the reason", "alasannya", "prinsipnya", "pelajaran",
        "in other words", "dengan kata lain", "so basically", "pada dasarnya", "lesson",
    ),
    "surprising": (
        "ternyata", "mengejutkan", "tidak disangka", "padahal", "faktanya", "kenyataannya",
        "surprisingly", "shocking", "unbelievable", "you won't believe", "actually",
        "percaya atau tidak", "believe it or not", "gila", "wow", "astonishing",
        "bahkan", "even", "never", "tidak pernah", "pertama kali", "first time",
    ),
    "funny": (
        "lucu", "kocak", "ngakak", "haha", "hahaha", "wkwk", "wkwkwk", "becanda", "bercanda",
        "funny", "hilarious", "laugh", "laughter", "joke", "lol", "lmao", "konyol", "absurd",
    ),
    "emotional": (
        "sedih", "terharu", "menangis", "kehilangan", "sakit", "perjuangan", "susah",
        "emotional", "heartbreaking", "cried", "tears", "loss", "struggle", "painful",
        "takut", "afraid", "scared", "berat", "hancur", "trauma", "jatuh",
    ),
    "inspiring": (
        "semangat", "bangkit", "jangan menyerah", "percaya", "mimpi", "sukses", "berhasil",
        "inspiring", "never give up", "believe", "dream", "achieve", "motivation", "you can",
        "kamu bisa", "mulai sekarang", "start today", "berubah", "transform", "harapan", "hope",
    ),
    "controversial": (
        "tapi", "namun", "salah", "kontroversi", "berdebat", "tidak setuju", "masalahnya",
        "however", "but actually", "wrong", "controversial", "disagree", "myth", "mitos",
        "orang bilang", "people say", "sebenarnya tidak", "that's not true", "bohong", "hoax",
    ),
    "viral": (
        "harus tahu", "wajib", "penting banget", "jangan sampai", "ini yang", "cara",
        "you need to", "must know", "never do", "always do", "hack", "tips", "trik",
        "secret", "rahasia", "nomor satu", "number one", "terbaik", "best", "worst", "terburuk",
    ),
    "hook": (
        "bayangkan", "coba pikir", "pernahkah", "tahukah kamu", "apa yang terjadi",
        "imagine", "what if", "did you know", "have you ever", "let me tell you",
        "dengar ini", "listen", "perhatikan", "pertanyaannya", "the question is",
    ),
}

# Numbers and superlatives correlate strongly with shareable moments.
_NUM_RE = re.compile(
    r"\b\d+([.,]\d+)?\s*(%|persen|percent|juta|ribu|miliar|million|billion|k|x|kali)?\b", re.I
)
_QUESTION_RE = re.compile(r"\?")
_SUPERLATIVE = re.compile(
    r"\b(paling|ter\w+|most|best|worst|biggest|largest|smallest|first|last|only|satu-satunya)\b",
    re.I,
)

_STOPWORDS = {
    "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "pada", "adalah", "itu", "ini",
    "saya", "kamu", "kita", "mereka", "akan", "sudah", "tidak", "bisa", "ada", "juga",
    "atau", "kalau", "jadi", "karena", "dalam", "oleh", "bahwa", "nya", "aku", "dia",
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "is", "are", "was", "were", "be", "been", "it", "this", "that", "you", "i", "we",
    "they", "he", "she", "as", "so", "if", "then", "than", "have", "has", "had", "do",
    "does", "did", "will", "would", "can", "could", "not", "no", "yes", "my", "your",
    "gak", "nggak", "ya", "kan", "sih", "aja", "udah", "banget", "gitu", "nih", "deh",
}


@dataclass
class Candidate:
    start: float
    end: float
    text: str
    scores: dict[str, float] = field(default_factory=dict)
    total: float = 0.0
    labels: list[str] = field(default_factory=list)
    peak_time: float = 0.0

    @property
    def duration(self) -> float:
        return self.end - self.start


def _norm(text: str) -> str:
    return " " + re.sub(r"\s+", " ", text.lower()) + " "


def _lexical_hits(text_l: str, terms: tuple[str, ...]) -> int:
    return sum(1 for t in terms if t in text_l)


def _saturate(x: float, k: float = 1.0) -> float:
    """Map an unbounded count to 0..1 with diminishing returns."""
    return 1.0 - math.exp(-k * max(0.0, x))


# --------------------------------------------------------------------------
# Candidate generation
# --------------------------------------------------------------------------

def _sentence_units(segments: list[TranscriptSegment]) -> list[tuple[float, float, str]]:
    """Merge Whisper segments into sentence-ish units so clips don't cut mid-thought."""
    units: list[tuple[float, float, str]] = []
    buf_start: float | None = None
    buf_end = 0.0
    buf_text: list[str] = []

    for seg in segments:
        if buf_start is None:
            buf_start = seg.start
        buf_end = seg.end
        buf_text.append(seg.text.strip())
        joined = " ".join(buf_text).strip()
        if joined.endswith((".", "!", "?", "…")) and (buf_end - buf_start) >= 6.0:
            units.append((buf_start, buf_end, joined))
            buf_start, buf_text = None, []

    if buf_start is not None and buf_text:
        units.append((buf_start, buf_end, " ".join(buf_text).strip()))
    return units


def build_candidates(segments: list[TranscriptSegment], opts: JobOptions) -> list[Candidate]:
    """Sliding windows over sentence units, honoring min/max clip duration."""
    units = _sentence_units(segments)
    if not units:
        return []

    min_d = float(opts.min_clip_seconds)
    max_d = float(opts.max_clip_seconds)
    candidates: list[Candidate] = []

    for i in range(len(units)):
        start = units[i][0]
        texts: list[str] = []
        for j in range(i, len(units)):
            end = units[j][1]
            texts.append(units[j][2])
            dur = end - start
            if dur < min_d:
                continue
            if dur > max_d:
                break
            candidates.append(Candidate(start=start, end=end, text=" ".join(texts)))

    # Long sources explode combinatorially; keep the search space sane.
    if len(candidates) > 4000:
        step = len(candidates) // 4000 + 1
        candidates = candidates[::step]
    return candidates


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def score_candidate(
    cand: Candidate,
    *,
    audio_times: np.ndarray,
    audio_energy: np.ndarray,
    visual_times: np.ndarray,
    visual_motion: np.ndarray,
    visual_face: np.ndarray,
    source_duration: float,
    opts: JobOptions,
) -> None:
    """Populate cand.scores / cand.total / cand.labels in place."""
    from .audio_features import find_peak_time, window_stats

    text_l = _norm(cand.text)
    words = [w for w in re.findall(r"[a-zA-ZÀ-ɏ']+", text_l) if w not in _STOPWORDS]
    n_words = max(1, len(words))

    a = window_stats(audio_times, audio_energy, cand.start, cand.end)
    motion = window_stats(visual_times, visual_motion, cand.start, cand.end)
    face = window_stats(visual_times, visual_face, cand.start, cand.end)

    # --- prosody: loud + dynamic passages carry emphasis ---
    prosody = 0.55 * a["max"] + 0.25 * a["mean"] + 0.20 * min(1.0, a["std"] * 3.0)

    # --- speech density: dead air is a bad clip ---
    wps = n_words / max(1.0, cand.duration)
    density = _saturate(wps / 2.6, 2.0)

    # --- lexical dimensions ---
    lex = {label: _saturate(_lexical_hits(text_l, terms), 0.8) for label, terms in _LEX.items()}

    has_number = _saturate(len(_NUM_RE.findall(cand.text)), 0.7)
    has_question = _saturate(len(_QUESTION_RE.findall(cand.text)), 1.2)
    has_superlative = _saturate(len(_SUPERLATIVE.findall(cand.text)), 0.9)

    # --- position prior: openings hook, endings often trail off ---
    rel = cand.start / max(1.0, source_duration)
    position = 1.0 if rel < 0.12 else (0.85 if rel > 0.9 else 0.6 + 0.4 * (1.0 - abs(rel - 0.4)))

    # --- per-label composite scores (0..1) ---
    s: dict[str, float] = {
        "aha": 0.62 * lex["aha"] + 0.23 * prosody + 0.15 * density,
        "insight": 0.60 * lex["insight"] + 0.20 * density + 0.20 * has_number,
        "surprising": 0.50 * lex["surprising"] + 0.25 * has_number + 0.25 * prosody,
        "funny": 0.55 * lex["funny"] + 0.30 * max(0.0, a["range"]) + 0.15 * motion["mean"],
        "emotional": 0.58 * lex["emotional"] + 0.24 * prosody + 0.18 * (1.0 - density),
        "inspiring": 0.62 * lex["inspiring"] + 0.20 * prosody + 0.18 * density,
        "controversial": 0.60 * lex["controversial"] + 0.20 * prosody + 0.20 * has_superlative,
        "viral": 0.40 * lex["viral"] + 0.22 * has_number + 0.20 * has_superlative + 0.18 * prosody,
        "hook": 0.45 * lex["hook"] + 0.25 * has_question + 0.30 * position,
        "retention": 0.35 * density + 0.25 * face["mean"] + 0.20 * prosody + 0.20 * (1.0 - motion["std"]),
    }
    cand.scores = {k: round(v * 100, 1) for k, v in s.items()}

    # --- overall: best dimension dominates, breadth adds a bonus ---
    ranked = sorted(s.values(), reverse=True)
    best, second = ranked[0], (ranked[1] if len(ranked) > 1 else 0.0)
    breadth = sum(1 for v in s.values() if v >= 0.42)

    quality = 0.55 * best + 0.20 * second + 0.10 * _saturate(breadth / 3.0, 1.4)
    quality += 0.09 * density + 0.06 * face["mean"]

    # Prefer 20-45s: long enough to land a point, short enough to hold attention.
    d = cand.duration
    ideal = 1.0 if 20.0 <= d <= 45.0 else (0.82 if d < 20.0 else 0.88)
    quality *= ideal

    cand.total = round(max(0.0, min(1.0, quality)) * 100, 1)
    cand.labels = [k for k, v in sorted(s.items(), key=lambda kv: -kv[1]) if v >= 0.40][:3]
    if not cand.labels:
        cand.labels = [max(s, key=lambda k: s[k])]

    cand.peak_time = find_peak_time(audio_times, audio_energy, cand.start, cand.end)


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------

def select_clips(candidates: list[Candidate], opts: JobOptions) -> list[Candidate]:
    """Greedy non-overlapping selection, highest score first."""
    wanted = set(opts.moment_filter or [])
    pool = [c for c in candidates if c.total >= opts.min_score]
    if wanted:
        pool = [c for c in pool if wanted.intersection(c.labels)]

    # If the threshold is too strict, fall back to the best available so the
    # user always gets something rather than an empty grid.
    if not pool:
        pool = sorted(candidates, key=lambda c: -c.total)[: opts.max_clips * 3]
        if wanted:
            pool = [c for c in pool if wanted.intersection(c.labels)] or pool

    pool.sort(key=lambda c: -c.total)

    chosen: list[Candidate] = []
    for cand in pool:
        if len(chosen) >= opts.max_clips:
            break
        # Reject anything overlapping an already-picked clip by >15%.
        clash = any(
            (min(cand.end, ch.end) - max(cand.start, ch.start))
            > 0.15 * min(cand.duration, ch.duration)
            for ch in chosen
        )
        if not clash:
            chosen.append(cand)

    chosen.sort(key=lambda c: c.start)
    return chosen


def extract_keywords(text: str, limit: int = 10) -> list[str]:
    """Frequency-ranked content words, used for SEO assets."""
    words = re.findall(r"[a-zA-ZÀ-ɏ][a-zA-ZÀ-ɏ'-]{2,}", text.lower())
    freq: dict[str, int] = {}
    for w in words:
        if w in _STOPWORDS or len(w) < 4:
            continue
        freq[w] = freq.get(w, 0) + 1

    # Bigrams surface topical phrases single words miss.
    tokens = [w for w in words if w not in _STOPWORDS and len(w) > 3]
    for a, b in zip(tokens, tokens[1:]):
        bg = f"{a} {b}"
        freq[bg] = freq.get(bg, 0) + 2

    ranked = sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))
    return [w for w, c in ranked if c > 1][:limit] or [w for w, _ in ranked[:limit]]
