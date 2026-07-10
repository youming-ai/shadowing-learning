import { useI18n } from '~/components/layout/contexts/I18nContext'
import type { RecorderStatus } from '~/hooks/player/useSentenceRecorder'
import { cn } from '~/lib/utils/utils'

interface RecordingBarProps {
  disabled: boolean
  status: RecorderStatus
  error: string | null
  hasRecording: boolean
  isGapPhase: boolean
  onToggleRecord: () => void
  onPlayMine: () => void
  onPlayOriginal: () => void
  onStopPlayback: () => void
}

export function RecordingBar({
  disabled,
  status,
  error,
  hasRecording,
  isGapPhase,
  onToggleRecord,
  onPlayMine,
  onPlayOriginal,
  onStopPlayback,
}: RecordingBarProps) {
  const { t } = useI18n()
  const recording = status === 'recording'
  const playing = status === 'playing'
  const blocked = status === 'unsupported' || status === 'denied'

  const errorText =
    error === 'mic-denied'
      ? t('watch.record.error.denied')
      : error === 'mic-failed' || error === 'recorder-error'
        ? t('watch.record.error.failed')
        : status === 'unsupported'
          ? t('watch.record.error.unsupported')
          : null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || blocked}
            onClick={onToggleRecord}
            className={cn(
              'btn-secondary !h-9 !rounded-full !px-3 text-xs font-medium',
              recording && '!border-red-500 !bg-red-500/15 !text-red-500 animate-pulse',
            )}
            aria-pressed={recording}
            aria-label={recording ? t('watch.record.stop') : t('watch.record.start')}
          >
            <span className="material-symbols-outlined mr-1 align-middle text-base">
              {recording ? 'stop_circle' : 'mic'}
            </span>
            {recording ? t('watch.record.stop') : t('watch.record.start')}
          </button>

          <button
            type="button"
            disabled={disabled || !hasRecording || recording}
            onClick={playing ? onStopPlayback : onPlayMine}
            className={cn(
              'btn-secondary !h-9 !rounded-full !px-3 text-xs',
              playing && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
            )}
            aria-label={t('watch.record.playMine')}
          >
            <span className="material-symbols-outlined mr-1 align-middle text-base">
              {playing ? 'stop' : 'play_arrow'}
            </span>
            {t('watch.record.playMine')}
          </button>

          <button
            type="button"
            disabled={disabled || recording}
            onClick={onPlayOriginal}
            className="btn-secondary !h-9 !rounded-full !px-3 text-xs"
            aria-label={t('watch.record.playOriginal')}
          >
            <span className="material-symbols-outlined mr-1 align-middle text-base">
              headphones
            </span>
            {t('watch.record.playOriginal')}
          </button>
        </div>

        {isGapPhase && !recording && (
          <span className="text-xs text-[var(--color-primary)]">{t('watch.record.gapHint')}</span>
        )}
        {recording && (
          <span className="text-xs font-medium text-red-500">{t('watch.record.recording')}</span>
        )}
      </div>

      {errorText && <p className="text-xs text-red-500">{errorText}</p>}
      {!errorText && !hasRecording && !recording && (
        <p className="text-[11px] text-[var(--text-tertiary)]">{t('watch.record.hint')}</p>
      )}
    </div>
  )
}
