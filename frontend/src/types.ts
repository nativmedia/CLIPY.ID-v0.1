/** Mirrors backend/app/models.py — keep in sync. */

export type JobStage =
  | 'queued'
  | 'downloading'
  | 'transcribing'
  | 'analyzing'
  | 'rendering'
  | 'done'
  | 'failed'
  | 'cancelled'

export const ACTIVE_STAGES: JobStage[] = ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering']

export type SubtitleStyle = 'outline' | 'shadow' | 'box'
export type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9' | '4:3'
export const ASPECT_SIZES: Record<AspectRatio, string> = { '9:16': '720 × 1280', '4:5': '720 × 900', '1:1': '720 × 720', '16:9': '1280 × 720', '4:3': '960 × 720' }

export interface JobOptions {
  aspect_ratio: AspectRatio
  max_clip_seconds: number
  min_clip_seconds: number
  max_clips: number
  min_score: number
  moment_filter: string[]
  subtitle_style: SubtitleStyle
  framing_mode: 'stable' | 'follow'
  enable_zoom: boolean
  enable_reframe: boolean
  language: string | null
  whisper_model: string | null
  keep_source: boolean
}

export const DEFAULT_OPTIONS: JobOptions = {
  aspect_ratio: '9:16',
  max_clip_seconds: 60,
  min_clip_seconds: 12,
  max_clips: 6,
  min_score: 45,
  moment_filter: [],
  subtitle_style: 'outline',
  framing_mode: 'stable',
  enable_zoom: false,
  enable_reframe: true,
  language: null,
  whisper_model: null,
  keep_source: true,
}

export interface ClipAssets {
  title: string
  hook: string
  description: string
  hashtags: string[]
  tags: string[]
  keywords: string[]
  thumbnail_url: string | null
  platform_tags: Record<string, string[]>
}

export interface Clip {
  id: string
  index: number
  start: number
  end: number
  duration: number
  score: number
  labels: string[]
  transcript: string
  video_url: string | null
  thumbnail_url: string | null
  subtitle_url: string | null
  face_coverage: number
  assets: ClipAssets | null
  selected: boolean
}

export interface SourceInfo {
  title: string
  uploader: string
  duration: number
  thumbnail: string | null
  webpage_url: string
  width: number
  height: number
  fps: number
}

export interface Job {
  id: string
  url: string
  options: JobOptions
  stage: JobStage
  stage_label: string
  percent: number
  message: string
  error: string | null
  created_at: number
  updated_at: number
  source: SourceInfo | null
  clips: Clip[]
  log: string[]
  detected_language: string | null
}

export interface Health {
  status: string
  ffmpeg: boolean
  ffprobe: boolean
  yt_dlp: boolean
  faster_whisper: boolean
  opencv: boolean
  numpy: boolean
  data_dir: string
}

export interface MomentLabel {
  key: string
  name: string
}

export interface CacheSize {
  downloads_bytes: number
  jobs_bytes: number
  total_bytes: number
}

/** Frames pushed over /ws/jobs/{id}. */
export type SocketFrame =
  | { type: 'progress'; job: Job }
  | { type: 'done'; job: Job }
  | { type: 'ping' }
  | { type: 'error'; message: string }

export const PLATFORM_NAMES: Record<string, string> = {
  youtube_shorts: 'YouTube Shorts',
  tiktok: 'TikTok',
  instagram_reels: 'Instagram Reels',
  facebook_reels: 'Facebook Reels',
}
