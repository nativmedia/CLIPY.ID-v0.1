"""Clipper backend: FastAPI app, REST routes and the progress WebSocket."""
from __future__ import annotations

import asyncio
import logging
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import (
    DATA_DIR,
    DOWNLOAD_DIR,
    FRONTEND_DIST,
    JOBS_DIR,
    TOOLING,
    ensure_dirs,
    job_dir,
)
from .models import CreateJobRequest, JobStage, MOMENT_LABELS_ID
from .pipeline import orchestrator
from .pipeline.downloader import validate_url
from .store import STORE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("clipper")

ensure_dirs()

# Video work is CPU-bound and long-running; keep it off the event loop.
EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="clipper-job")

app = FastAPI(title="Clipper API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@app.on_event("startup")
async def _startup() -> None:
    STORE.bind_loop(asyncio.get_running_loop())
    log.info("Clipper siap. ffmpeg=%s", TOOLING.ffmpeg or "TIDAK DITEMUKAN")


@app.on_event("shutdown")
async def _shutdown() -> None:
    EXECUTOR.shutdown(wait=False, cancel_futures=True)


# --------------------------------------------------------------------------
# Health / metadata
# --------------------------------------------------------------------------

@api.get("/health")
async def health() -> dict:
    def _has(mod: str) -> bool:
        import importlib.util

        return importlib.util.find_spec(mod) is not None

    return {
        "status": "ok",
        "ffmpeg": bool(TOOLING.ffmpeg),
        "ffprobe": bool(TOOLING.ffprobe),
        "yt_dlp": _has("yt_dlp"),
        "faster_whisper": _has("faster_whisper"),
        "opencv": _has("cv2"),
        "numpy": _has("numpy"),
        "data_dir": str(DATA_DIR),
    }


@api.get("/moment-labels")
async def moment_labels() -> dict:
    return {"labels": [{"key": k, "name": v} for k, v in MOMENT_LABELS_ID.items()]}


@api.post("/validate-url")
async def check_url(payload: dict) -> dict:
    url = (payload or {}).get("url", "")
    return {"valid": validate_url(url)}


# --------------------------------------------------------------------------
# Jobs
# --------------------------------------------------------------------------

@api.post("/jobs")
async def create_job(req: CreateJobRequest) -> dict:
    if not validate_url(req.url):
        raise HTTPException(400, "URL YouTube tidak valid.")
    if not TOOLING.ok:
        raise HTTPException(
            500, "ffmpeg/ffprobe tidak ditemukan. Install ffmpeg dan tambahkan ke PATH."
        )
    if req.options.min_clip_seconds >= req.options.max_clip_seconds:
        raise HTTPException(400, "Durasi minimal klip harus lebih kecil dari durasi maksimal.")

    job = STORE.create(req.url, req.options)
    EXECUTOR.submit(orchestrator.run_job, job.id)
    return job.model_dump()


@api.get("/jobs")
async def list_jobs() -> dict:
    return {"jobs": [j.model_dump() for j in STORE.list()]}


@api.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    job = STORE.get(job_id)
    if job is None:
        raise HTTPException(404, "Job tidak ditemukan")
    return job.model_dump()


@api.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict:
    if STORE.get(job_id) is None:
        raise HTTPException(404, "Job tidak ditemukan")
    STORE.request_cancel(job_id)
    return {"ok": True}


@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str) -> dict:
    if STORE.get(job_id) is None:
        raise HTTPException(404, "Job tidak ditemukan")
    STORE.request_cancel(job_id)
    STORE.delete(job_id)
    orchestrator.cleanup_job(job_id)
    return {"ok": True}


