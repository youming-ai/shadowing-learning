import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { filesKeys } from '~/hooks/db/useFiles'
import { DBUtils } from '~/lib/db/db'

export type ImportStage = 'idle' | 'resolving' | 'saving'

export class ImportError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ImportError'
  }
}

interface ResolveData {
  videoId: string
  title: string
  channelName: string
  thumbnailUrl: string
  durationSec: number
}

/**
 * 导入编排（弹窗职责仅到写库为止）：resolve → 去重 → addMedia → 返回 mediaId。
 * 字幕抓取/转写/翻译由 watch 页的 useSubtitlePipeline 自驱动（auto-trigger 契约）。
 */
export function useMediaImport() {
  const [stage, setStage] = useState<ImportStage>('idle')
  const queryClient = useQueryClient()

  const importYouTubeUrl = useCallback(
    async (url: string): Promise<number> => {
      setStage('resolving')
      try {
        const response = await fetch('/api/youtube/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.success) {
          throw new ImportError(
            json?.error?.code ?? 'EXTRACTOR_FAILED',
            json?.error?.message ?? 'resolve failed',
          )
        }
        const data = json.data as ResolveData

        setStage('saving')
        const existing = await DBUtils.findMediaByExternalId(data.videoId)
        if (existing?.id) return existing.id

        const now = new Date()
        try {
          const id = await DBUtils.addMedia({
            kind: 'youtube',
            title: data.title,
            durationSec: data.durationSec,
            addedAt: now,
            updatedAt: now,
            externalId: data.videoId,
            channelName: data.channelName,
            thumbnailUrl: data.thumbnailUrl,
            sourceUrl: url,
          })
          queryClient.invalidateQueries({ queryKey: filesKeys.all })
          return id
        } catch (error) {
          // &externalId 唯一索引兜底并发导入：撞约束 → 取已有行
          if (error instanceof Error && error.name === 'ConstraintError') {
            const winner = await DBUtils.findMediaByExternalId(data.videoId)
            if (winner?.id) return winner.id
          }
          if (error instanceof Error && error.message.includes('Constraint')) {
            const winner = await DBUtils.findMediaByExternalId(data.videoId)
            if (winner?.id) return winner.id
          }
          throw error
        }
      } finally {
        setStage('idle')
      }
    },
    [queryClient],
  )

  return { stage, importYouTubeUrl }
}
