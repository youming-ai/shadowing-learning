import { useI18n } from '~/components/layout/contexts/I18nContext'
import type { RecorderStatus, SentenceRecording } from '~/hooks/player/useSentenceRecorder'
import type { RhythmVerdict } from '~/lib/player/rhythm'
import { cn } from '~/lib/utils/utils'

interface RecordingBarProps {
  disabled: boolean
  status: RecorderStatus
  error: string | null
  hasRecording: boolean
  isGapPhase: boolean
  /** 当前句已录的那一条（含节奏结论）。未录时为 null。 */
  take: SentenceRecording | null
  onToggleRecord: () => void
  onPlayMine: () => void
  onPlayOriginal: () => void
  onStopPlayback: () => void
}

/** 分档 → 语义色。三档颜色与「节拍」设计语言的 --rhythm-* 对应。 */
const VERDICT_COLOR: Record<RhythmVerdict, string> = {
  ahead: 'var(--rhythm-ahead)',
  onTime: 'var(--rhythm-ontime)',
  late: 'var(--rhythm-late)',
}

function formatSeconds(sec: number): string {
  // 保留一位小数即可；负值表示抢拍（在原句结束前就开口）
  return `${sec >= 0 ? '' : '−'}${Math.abs(sec).toFixed(1)}s`
}

/**
 * 跟读节奏读数 —— 本项目区别于"只给发音打分数"的产品的核心反馈。
 *
 * 只在拿得到结论时显示数字；算不出时如实说明原因（浏览器不支持 / 没听到人声 /
 * 还在算），而不是留空或编一个值。
 */
function RhythmReadout({ take }: { take: SentenceRecording }) {
  const { t } = useI18n()
  const { rhythm, rhythmStatus } = take

  if (!rhythmStatus) return null

  if (rhythmStatus !== 'ready' || !rhythm) {
    const key =
      rhythmStatus === 'pending'
        ? 'watch.rhythm.analyzing'
        : rhythmStatus === 'noSpeech'
          ? 'watch.rhythm.noSpeech'
          : 'watch.rhythm.unavailable'
    return <p className="text-[11px] text-[var(--text-tertiary)]">{t(key)}</p>
  }

  const hasAnchor = rhythm.basis === 'sentenceEnd'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      {/*
        分档与开口延迟都以"原句结束"为零点。`manual` 基准下零点其实是"按下录音键"，
        据此算出的抢拍/拖拍没有任何依据 —— 那种情况只显示语速比，不显示分档。
      */}
      {hasAnchor && (
        <span className="font-medium" style={{ color: VERDICT_COLOR[rhythm.verdict] }}>
          {t(`watch.rhythm.${rhythm.verdict}`)}
        </span>
      )}
      {hasAnchor && (
        <span className="text-[var(--text-secondary)]">
          {t('watch.rhythm.latency', { sec: formatSeconds(rhythm.onsetLatencySec) })}
        </span>
      )}
      {rhythm.paceRatio != null && (
        <span className="text-[var(--text-secondary)]">
          {t('watch.rhythm.pace', { ratio: rhythm.paceRatio.toFixed(2) })}
        </span>
      )}
    </div>
  )
}

export function RecordingBar({
  disabled,
  status,
  error,
  hasRecording,
  isGapPhase,
  take,
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
              recording &&
                '!border-[var(--rhythm-voice)] !bg-[var(--rhythm-voice-soft)] !text-[var(--rhythm-voice)] animate-pulse',
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
              playing && '!border-[var(--rhythm-voice)] !text-[var(--rhythm-voice)]',
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
          <span className="text-xs text-[var(--rhythm-beat)]">{t('watch.record.gapHint')}</span>
        )}
        {recording && (
          <span className="text-xs font-medium text-[var(--rhythm-voice)]">
            {t('watch.record.recording')}
          </span>
        )}
      </div>

      {errorText && <p className="text-xs text-[var(--color-error)]">{errorText}</p>}
      {!errorText && take && <RhythmReadout take={take} />}
      {!errorText && !take && !recording && (
        <p className="text-[11px] text-[var(--text-tertiary)]">{t('watch.record.hint')}</p>
      )}
    </div>
  )
}
