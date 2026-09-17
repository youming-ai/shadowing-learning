import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SubtitlePanel } from '~/components/features/watch/SubtitlePanel'
import type { SubtitleRow } from '~/types/db/database'

/**
 * 这个文件只测「按错误码决定给不给重试入口」这段逻辑，所以把 i18n 固定成 key 本身。
 * 断言于是不依赖任何语种文案，也不会因为默认语言是 zh-CN 还是 en-US 而飘。
 */
vi.mock('~/components/layout/contexts/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

function failedSubtitle(error?: string): SubtitleRow {
  return {
    id: 1,
    mediaId: 1,
    source: 'official',
    status: 'failed',
    sourceLanguage: 'auto',
    targetLanguage: null,
    error,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof SubtitlePanel>> = {}) {
  const onRetry = vi.fn()
  const props: React.ComponentProps<typeof SubtitlePanel> = {
    segments: [],
    subtitle: failedSubtitle('NO_CAPTIONS'),
    activeIndex: 0,
    stage: 'failed',
    translateProgress: null,
    onSegmentClick: vi.fn(),
    onRegenerate: vi.fn(),
    onRetry,
    ...overrides,
  }
  render(<SubtitlePanel {...props} />)
  return { onRetry }
}

const retryButton = () => screen.queryByRole('button', { name: 'watch.retryPipeline' })

describe('SubtitlePanel 的重试入口', () => {
  /**
   * 回归：无字幕视频此前也照旧渲染「重新获取」，用户点一次必然再失败一次 ——
   * `NO_CAPTIONS` 是确定性的，重跑整条抓取链路结果完全一样。
   */
  it('无字幕视频只说明原因，不给重试入口', () => {
    renderPanel({ subtitle: failedSubtitle('NO_CAPTIONS') })

    expect(screen.getByText('import.error.NO_CAPTIONS')).toBeInTheDocument()
    expect(retryButton()).toBeNull()
  })

  /**
   * 与上一条**刻意不同**：头部的「重新生成字幕」保留。
   *
   * 失败行存在时自驱动 effect 不会重跑（只在「没有字幕行」时启动），所以这两个按钮是用户
   * 仅有的恢复入口 —— 一并隐藏的话，视频日后被补上字幕时用户就没法重新抓取了。
   * 这条断言把这个不对称钉住，免得下一次评审又把它当漏改「顺手修掉」。
   */
  it('无字幕时保留「重新生成字幕」作为唯一恢复入口', () => {
    renderPanel({ subtitle: failedSubtitle('NO_CAPTIONS') })

    expect(screen.getByRole('button', { name: 'watch.regenerate' })).toBeInTheDocument()
    expect(retryButton()).toBeNull()
  })

  it('其它失败仍给重试入口，点击触发 onRetry', async () => {
    const { onRetry } = renderPanel({ subtitle: failedSubtitle('EXTRACTOR_FAILED') })

    const button = retryButton()
    expect(button).not.toBeNull()
    if (button) await userEvent.click(button)

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('没有字幕行时保守地保留重试入口', () => {
    renderPanel({ subtitle: null })

    expect(retryButton()).not.toBeNull()
  })

  it('有 segments 时不进入失败分支，重试按钮不出现', () => {
    renderPanel({
      subtitle: failedSubtitle('EXTRACTOR_FAILED'),
      stage: 'translating',
      segments: [
        {
          id: 1,
          transcriptId: 1,
          text: 'hello',
          start: 0,
          end: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })

    expect(retryButton()).toBeNull()
  })
})
