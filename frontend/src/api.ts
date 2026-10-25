import type { CacheSize, Clip, Health, Job, JobOptions, MomentLabel } from './types'

/** Same-origin in production (FastAPI serves dist/); Vite proxies /api in dev. */
const BASE = ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server CLIPY.ID. Pastikan backend berjalan.')
  }

  if (!res.ok) {
    // FastAPI errors come back as {detail: "..."} — surface that verbatim.
    let detail = `Permintaan gagal (${res.status})`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  health: () => request<Health>('/api/health'),

  momentLabels: () => request<{ labels: MomentLabel[] }>('/api/moment-labels').then((r) => r.labels),

  validateUrl: (url: string) =>
    request<{ valid: boolean }>('/api/validate-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }).then((r) => r.valid),

  createJob: (url: string, options: JobOptions) =>
    request<Job>('/api/jobs', { method: 'POST', body: JSON.stringify({ url, options }) }),

  listJobs: () => request<{ jobs: Job[] }>('/api/jobs').then((r) => r.jobs),

  getJob: (id: string) => request<Job>(`/api/jobs/${id}`),

  cancelJob: (id: string) => request<{ ok: boolean }>(`/api/jobs/${id}/cancel`, { method: 'POST' }),

  deleteJob: (id: string) => request<{ ok: boolean }>(`/api/jobs/${id}`, { method: 'DELETE' }),

  generateAssets: (id: string, clipIds: string[]) =>
    request<{ clips: Clip[] }>(`/api/jobs/${id}/assets`, {
      method: 'POST',
      body: JSON.stringify({ clip_ids: clipIds }),
    }).then((r) => r.clips),

  cacheSize: () => request<CacheSize>('/api/cache/size'),

  clearCache: () => request<{ ok: boolean }>('/api/cache', { method: 'DELETE' }),
}

/** Absolute URL for a clip artifact (video/thumbnail/subtitle) returned by the backend. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return path.startsWith('http') ? path : `${BASE}${path}`
}

export function jobSocketUrl(jobId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/jobs/${jobId}`
}
