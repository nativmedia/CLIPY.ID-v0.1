"""Job orchestration: download -> transcribe -> analyze -> render -> assets."""
from __future__ import annotations

import logging
import shutil
import traceback
from pathlib import Path

from ..config import DOWNLOAD_DIR, MAX_SOURCE_SECONDS, job_dir
from ..models import Clip, Job, JobStage
from ..store import STORE
from . import assets as assets_mod
from . import audio_features, downloader, framing, render, scoring, subtitles, vision
from .media import extract_audio_wav, probe_media
from .transcribe import transcribe

log = logging.getLogger("clipper.orchestrator")


class Cancelled(RuntimeError):
    pass


# Weight of each stage in the overall progress bar.
_STAGE_SPAN = {
    JobStage.DOWNLOADING: (0.0, 20.0),
    JobStage.TRANSCRIBING: (20.0, 50.0),
    JobStage.ANALYZING: (50.0, 68.0),
    JobStage.RENDERING: (68.0, 100.0),
}


def _scaled(stage: str, pct: float) -> float:
    lo, hi = _STAGE_SPAN.get(stage, (0.0, 100.0))
    return lo + (hi - lo) * max(0.0, min(100.0, pct)) / 100.0


def run_job(job_id: str) -> None:
    """Entry point executed on a worker thread."""
    job = STORE.get(job_id)
    if job is None:
        return

    workdir = job_dir(job_id)
    clips_dir = workdir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    try:
        _run(job, workdir, clips_dir)
    except Cancelled:
        STORE.update(job_id, stage=JobStage.CANCELLED, message="Job dibatalkan oleh pengguna.")
    except Exception as exc:  # noqa: BLE001 - surface any failure to the UI
        log.exception("Job %s gagal", job_id)
        STORE.update(
            job_id,
            stage=JobStage.FAILED,
            error=str(exc),
            message=f"Gagal: {exc}",
        )
        (workdir / "error.log").write_text(traceback.format_exc(), encoding="utf-8")
    finally:
        STORE.emit_done(job_id)


def _check_cancel(job_id: str) -> None:
    if STORE.is_cancelled(job_id):
        raise Cancelled()


