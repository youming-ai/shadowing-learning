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
  onSegmentClick: (segment: Segment, index: number) => void
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
  /**
   * 无字幕视频**不给**重试入口。
   *
   * `NO_CAPTIONS` 是确定性的：服务端每次都会返回同一个结果（没有 yt-dlp / ASR 兜底路径），
   * 而 `retry()` 会删掉字幕行并重跑整条抓取链路 —— 用户点一次就白等一次，结果完全一样。
   * 文案本身已经说清原因（「该视频没有可用字幕」），而紧跟其后的「重试」按钮会让人以为
   * 「再试一次可能有救」。
   *
   * **头部的「重新生成字幕」（`onRegenerate`）刻意保留**，这不是漏改：
   * 失败行存在时自驱动 effect 不会重跑（它只在「没有字幕行」时启动），所以 `retry` 与
   * `regenerate` 是用户仅有的恢复入口。两个都隐藏的话，某个视频日后被上传者补上字幕时，
   * 用户就永远无法重新抓取了 —— 除非清掉整个 IndexedDB。留一个语义明确的「重新生成」、
   * 去掉那个读起来像「重试可能成功」的按钮，是这里有意为之的不对称。
   *
   * 其它失败（网络抖动、上游故障）仍然是可重试的，照常给出按钮。
   */
  const retryable = subtitle?.error !== 'NO_CAPTIONS'

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex triggers scroll; ref mutation is intentional
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  const stageText =
    stage === 'fetching-captions'
      ? t('watch.stage.captions')
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
            {retryable && (
              <button type="button" onClick={onRetry} className="btn-primary !h-9 !px-4 text-sm">
                {t('watch.retryPipeline')}
              </button>
            )}
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
                onClick={() => onSegmentClick(segment, index)}
                className={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'bg-[var(--rhythm-beat-soft)] ring-1 ring-[var(--rhythm-beat)]'
                    : 'hover:bg-[var(--surface-muted)]'
                }`}
              >
                <span className="mb-1 inline-block rounded-full bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">
                  {formatTimestamp(segment.start)}
                </span>
                <p
                  className={`text-sm font-medium ${
                    isActive ? 'text-[var(--rhythm-beat)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {original}
                </p>
                {segment.translation && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {segment.translation}
                  </p>
                )}
                {segment.annotations && segment.annotations.length > 0 && (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-tertiary)]">
                    {segment.annotations[0]}
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
