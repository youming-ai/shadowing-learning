import { useI18n } from '~/components/layout/contexts/I18nContext'
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
}: WatchControlsProps) {
  const { t } = useI18n()
  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

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
      <div className="flex items-center justify-between">
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
            className={cn(
              'btn-secondary !h-10 !w-10 !rounded-full !p-0',
              isLooping && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
            )}
            aria-label={t('watch.loopSentence')}
          >
            <span className="material-symbols-outlined text-xl">repeat_one</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="h-8 rounded-md border border-[var(--border-primary)] bg-[var(--surface-card)] px-2 text-xs text-[var(--text-primary)]"
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
    </div>
  )
}
