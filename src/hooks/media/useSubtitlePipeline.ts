import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranscriptionLanguage } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { subtitleKeys } from '~/hooks/media/subtitle-keys'
import { resolveEngine } from '~/lib/ai/transports'
import { DBUtils, db } from '~/lib/db/db'
import { runChunkedPostProcess } from '~/lib/subtitles/chunk-postprocess'
import { writeChunkResults, writeSegments } from '~/lib/subtitles/segment-writeback'
import { transcriptionLogger } from '~/lib/utils/logger'
import type { MediaRow } from '~/types/db/database'

export { subtitleKeys } from '~/hooks/media/subtitle-keys'

export type PipelineStage = 'idle' | 'fetching-captions' | 'translating' | 'done' | 'failed'

interface TranslateProgress {
  done: number
  total: number
}

function baseLang(code: string): string {
  return code.toLowerCase().split('-')[0]
}

export function useSubtitlePipeline(media: MediaRow | null) {
  const queryClient = useQueryClient()
  const { learningLanguage } = useTranscriptionLanguage()
  const targetLanguage = learningLanguage.nativeLanguage
  const mediaId = media?.id ?? 0

  const [stage, setStage] = useState<PipelineStage>('idle')
  const [translateProgress, setTranslateProgress] = useState<TranslateProgress | null>(null)
  const runningRef = useRef(false)

  const query = useQuery({
    queryKey: subtitleKeys.forMedia(mediaId),
    enabled: mediaId > 0,
    queryFn: async () => {
      const subtitle = await DBUtils.findSubtitleByMediaId(mediaId)
      const segments = subtitle?.id
        ? await DBUtils.getSegmentsByTranscriptIdOrdered(subtitle.id)
        : []
      return { subtitle: subtitle ?? null, segments }
    },
    staleTime: 1000 * 30,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: subtitleKeys.forMedia(mediaId) })
  }, [queryClient, mediaId])

  const runTranslate = useCallback(
    async (subtitleId: number, sourceLanguage: string) => {
      if (baseLang(sourceLanguage) === baseLang(targetLanguage)) {
        await DBUtils.update(db.subtitles, subtitleId, {
          postProcessStatus: 'completed' as const,
          targetLanguage: null,
          updatedAt: new Date(),
        })
        invalidate()
        return
      }
      setStage('translating')
      const segments = await DBUtils.getSegmentsByTranscriptIdOrdered(subtitleId)
      // 每次翻译前解析一次引擎：用户可能刚在设置里填了 key / 切换了供应商。
      // 选了 BYOK 但没填 key 时会回退到服务器额度（界面会说明），而不是直接失败。
      const { transport, fellBackToServer } = resolveEngine()
      if (fellBackToServer) {
        transcriptionLogger.warn('BYOK engine selected without a key; using server quota')
      }
      const result = await runChunkedPostProcess({
        segments: segments.map((s) => ({
          segmentIndex: s.segmentIndex ?? 0,
          start: s.start,
          end: s.end,
          text: s.text,
        })),
        language: sourceLanguage,
        targetLanguage,
        enableFurigana: baseLang(sourceLanguage) === 'ja',
        transport,
        onChunkDone: async (processed, i, total) => {
          await writeChunkResults(subtitleId, processed)
          setTranslateProgress({ done: i + 1, total })
          invalidate()
        },
      })
      await DBUtils.update(db.subtitles, subtitleId, {
        postProcessStatus: result.failed ? ('failed' as const) : ('completed' as const),
        postProcessError: result.error,
        targetLanguage,
        updatedAt: new Date(),
      })
      invalidate()
      setStage(result.failed ? 'failed' : 'done')
    },
    [targetLanguage, invalidate],
  )

  const runYouTubePipeline = useCallback(async () => {
    if (!media?.externalId || runningRef.current) return
    runningRef.current = true
    try {
      setStage('fetching-captions')
      const res = await fetch('/api/youtube/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: media.externalId }),
      })
      const json = await res.json().catch(() => null)

      if (res.ok && json?.success) {
        const { language, segments } = json.data as {
          language: string
          segments: Array<{ start: number; end: number; text: string }>
        }
        const subtitleId = await DBUtils.addSubtitle({
          mediaId,
          source: 'official',
          status: 'completed',
          sourceLanguage: language,
          targetLanguage: null,
          postProcessStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        await writeSegments(subtitleId, segments)
        invalidate()
        await runTranslate(subtitleId, language)
        return
      }

      if (json?.error?.code === 'NO_CAPTIONS') {
        await DBUtils.addSubtitle({
          mediaId,
          source: 'official',
          status: 'failed',
          sourceLanguage: 'auto',
          targetLanguage: null,
          error: 'NO_CAPTIONS',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        invalidate()
        setStage('failed')
        return
      }

      await DBUtils.addSubtitle({
        mediaId,
        source: 'official',
        status: 'failed',
        sourceLanguage: 'auto',
        targetLanguage: null,
        error: json?.error?.code ?? 'EXTRACTOR_FAILED',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      invalidate()
      setStage('failed')
    } catch (error) {
      transcriptionLogger.error('subtitle pipeline failed:', error)
      // 落一条 failed 记录并刷新，否则 query.data 不变、retry() 失效，用户只能刷新页面
      try {
        await DBUtils.addSubtitle({
          mediaId,
          source: 'official',
          status: 'failed',
          sourceLanguage: 'auto',
          targetLanguage: null,
          error: error instanceof Error ? error.message : 'PIPELINE_ERROR',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        invalidate()
      } catch (writeError) {
        transcriptionLogger.error('failed to persist failed-subtitle marker:', writeError)
      }
      setStage('failed')
    } finally {
      runningRef.current = false
    }
  }, [media, mediaId, invalidate, runTranslate])

  // 自驱动（auto-trigger 契约）：挂载/数据就绪后按落库状态决定下一步
  useEffect(() => {
    if (!media?.id || query.isLoading || runningRef.current) return
    const { subtitle } = query.data ?? { subtitle: null }

    // 跨会话恢复：字幕行已存在但翻译卡在 pending（页面被关闭/导航打断）就续跑翻译。
    if (subtitle?.status === 'completed' && subtitle.postProcessStatus === 'pending') {
      runningRef.current = true
      void runTranslate(subtitle.id as number, subtitle.sourceLanguage).finally(() => {
        runningRef.current = false
      })
      return
    }

    if (!subtitle) {
      void runYouTubePipeline()
    }
  }, [media, query.isLoading, query.data, runYouTubePipeline, runTranslate])

  const retry = useCallback(async () => {
    const subtitle = query.data?.subtitle
    if (subtitle?.id && subtitle.status === 'failed') {
      await DBUtils.deleteSubtitleWithSegments(subtitle.id)
      invalidate()
    }
  }, [query.data, invalidate])

  const regenerate = useCallback(async () => {
    const subtitle = query.data?.subtitle
    if (subtitle?.id) {
      await DBUtils.deleteSubtitleWithSegments(subtitle.id)
      invalidate()
    }
  }, [query.data, invalidate])

  return {
    subtitle: query.data?.subtitle ?? null,
    segments: query.data?.segments ?? [],
    isLoading: query.isLoading,
    stage,
    translateProgress,
    retry,
    regenerate,
  }
}