@api.post("/jobs/{job_id}/assets")
async def make_assets(job_id: str, payload: dict) -> dict:
    job = STORE.get(job_id)
    if job is None:
        raise HTTPException(404, "Job tidak ditemukan")
    if job.stage != JobStage.DONE:
        raise HTTPException(409, "Job belum selesai diproses.")

    clip_ids = (payload or {}).get("clip_ids") or []
    if not clip_ids:
        raise HTTPException(400, "Pilih minimal satu klip.")

    known = {c.id for c in job.clips}
    unknown = [c for c in clip_ids if c not in known]
    if unknown:
        raise HTTPException(400, f"Klip tidak dikenal: {', '.join(unknown)}")

    loop = asyncio.get_running_loop()
    clips = await loop.run_in_executor(
        EXECUTOR, orchestrator.generate_assets_for, job_id, clip_ids
    )
    return {"clips": [c.model_dump() for c in clips]}


# --------------------------------------------------------------------------
# Clip media files
# --------------------------------------------------------------------------

_MEDIA_TYPES = {".mp4": "video/mp4", ".jpg": "image/jpeg", ".ass": "text/plain; charset=utf-8"}


@api.get("/jobs/{job_id}/clips/{filename}")
async def get_clip_file(job_id: str, filename: str):
    if STORE.get(job_id) is None:
        raise HTTPException(404, "Job tidak ditemukan")

    # Reject traversal before touching the filesystem.
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, "Nama file tidak valid")

    path = (job_dir(job_id) / "clips" / filename).resolve()
    root = (job_dir(job_id) / "clips").resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(404, "File tidak ditemukan")

    return FileResponse(
        path,
        media_type=_MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream"),
        filename=filename,
    )


# --------------------------------------------------------------------------
# Cache
# --------------------------------------------------------------------------

@api.get("/cache/size")
async def cache_size() -> dict:
    def dir_bytes(p: Path) -> int:
        return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())

    downloads = dir_bytes(DOWNLOAD_DIR) if DOWNLOAD_DIR.exists() else 0
    jobs = dir_bytes(JOBS_DIR) if JOBS_DIR.exists() else 0
    return {
        "downloads_bytes": downloads,
        "jobs_bytes": jobs,
        "total_bytes": downloads + jobs,
    }


@api.delete("/cache")
async def clear_cache() -> dict:
    for job in STORE.list():
        if job.stage in (JobStage.DOWNLOADING, JobStage.TRANSCRIBING,
                         JobStage.ANALYZING, JobStage.RENDERING):
            raise HTTPException(409, "Masih ada job berjalan. Batalkan dulu sebelum bersihkan cache.")

    for job in STORE.list():
        STORE.delete(job.id)
    shutil.rmtree(JOBS_DIR, ignore_errors=True)
    shutil.rmtree(DOWNLOAD_DIR, ignore_errors=True)
    ensure_dirs()
    return {"ok": True}


app.include_router(api)


# --------------------------------------------------------------------------
# Progress WebSocket
# --------------------------------------------------------------------------

@app.websocket("/ws/jobs/{job_id}")
async def job_socket(ws: WebSocket, job_id: str) -> None:
    await ws.accept()
    job = STORE.get(job_id)
    if job is None:
        await ws.send_json({"type": "error", "message": "Job tidak ditemukan"})
        await ws.close()
        return

    queue = STORE.subscribe(job_id)
    try:
        # Send current state immediately so a late subscriber isn't blank.
        await ws.send_json({"type": "progress", "job": job.model_dump()})

        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=20.0)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
                continue

            await ws.send_json(payload)
            if payload.get("type") == "done":
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        log.debug("WebSocket job %s ditutup: %s", job_id, exc)
    finally:
        STORE.unsubscribe(job_id, queue)
        try:
            await ws.close()
        except RuntimeError:
            pass


# --------------------------------------------------------------------------
# Static frontend (production build). Mounted last so /api wins.
# --------------------------------------------------------------------------

if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    async def dev_root() -> JSONResponse:
        return JSONResponse({
            "message": "Clipper API berjalan. Frontend belum di-build.",
            "hint": "Jalankan `npm run build` di folder frontend, atau `npm run dev` untuk mode pengembangan.",
            "api_docs": "/docs",
        })