def _run(job: Job, workdir: Path, clips_dir: Path) -> None:
    jid = job.id
    opts = job.options

    # ---------------- 1. Download ----------------
    STORE.update(jid, stage=JobStage.DOWNLOADING, percent=0.0, message="Memulai unduhan...")

    def dl_progress(pct: float, msg: str) -> None:
        _check_cancel(jid)
        STORE.update(jid, percent=_scaled(JobStage.DOWNLOADING, pct), message=msg)

    video_path, source = downloader.download(job.url, DOWNLOAD_DIR, dl_progress)
    _check_cancel(jid)

    meta = probe_media(video_path)
    if meta["duration"] <= 0:
        raise RuntimeError("Durasi video tidak terbaca; file mungkin rusak.")
    if not meta["has_audio"]:
        raise RuntimeError("Video tidak memiliki trek audio, sehingga tidak bisa dianalisis.")

    source.duration = source.duration or meta["duration"]
    source.width = source.width or meta["width"]
    source.height = source.height or meta["height"]
    source.fps = source.fps or meta["fps"]
    STORE.update(jid, source=source, message=f"Video siap: {source.title} ({meta['duration']:.0f}s)")

    duration = min(meta["duration"], float(MAX_SOURCE_SECONDS))

    # ---------------- 2. Transcribe ----------------
    STORE.update(
        jid, stage=JobStage.TRANSCRIBING,
        percent=_scaled(JobStage.TRANSCRIBING, 0), message="Mengekstrak audio...",
    )
    audio_path = extract_audio_wav(video_path, workdir / "audio.wav")
    _check_cancel(jid)

    def tr_progress(pct: float, msg: str) -> None:
        _check_cancel(jid)
        STORE.update(jid, percent=_scaled(JobStage.TRANSCRIBING, pct), message=msg)

    segments, detected_lang = transcribe(
        audio_path,
        duration=duration,
        language=opts.language,
        model_name=opts.whisper_model,
        on_progress=tr_progress,
    )
    STORE.update(jid, detected_language=detected_lang)
    _check_cancel(jid)

    # ---------------- 3. Analyze ----------------
    STORE.update(
        jid, stage=JobStage.ANALYZING,
        percent=_scaled(JobStage.ANALYZING, 0), message="Menganalisis audio & visual...",
    )

    samples, sr = audio_features.load_wav_mono(audio_path)
    a_times, a_energy = audio_features.energy_envelope(samples, sr)
    del samples  # free the decoded PCM before the video scan allocates frames

    def vis_progress(pct: float, msg: str) -> None:
        _check_cancel(jid)
        STORE.update(jid, percent=_scaled(JobStage.ANALYZING, pct * 0.8), message=msg)

    scan = vision.scan_video(
        video_path, duration=duration, sample_fps=2.0, on_progress=vis_progress
    )
    _check_cancel(jid)
    shot_cuts = []
    if opts.enable_reframe and opts.framing_mode == "stable":
        STORE.update(jid, message="Mendeteksi pergantian shot untuk framing tetap...")
        shot_cuts = framing.detect_shot_cuts(video_path)
        _check_cancel(jid)

    STORE.update(
        jid, percent=_scaled(JobStage.ANALYZING, 85), message="Menilai kandidat momen..."
    )
    candidates = scoring.build_candidates(segments, opts)
    if not candidates:
        raise RuntimeError(
            "Tidak ada segmen bicara yang cukup panjang untuk dijadikan klip. "
            "Coba turunkan 'durasi minimal klip'."
        )

    for cand in candidates:
        scoring.score_candidate(
            cand,
            audio_times=a_times,
            audio_energy=a_energy,
            visual_times=scan.times,
            visual_motion=scan.motion,
            visual_face=scan.face_presence,
            source_duration=duration,
            opts=opts,
        )

    chosen = scoring.select_clips(candidates, opts)
    if not chosen:
        raise RuntimeError("Tidak ada klip yang memenuhi kriteria skor. Turunkan ambang skor minimal.")

    STORE.update(
        jid,
        percent=_scaled(JobStage.ANALYZING, 100),
        message=f"{len(chosen)} klip terpilih dari {len(candidates)} kandidat.",
    )
    _check_cancel(jid)

    # ---------------- 4. Render ----------------
    STORE.update(jid, stage=JobStage.RENDERING, percent=_scaled(JobStage.RENDERING, 0))

    results: list[Clip] = []
    total = len(chosen)

    for i, cand in enumerate(chosen):
        _check_cancel(jid)
        base_pct = i / total * 100.0
        STORE.update(
            jid,
            percent=_scaled(JobStage.RENDERING, base_pct),
            message=f"Render klip {i + 1}/{total} ({cand.duration:.0f}s, skor {cand.total:.0f})...",
        )

        clip_id = f"clip{i + 1:02d}"
        text = subtitles.clip_text(segments, cand.start, cand.end)

        ass_path = clips_dir / f"{clip_id}.ass"
        subtitles.build_ass(
            segments,
            clip_start=cand.start,
            clip_end=cand.end,
            out_path=ass_path,
            style=opts.subtitle_style,
        )

        if not opts.enable_reframe:
            keyframes = []
        elif opts.framing_mode == "stable":
            keyframes = framing.build_stable_track(
                scan.face_centers, start=cand.start, end=cand.end, shot_cuts=shot_cuts
            )
        else:
            keyframes = vision.build_reframe_track(scan.face_centers, start=cand.start, end=cand.end)

        video_out = clips_dir / f"{clip_id}.mp4"
        try:
            render.render_clip(
                video_path,
                video_out,
                start=cand.start,
                end=cand.end,
                ass_path=ass_path,
                keyframes=keyframes,
                peak_time_rel=max(0.0, cand.peak_time - cand.start),
                enable_zoom=opts.enable_zoom,
                enable_reframe=opts.enable_reframe,
                framing_mode=opts.framing_mode,
                src_meta=meta,
            )
        except Exception as exc:  # noqa: BLE001 - one bad clip must not kill the job
            log.warning("Klip %s gagal dirender: %s", clip_id, exc)
            STORE.update(jid, message=f"Klip {i + 1} gagal dirender ({exc}); dilewati.")
            continue

        # Read the rendered clip so thumbnails preserve the selected composition.
        thumb_out = clips_dir / f"{clip_id}.jpg"
        try:
            assets_mod.render_thumbnail(
                video_out, thumb_out,
                timestamp=min(max(0.0, cand.peak_time - cand.start), max(0.0, cand.duration - 0.1)),
                overlay_text=""
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Thumbnail %s gagal: %s", clip_id, exc)
            thumb_out = None

        results.append(
            Clip(
                id=clip_id,
                index=i,
                start=round(cand.start, 3),
                end=round(cand.end, 3),
                duration=round(cand.duration, 3),
                score=int(round(cand.total)),
                labels=cand.labels,
                transcript=text,
                video_url=f"/api/jobs/{jid}/clips/{clip_id}.mp4",
                thumbnail_url=(f"/api/jobs/{jid}/clips/{clip_id}.jpg" if thumb_out else None),
                subtitle_url=f"/api/jobs/{jid}/clips/{clip_id}.ass",
                face_coverage=vision.face_coverage(scan, cand.start, cand.end),
            )
        )
        STORE.update(jid, clips=list(results))

    if not results:
        raise RuntimeError("Semua klip gagal dirender. Periksa instalasi ffmpeg.")

    # ---------------- 5. Cleanup ----------------
    try:
        audio_path.unlink(missing_ok=True)
    except OSError:
        pass

    if not opts.keep_source:
        try:
            Path(video_path).unlink(missing_ok=True)
        except OSError:
            pass
    else:
        # Keep the source so the user can re-cut clip ranges without re-downloading.
        STORE.update(jid, message="File sumber disimpan untuk penyuntingan ulang.")

    STORE.update(
        jid,
        stage=JobStage.DONE,
        percent=100.0,
        clips=results,
        message=f"Selesai! {len(results)} klip siap dipratinjau.",
    )


# --------------------------------------------------------------------------
# On-demand asset generation for user-selected clips (step 7 of the spec)
# --------------------------------------------------------------------------

def generate_assets_for(job_id: str, clip_ids: list[str]) -> list[Clip]:
    job = STORE.get(job_id)
    if job is None:
        raise ValueError("Job tidak ditemukan")

    workdir = job_dir(job_id)
    clips_dir = workdir / "clips"

    updated: list[Clip] = []
    for clip in job.clips:
        if clip.id not in clip_ids:
            updated.append(clip)
            continue

        thumb_url = clip.thumbnail_url
        built = assets_mod.build_assets(
            text=clip.transcript,
            labels=clip.labels,
            index=clip.index,
            language=job.detected_language,
            source_url=(job.source.webpage_url if job.source else job.url),
            source_title=(job.source.title if job.source else ""),
            thumbnail_url=thumb_url,
        )

        # Re-render the thumbnail with the generated headline burned in.
        rendered_video = clips_dir / f"{clip.id}.mp4"
        if rendered_video.exists():
            peak = (clip.end - clip.start) * 0.35
            branded = clips_dir / f"{clip.id}_thumb.jpg"
            try:
                assets_mod.render_thumbnail(
                    rendered_video, branded, timestamp=peak, overlay_text=built.hook or built.title
                )
                built.thumbnail_url = f"/api/jobs/{job_id}/clips/{clip.id}_thumb.jpg"
            except Exception as exc:  # noqa: BLE001
                log.warning("Thumbnail berlabel gagal untuk %s: %s", clip.id, exc)

        clip.assets = built
        clip.selected = True
        updated.append(clip)

    STORE.update(job_id, clips=updated, message=f"Aset dibuat untuk {len(clip_ids)} klip.")
    return updated


def _find_source(job: Job) -> Path | None:
    if not job.source:
        return None
    for p in DOWNLOAD_DIR.glob("*"):
        if p.is_file() and p.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov"}:
            # Match by the yt-dlp id embedded in the filename when possible.
            if job.source.webpage_url and p.stem in job.source.webpage_url:
                return p
    candidates = sorted(
        (p for p in DOWNLOAD_DIR.glob("*.mp4") if p.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def cleanup_job(job_id: str) -> None:
    shutil.rmtree(job_dir(job_id), ignore_errors=True)
