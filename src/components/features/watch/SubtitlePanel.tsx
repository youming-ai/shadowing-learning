import { useEffect, useRef } from 'react'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import type { PipelineStage } from '~/hooks/media/useSubtitlePipeline'
import { youtubeErrorMessageKey } from '~/lib/youtube/error-messages'
import type { Segment, SubtitleRow } from '~/types/db/database'

interface SubtitlePanelProps {
  segments: Segment[]
  subtitle: SubtitleRow | null
  activeIndex: number
  stage: PipelineStage
  translateProgress: { done: number; total: number } | null
  onSegmentClick: (segment: Segment) => void
  onRegenerate: () => void
  onRetry: () => void
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0')
  return `${m}:${s}`
}

export function SubtitlePanel({
  segments,
  subtitle,
  activeIndex,
  stage,
  translateProgress,
  onSegmentClick,
  onRegenerate,
  onRetry,
}: SubtitlePanelProps) {
  const { t } = useI18n()
  const activeRowRef = useRef<HTMLButtonElement | null>(null)
  const showOriginalOnly = subtitle?.source === 'official'

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex triggers scroll; ref mutation is intentional
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  const stageText =
    stage === 'fetching-captions'
      ? t('watch.stage.captions')
      : stage === 'transcribing'
        ? t('watch.stage.transcribing')
        : stage === 'translating' && translateProgress
          ? t('watch.stage.translating', {
              done: translateProgress.done,
              total: translateProgress.total,
            })
          : null

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)]">
      <header className="flex items-center justify-between border-b border-[var(--border-primary)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {t('watch.subtitleCount')}
          </span>
          {segments.length > 0 && (
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              {segments.length}
            </span>
          )}
        </div>
        {subtitle && (
          <button type="button" onClick={onRegenerate} className="btn-secondary !h-8 !px-3 text-xs">
            {t('watch.regenerate')}
          </button>
        )}
      </header>

      {stageText && (
        <div className="border-b border-[var(--border-primary)] px-4 py-2 text-xs text-[var(--text-secondary)]">
          {stageText}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {stage === 'failed' && segments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-[var(--text-secondary)]">
              {/* subtitle.error 存的是错误码（或 catch 路径的原始 message）——
                  经 youtubeErrorMessageKey 本地化，未知值回落到通用文案 */}
              {t(youtubeErrorMessageKey(subtitle?.error))}
            </p>
            <button type="button" onClick={onRetry} className="btn-primary !h-9 !px-4 text-sm">
              {t('watch.retryPipeline')}
            </button>
          </div>
        ) : (
          segments.map((segment, index) => {
            const isActive = index === activeIndex
            const original = showOriginalOnly
              ? segment.text
              : (segment.normalizedText ?? segment.text)
            return (
              <button
                key={segment.id ?? index}
                ref={isActive ? activeRowRef : undefined}
                type="button"
                onClick={() => onSegmentClick(segment)}
                className={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]'
                    : 'hover:bg-[var(--surface-muted)]'
                }`}
              >
                <span className="mb-1 inline-block rounded-full bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">
                  {formatTimestamp(segment.start)}
                </span>
                <p
                  className={`text-sm font-medium ${
                    isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {original}
                </p>
                {segment.translation && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {segment.translation}
                  </p>
                )}
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
