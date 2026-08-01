import { useId, useState, type ReactNode } from 'react'
import type { JobOptions, MomentLabel, SubtitleStyle } from '../types'

interface Props {
  options: JobOptions
  onChange: (next: JobOptions) => void
  labels: MomentLabel[]
  disabled: boolean
}

const SUBTITLE_STYLES: Array<{ key: SubtitleStyle; name: string; hint: string }> = [
  { key: 'outline', name: 'Outline', hint: 'Teks putih dengan garis tepi gelap' },
  { key: 'shadow', name: 'Shadow', hint: 'Bayangan lembut di belakang teks' },
  { key: 'box', name: 'Box', hint: 'Kotak gelap di belakang teks' },
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
  { value: 'medium', name: 'medium — paling akurat' },
]

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="label mb-1 text-slate-300">{title}</legend>
      {children}
    </fieldset>
  )
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  hint,
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
  hint?: string
  disabled: boolean
  onChange: (v: number) => void
}) {
  const hintId = useId()
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-200">
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
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-describedby={hint ? hintId : undefined}
        className="min-h-[28px]"
      />
      {hint && (
        <p id={hintId} className="helper mt-1.5">
          {hint}
        </p>
      )}
    </div>
  )
}

function Toggle({
  id,
  checked,
  onChange,
  title,
  hint,
  disabled,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  hint: string
  disabled: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
        checked ? 'border-brand-400/35 bg-brand-500/[0.08]' : 'border-white/[0.08] bg-ink-850/80'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-white/15'}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-ink-800 accent-brand-500"
      />
      <span className="min-w-0 leading-snug">
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>
      </span>
    </label>
  )
}

export default function OptionsPanel({ options, onChange, labels, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const set = <K extends keyof JobOptions>(key: K, value: JobOptions[K]) =>
    onChange({ ...options, [key]: value })

  const toggleLabel = (key: string) => {
    const next = options.moment_filter.includes(key)
      ? options.moment_filter.filter((k) => k !== key)
      : [...options.moment_filter, key]
    set('moment_filter', next)
  }

  const summary = [
    `${options.max_clips} klip`,
    `${options.min_clip_seconds}–${options.max_clip_seconds} dtk`,
    `skor ≥ ${options.min_score}`,
    options.subtitle_style,
    options.enable_reframe ? 'reframe' : null,
    options.enable_zoom ? 'zoom' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full min-h-touch items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] sm:px-5"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-ink-850 text-brand-400"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h10M4 18h6" strokeLinecap="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-100">Pengaturan lanjutan</span>
          <span className="mt-0.5 block truncate text-xs text-slate-400">{summary}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="animate-fade-up space-y-6 border-t border-white/[0.07] px-4 py-5 sm:px-5">
          <Group title="Hasil klip">
            <div className="grid gap-5 sm:grid-cols-2">
              <Slider
                id="opt-max-clips"
                label="Jumlah klip maksimal"
                value={options.max_clips}
                min={1}
                max={15}
                hint="Berapa banyak kandidat short yang akan di-render."
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
                hint="Hanya momen dengan skor di atas nilai ini yang masuk."
                disabled={disabled}
                onChange={(v) => set('min_score', v)}
              />
              <Slider
                id="opt-min-dur"
                label="Durasi minimal"
                value={options.min_clip_seconds}
                min={5}
                max={Math.max(5, options.max_clip_seconds - 1)}
                suffix=" dtk"
                hint="Klip lebih pendek dari ini akan digabung atau dibuang."
                disabled={disabled}
                onChange={(v) => set('min_clip_seconds', Math.min(v, options.max_clip_seconds - 1))}
              />
              <Slider
                id="opt-max-dur"
                label="Durasi maksimal"
                value={options.max_clip_seconds}
                min={options.min_clip_seconds + 1}
                max={180}
                suffix=" dtk"
                hint="Batas panjang tiap short (umumnya 60 detik)."
                disabled={disabled}
                onChange={(v) => set('max_clip_seconds', Math.max(v, options.min_clip_seconds + 1))}
              />
            </div>
          </Group>

          <Group title="Deteksi momen">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="helper">Kosong = semua jenis momen dipertimbangkan.</p>
              {options.moment_filter.length > 0 && (
                <button
                  type="button"
                  onClick={() => set('moment_filter', [])}
                  className="min-h-[36px] text-xs font-medium text-brand-400 hover:underline"
                >
                  Reset filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter jenis momen">
              {labels.length === 0 && (
                <p className="text-sm text-slate-500">Daftar momen belum tersedia dari server.</p>
              )}
              {labels.map((l) => {
                const active = options.moment_filter.includes(l.key)
                return (
                  <button
                    key={l.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleLabel(l.key)}
                    aria-pressed={active}
                    className={`chip min-h-[36px] px-3 transition-colors disabled:opacity-50 ${
                      active
                        ? 'border-accent-400/45 bg-accent-500/15 text-accent-300'
                        : 'border-white/10 bg-ink-850 text-slate-400 hover:border-white/20 hover:text-slate-200'
                    }`}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
          </Group>

          <Group title="Subtitle">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Gaya subtitle">
              {SUBTITLE_STYLES.map((s) => {
                const selected = options.subtitle_style === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => set('subtitle_style', s.key)}
                    className={`min-h-touch rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50 ${
                      selected
                        ? 'border-brand-400/45 bg-brand-500/[0.08]'
                        : 'border-white/[0.08] bg-ink-850/80 hover:border-white/15'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-100">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{s.hint}</span>
                  </button>
                )
              })}
            </div>
          </Group>

          <Group title="Efek visual">
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                id="opt-reframe"
                checked={options.enable_reframe}
                onChange={(v) => set('enable_reframe', v)}
                title="Auto-reframe"
                hint="Crop 9:16 mengikuti wajah/tubuh pembicara"
                disabled={disabled}
              />
              <Toggle
                id="opt-zoom"
                checked={options.enable_zoom}
                onChange={(v) => set('enable_zoom', v)}
                title="Auto-zoom"
                hint="Zoom halus pada puncak momen dalam klip"
                disabled={disabled}
              />
            </div>
          </Group>

          <Group title="Bahasa & model">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="opt-lang" className="mb-1.5 block text-sm font-medium text-slate-200">
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
                <p className="helper mt-1.5">Biarkan otomatis jika ragu.</p>
              </div>
              <div>
                <label htmlFor="opt-model" className="mb-1.5 block text-sm font-medium text-slate-200">
                  Model transkripsi
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
                <p className="helper mt-1.5">Model lebih besar = lebih akurat, lebih lambat.</p>
              </div>
            </div>
          </Group>

          <Group title="Penyimpanan">
            <Toggle
              id="opt-keep"
              checked={options.keep_source}
              onChange={(v) => set('keep_source', v)}
              title="Simpan video sumber"
              hint="Berguna untuk proses ulang tanpa unduh lagi. Matikan untuk menghemat ruang disk."
              disabled={disabled}
            />
          </Group>
        </div>
      )}
    </section>
  )
}
