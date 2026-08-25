import { useState } from 'react'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import type { ShadowingConfig, ShadowingState } from '~/lib/player/shadowing-machine'
import { cn } from '~/lib/utils/utils'

interface WatchControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  availableRates: number[]
  playbackRate: number
  volume: number
  isLooping: boolean
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onPrev: () => void
  onNext: () => void
  onToggleLoop: () => void
  onRateChange: (rate: number) => void
  onVolumeChange: (volume: number) => void
  /** Shadowing practice */
  shadowingEnabled: boolean
  shadowingState: ShadowingState
  shadowingConfig: ShadowingConfig
  onToggleShadowing: () => void
  onShadowingConfigChange: (patch: Partial<ShadowingConfig>) => void
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0')
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0')
  return `${minutes}:${seconds}`
}

const GAP_PRESETS = [
  { key: 'short' as const, ratio: 0.6 },
  { key: 'medium' as const, ratio: 1.0 },
  { key: 'long' as const, ratio: 1.6 },
]

const PRACTICE_RATES = [0.5, 0.75, 1]

export function WatchControls({
  isPlaying,
  currentTime,
  duration,
  availableRates,
  playbackRate,
  volume,
  isLooping,
  onTogglePlay,
  onSeek,
  onPrev,
  onNext,
  onToggleLoop,
  onRateChange,
  onVolumeChange,
  shadowingEnabled,
  shadowingState,
  shadowingConfig,
  onToggleShadowing,
  onShadowingConfigChange,
}: WatchControlsProps) {
  const { t } = useI18n()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  const phaseLabel =
    !shadowingEnabled || shadowingState.phase === 'idle'
      ? null
      : shadowingState.phase === 'gap'
        ? t('watch.shadowing.phase.gap')
        : t('watch.shadowing.phase.listening')

  const passLabel = shadowingEnabled
    ? t('watch.shadowing.pass', {
        current: Math.min(shadowingState.playsDone + 1, shadowingConfig.repeatCount),
        total: shadowingConfig.repeatCount,
      })
    : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)] px-4 py-3">
      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <span className="min-w-[3rem] font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatTime(currentTime)}
        </span>
        <div className="group relative flex-1">
          <div className="relative h-2 w-full rounded-full bg-[var(--surface-muted)]">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            aria-label="播放进度"
          />
        </div>
        <span className="min-w-[3rem] text-right font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatTime(duration)}
        </span>
      </div>

      {/* 控制键 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="btn-secondary !h-10 !w-10 !rounded-full !p-0"
            aria-label={t('watch.prevSentence')}
          >
            <span className="material-symbols-outlined text-xl">skip_previous</span>
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="btn-primary !h-12 !w-12 !rounded-full !p-0"
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            <span className="material-symbols-outlined text-2xl">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="btn-secondary !h-10 !w-10 !rounded-full !p-0"
            aria-label={t('watch.nextSentence')}
          >
            <span className="material-symbols-outlined text-xl">skip_next</span>
          </button>
          <button
            type="button"
            onClick={onToggleLoop}
            disabled={shadowingEnabled}
            className={cn(
              'btn-secondary !h-10 !w-10 !rounded-full !p-0',
              isLooping && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
              shadowingEnabled && 'opacity-40',
            )}
            aria-label={t('watch.loopSentence')}
            title={shadowingEnabled ? t('watch.shadowing.loopDisabled') : t('watch.loopSentence')}
          >
            <span className="material-symbols-outlined text-xl">repeat_one</span>
          </button>
          <button
            type="button"
            onClick={onToggleShadowing}
            className={cn(
              'btn-secondary !h-10 !rounded-full !px-3 text-xs font-medium',
              shadowingEnabled &&
                '!border-[var(--color-primary)] !bg-[var(--color-primary)]/10 !text-[var(--color-primary)]',
            )}
            aria-label={t('watch.shadowing.toggle')}
            aria-pressed={shadowingEnabled}
          >
            <span className="material-symbols-outlined mr-1 text-base align-middle">mic</span>
            {t('watch.shadowing.toggle')}
          </button>
          {shadowingEnabled && (
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="btn-secondary !h-10 !w-10 !rounded-full !p-0"
              aria-label={t('watch.shadowing.settings')}
              aria-expanded={settingsOpen}
            >
              <span className="material-symbols-outlined text-xl">tune</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {passLabel && (
            <span className="hidden text-xs text-[var(--text-secondary)] sm:inline">
              {passLabel}
              {phaseLabel ? ` · ${phaseLabel}` : ''}
            </span>
          )}
          <select
            value={playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            disabled={shadowingEnabled && shadowingState.phase === 'listening'}
            className="h-8 rounded-md border border-[var(--border-primary)] bg-[var(--surface-card)] px-2 text-xs text-[var(--text-primary)] disabled:opacity-50"
            aria-label="播放速度"
          >
            {availableRates.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            aria-label={volume === 0 ? '取消静音' : '静音'}
          >
            <span className="material-symbols-outlined text-xl">
              {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
            </span>
          </button>
          <div className="relative hidden w-20 items-center sm:flex">
            <div className="h-1.5 w-full rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${Math.round(volume * 100)}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
              aria-label="音量"
            />
          </div>
        </div>
      </div>

      {/* 影子跟读设置 */}
      {shadowingEnabled && settingsOpen && (
        <div className="grid gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-muted)]/40 p-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-secondary)]">
              {t('watch.shadowing.repeat')}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary !h-7 !w-7 !rounded-full !p-0 text-sm"
                onClick={() =>
                  onShadowingConfigChange({
                    repeatCount: Math.max(1, shadowingConfig.repeatCount - 1),
                  })
                }
                aria-label="-"
              >
                −
              </button>
              <span className="min-w-[1.5rem] text-center text-sm font-medium tabular-nums">
                {shadowingConfig.repeatCount}
              </span>
              <button
                type="button"
                className="btn-secondary !h-7 !w-7 !rounded-full !p-0 text-sm"
                onClick={() =>
                  onShadowingConfigChange({
                    repeatCount: Math.min(5, shadowingConfig.repeatCount + 1),
                  })
                }
                aria-label="+"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-secondary)]">{t('watch.shadowing.gap')}</span>
            <div className="flex gap-1">
              {GAP_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onShadowingConfigChange({ gapRatio: preset.ratio })}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs',
                    Math.abs(shadowingConfig.gapRatio - preset.ratio) < 0.01
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--surface-card)] text-[var(--text-secondary)]',
                  )}
                >
                  {t(`watch.shadowing.gap.${preset.key}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-secondary)]">
              {t('watch.shadowing.practiceRate')}
            </span>
            <div className="flex gap-1">
              {PRACTICE_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onShadowingConfigChange({ practiceRate: rate })}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs tabular-nums',
                    shadowingConfig.practiceRate === rate
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--surface-card)] text-[var(--text-secondary)]',
                  )}
                >
                  {rate}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-secondary)]">
              {t('watch.shadowing.autoAdvance')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={shadowingConfig.autoAdvance}
              onClick={() => onShadowingConfigChange({ autoAdvance: !shadowingConfig.autoAdvance })}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                shadowingConfig.autoAdvance
                  ? 'bg-[var(--color-primary)]'
                  : 'bg-[var(--surface-muted)]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                  shadowingConfig.autoAdvance && 'translate-x-5',
                )}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
