import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranscriptionLanguage } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { subtitleKeys } from '~/hooks/media/subtitle-keys'
import { useFileStatusManager } from '~/hooks/useFileStatus'
import { DBUtils, db } from '~/lib/db/db'
import { type ProcessedSegment, runChunkedPostProcess } from '~/lib/subtitles/chunk-postprocess'
import { transcriptionLogger } from '~/lib/utils/logger'
import type { MediaRow, Segment } from '~/types/db/database'

export { subtitleKeys } from '~/hooks/media/subtitle-keys'

export type PipelineStage =
  | 'idle'
  | 'fetching-captions'
  | 'transcribing'
  | 'translating'
  | 'done'
  | 'failed'

interface TranslateProgress {
  done: number
  total: number
}

function baseLang(code: string): string {
  return code.toLowerCase().split('-')[0]
}

async function writeSegments(
  subtitleId: number,
  rows: Array<{ start: number; end: number; text: string }>,
): Promise<void> {
  const now = new Date()
  await db.segments.bulkAdd(
    rows.map((r, index) => ({
      transcriptId: subtitleId,
      segmentIndex: index,
      start: r.start,
      end: r.end,
      text: r.text,
      createdAt: now,
      updatedAt: now,
    })),
  )
}

async function writeChunkResults(
  subtitleId: number,
  processed: ProcessedSegment[],
  source: 'official' | 'whisper',
): Promise<void> {
  for (const p of processed) {
    await db.segments
      .where('transcriptId')
      .equals(subtitleId)
      .and((s: Segment) => s.segmentIndex === p.segmentIndex)
      .modify(
        source === 'official'
          ? { translation: p.translation, furigana: p.furigana }
          : {
              normalizedText: p.normalizedText,
              translation: p.translation,
              annotations: p.annotations,
              furigana: p.furigana,
            },
      )
  }
}

export function useSubtitlePipeline(media: MediaRow | null) {
  const queryClient = useQueryClient()
  const { learningLanguage } = useTranscriptionLanguage()
  const targetLanguage = learningLanguage.nativeLanguage
  const mediaId = media?.id ?? 0
  const { startTranscription } = useFileStatusManager(media?.kind === 'audio' ? mediaId : 0)

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
    async (subtitleId: number, source: 'official' | 'whisper', sourceLanguage: string) => {
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
        onChunkDone: async (processed, i, total) => {
          await writeChunkResults(subtitleId, processed, source)
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
        await runTranslate(subtitleId, 'official', language)
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

    if (media.kind === 'youtube') {
      if (!subtitle) {
        void runYouTubePipeline()
      } else if (subtitle.status === 'completed' && subtitle.postProcessStatus === 'pending') {
        runningRef.current = true
        void runTranslate(subtitle.id as number, subtitle.source, subtitle.sourceLanguage).finally(
          () => {
            runningRef.current = false
          },
        )
      }
    } else if (media.kind === 'audio' && !subtitle) {
      // 音频走现有转写链路（useTranscription 内部完成时会失效 subtitleKeys）；
      // 这里补阶段反馈 + 完成后兜底刷新（双保险，防 onSuccess 失效被竞态吞掉）
      runningRef.current = true
      setStage('transcribing')
      void startTranscription()
        .then(() => setStage('done'))
        .catch(() => setStage('failed'))
        .finally(() => {
          runningRef.current = false
          invalidate()
        })
    }
  }, [
    media,
    query.isLoading,
    query.data,
    runYouTubePipeline,
    runTranslate,
    startTranscription,
    invalidate,
  ])

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
