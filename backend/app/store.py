"""In-memory job registry with pub/sub for progress streaming."""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

from .models import Job, JobOptions, JobStage, STAGE_LABELS


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._subs: dict[str, set[asyncio.Queue]] = {}
        self._cancels: dict[str, bool] = {}
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    # ---------- CRUD ----------
    def create(self, url: str, options: JobOptions) -> Job:
        job_id = uuid.uuid4().hex[:12]
        now = time.time()
        job = Job(
            id=job_id,
            url=url,
            options=options,
            created_at=now,
            updated_at=now,
            stage=JobStage.QUEUED,
            stage_label=STAGE_LABELS[JobStage.QUEUED],
        )
        self._jobs[job_id] = job
        self._subs[job_id] = set()
        self._cancels[job_id] = False
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)

    def delete(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)
        self._subs.pop(job_id, None)
        self._cancels.pop(job_id, None)

    # ---------- cancellation ----------
    def request_cancel(self, job_id: str) -> None:
        self._cancels[job_id] = True

    def is_cancelled(self, job_id: str) -> bool:
        return self._cancels.get(job_id, False)

    # ---------- pub/sub ----------
    def subscribe(self, job_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._subs.setdefault(job_id, set()).add(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        subs = self._subs.get(job_id)
        if subs:
            subs.discard(q)

    def _publish(self, job_id: str, payload: dict[str, Any]) -> None:
        """Push an event to all subscribers. Safe to call from a worker thread."""
        subs = list(self._subs.get(job_id, ()))
        if not subs:
            return
        loop = self._loop
        for q in subs:
            if loop and not loop.is_closed():
                loop.call_soon_threadsafe(self._safe_put, q, payload)

    @staticmethod
    def _safe_put(q: asyncio.Queue, payload: dict[str, Any]) -> None:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass

    # ---------- progress updates (called from worker thread) ----------
    def update(
        self,
        job_id: str,
        *,
        stage: str | None = None,
        percent: float | None = None,
        message: str | None = None,
        error: str | None = None,
        **fields: Any,
    ) -> None:
        job = self._jobs.get(job_id)
        if job is None:
            return
        if stage is not None:
            job.stage = stage
            job.stage_label = STAGE_LABELS.get(stage, stage)
        if percent is not None:
            job.percent = max(0.0, min(100.0, percent))
        if message is not None:
            job.message = message
            job.log.append(message)
            if len(job.log) > 500:
                del job.log[:-500]
        if error is not None:
            job.error = error
        for k, v in fields.items():
            if hasattr(job, k):
                setattr(job, k, v)
        job.updated_at = time.time()
        self._publish(job_id, {"type": "progress", "job": job.model_dump()})

    def emit_done(self, job_id: str) -> None:
        job = self._jobs.get(job_id)
        if job:
            self._publish(job_id, {"type": "done", "job": job.model_dump()})


STORE = JobStore()
