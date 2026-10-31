import { useState } from 'react'
import type { JobOptions, MomentLabel, SubtitleStyle } from '../types'

interface Props {
  options: JobOptions
  onChange: (next: JobOptions) => void
  labels: MomentLabel[]
  disabled: boolean
}

const SUBTITLE_STYLES: Array<{ key: SubtitleStyle; name: string; hint: string }> = [
  { key: 'outline', name: 'Outline', hint: 'Teks putih + garis tepi gelap' },
  { key: 'shadow', name: 'Shadow', hint: 'Bayangan lembut di belakang teks' },
  { key: 'box', name: 'Box', hint: 'Kotak gelap penuh di belakang teks' },
]

const LANGUAGES = [
  { value: '', name: 'Deteksi otomatis' },
  { value: 'id', name: 'Indonesia' },
  { value: 'en', name: 'English' },
]

const WHISPER_MODELS = [
  { value: '', name: 'Default (base)' },
  { value: 'tiny', name: 'tiny — tercepat' },
  { value: 'base', name: 'base' },
  { value: 'small', name: 'small — seimbang' },
  { value: 'medium', name: 'medium — lebih detail, lebih berat' },
]

function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled: boolean
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="label">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums text-brand-400">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-brand-500 disabled:opacity-50"
      />
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  title,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  hint: string
  disabled: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
        checked ? 'border-brand-400/40 bg-brand-500/10' : 'border-white/10 bg-ink-850'
      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-white/20'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-800 accent-brand-500"
      />
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>
      </span>
    </label>
  )
}

export default function OptionsPanel({ options, onChange, labels, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const set = <K extends keyof JobOptions>(key: K, value: JobOptions[K]) =>
    onChange({ ...options, [key]: value })

  const toggleLabel = (key: string) => {
    const next = options.moment_filter.includes(key)
      ? options.moment_filter.filter((k) => k !== key)
      : [...options.moment_filter, key]
    set('moment_filter', next)
  }

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 sm:px-5"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h10M4 18h6" strokeLinecap="round" />
        </svg>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-slate-100">Pengaturan klip</span>
          <span className="text-xs text-slate-400">
            {options.aspect_ratio} · {options.max_clips} klip · {options.min_clip_seconds}–{options.max_clip_seconds}s · skor min{' '}
            {options.min_score} · subtitle {options.subtitle_style}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="animate-fade-up space-y-5 border-t border-white/10 px-4 py-5 sm:px-5">
          <div>
            <label htmlFor="opt-ratio" className="label mb-2">Rasio video</label>
            <select id="opt-ratio" className="field" value={options.aspect_ratio} disabled={disabled} onChange={(e) => set('aspect_ratio', e.target.value as JobOptions['aspect_ratio'])}>
              <option value="9:16">9:16 — vertikal, Shorts dan Reels</option>
              <option value="4:5">4:5 — portrait, unggahan feed</option>
              <option value="1:1">1:1 — persegi, unggahan feed</option>
              <option value="16:9">16:9 — landscape, YouTube</option>
              <option value="4:3">4:3 — landscape, klasik</option>
            </select>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">Jika bentuk sumber lebih sempit dari rasio pilihan, ruang kosong diisi dengan latar buram.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Slider
              id="opt-max-clips"
              label="Jumlah klip maksimal"
              value={options.max_clips}
              min={1}
              max={15}
              disabled={disabled}
              onChange={(v) => set('max_clips', v)}
            />
            <Slider
              id="opt-min-score"
              label="Skor minimal"
              value={options.min_score}
              min={0}
              max={100}
              step={5}
              disabled={disabled}
              onChange={(v) => set('min_score', v)}
            />
            <Slider
              id="opt-min-dur"
              label="Durasi minimal"
              value={options.min_clip_seconds}
              min={5}
              max={Math.min(120, Math.max(5, options.max_clip_seconds - 1))}
              suffix="s"
              disabled={disabled}
              onChange={(v) => set('min_clip_seconds', Math.min(v, options.max_clip_seconds - 1))}
            />
            <Slider
              id="opt-max-dur"
              label="Durasi maksimal"
              value={options.max_clip_seconds}
              min={options.min_clip_seconds + 1}
              max={180}
              suffix="s"
              disabled={disabled}
              onChange={(v) => set('max_clip_seconds', Math.max(v, options.min_clip_seconds + 1))}
            />
          </div>

          <div>
            <span className="label mb-2">Gaya subtitle</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {SUBTITLE_STYLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => set('subtitle_style', s.key)}
                  aria-pressed={options.subtitle_style === s.key}
                  className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
                    options.subtitle_style === s.key
                      ? 'border-brand-400/50 bg-brand-500/10'
                      : 'border-white/10 bg-ink-850 hover:border-white/20'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-100">{s.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="opt-framing" className="label mb-2">Gerakan framing</label>
            <select id="opt-framing" className="field" value={options.framing_mode} disabled={disabled}
              onChange={(e) => onChange({ ...options, framing_mode: e.target.value as JobOptions['framing_mode'], enable_zoom: false })}>
              <option value="stable">Framing tetap (disarankan)</option>
              <option value="follow">Mengikuti wajah</option>
            </select>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{options.framing_mode === 'stable'
              ? 'Crop terkunci dalam setiap shot kamera. Posisi berpindah langsung saat kamera sumber berganti; tanpa pan atau zoom otomatis.'
              : 'Posisi crop bergerak halus mengikuti deteksi wajah. Zoom tambahan dapat diaktifkan di bawah.'}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle
              checked={options.enable_reframe}
              onChange={(v) => set('enable_reframe', v)}
              title="Framing wajah"
              hint="Tempatkan wajah utama dalam crop. Matikan untuk crop tengah."
              disabled={disabled}
            />
            <Toggle
              checked={options.framing_mode === 'follow' && options.enable_zoom}
              onChange={(v) => set('enable_zoom', v)}
              title="Auto-zoom"
              hint={options.framing_mode === 'stable' ? 'Tidak digunakan pada framing tetap' : 'Zoom halus pada momen paling kuat'}
              disabled={disabled || options.framing_mode === 'stable'}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Filter jenis momen</span>
              {options.moment_filter.length > 0 && (
                <button
                  type="button"
                  onClick={() => set('moment_filter', [])}
                  className="text-xs font-medium text-brand-400 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const active = options.moment_filter.includes(l.key)
                return (
                  <button
                    key={l.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleLabel(l.key)}
                    aria-pressed={active}
                    className={`chip transition-colors disabled:opacity-50 ${
                      active
                        ? 'border-accent-400/50 bg-accent-500/20 text-accent-400'
                        : 'border-white/10 bg-ink-850 text-slate-400 hover:border-white/25'
                    }`}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Kosong berarti semua jenis momen dipertimbangkan.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="opt-lang" className="label mb-1.5">
                Bahasa audio
              </label>
              <select
                id="opt-lang"
                className="field"
                disabled={disabled}
                value={options.language ?? ''}
                onChange={(e) => set('language', e.target.value || null)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="opt-model" className="label mb-1.5">
                Model Whisper
              </label>
              <select
                id="opt-model"
                className="field"
                disabled={disabled}
                value={options.whisper_model ?? ''}
                onChange={(e) => set('whisper_model', e.target.value || null)}
              >
                {WHISPER_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Toggle
            checked={options.keep_source}
            onChange={(v) => set('keep_source', v)}
            title="Simpan video sumber"
            hint="Berguna untuk render ulang tanpa unduh lagi. Matikan untuk hemat disk."
            disabled={disabled}
          />
        </div>
      )}
    </section>
  )
}
