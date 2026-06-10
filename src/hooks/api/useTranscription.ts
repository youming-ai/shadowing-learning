import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DBUtils, db } from '~/lib/db/db'
import { transcriptionLogger } from '~/lib/utils/logger'
import {
  handleTranscriptionError,
  handleTranscriptionSuccess,
} from '~/lib/utils/transcription-error-handler'
import { smartRetry } from '~/lib/utils/transcription-recovery'
import { TranscriptionError } from '~/types/transcription'

interface TranscriptionResponse {
  success: boolean
  data: {
    status: string
    text: string
    language: string
    duration?: number
    segments: Array<{
      start: number
      end: number
      text: string
      wordTimestamps?: Array<{
        word: string
        start: number
        end: number
      }>
    }>
  }
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export const transcriptionKeys = {
  all: ['transcription'] as const,
  forFile: (fileId: number) => [...transcriptionKeys.all, 'file', fileId] as const,
  progress: (fileId: number) => [...transcriptionKeys.forFile(fileId), 'progress'] as const,
}

export function useTranscriptionStatus(fileId: number, enabled = true) {
  return useQuery({
    queryKey: transcriptionKeys.forFile(fileId),
    enabled,
    queryFn: async () => {
      const transcript = await DBUtils.findSubtitleByMediaId(fileId)

      if (transcript && typeof transcript.id === 'number') {
        const segments = await DBUtils.getSegmentsByTranscriptIdOrdered(transcript.id)
        return {
          transcript,
          segments,
          postProcessStatus: transcript.postProcessStatus,
        }
      }

      return {
        transcript: null,
        segments: [],
        postProcessStatus: undefined,
      }
    },
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 10,
  })
}

async function saveTranscriptionResults(
  fileId: number,
  data: TranscriptionResponse['data'],
): Promise<number> {
  const startTime = Date.now()

  try {
    return await db.transaction('rw', db.subtitles, db.segments, async (tx) => {
      const existingSubtitles = await tx
        .table('subtitles')
        .where('mediaId')
        .equals(fileId)
        .toArray()

      let transcriptId: number

      if (existingSubtitles.length > 0 && existingSubtitles[0].id) {
        transcriptId = existingSubtitles[0].id
        await tx.table('subtitles').update(transcriptId, {
          status: 'completed' as const,
          rawText: data.text,
          sourceLanguage: data.language,
          error: undefined,
          updatedAt: new Date(),
        })

        await tx.table('segments').where('transcriptId').equals(transcriptId).delete()
      } else {
        transcriptId = await tx.table('subtitles').add({
          mediaId: fileId,
          source: 'whisper' as const,
          status: 'completed' as const,
          sourceLanguage: data.language,
          targetLanguage: null,
          rawText: data.text,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      if (data.segments && data.segments.length > 0) {
        const BATCH_SIZE = 100
        const segments = data.segments.map((segment, index) => ({
          transcriptId,
          start: segment.start,
          end: segment.end,
          text: segment.text,
          wordTimestamps: segment.wordTimestamps || [],
          segmentIndex: index,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))

        for (let i = 0; i < segments.length; i += BATCH_SIZE) {
          const batch = segments.slice(i, i + BATCH_SIZE)
          await tx.table('segments').bulkAdd(batch)

          if (i > 0 && i % (BATCH_SIZE * 5) === 0) {
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
        }
      }

      const processingTime = Date.now() - startTime
      transcriptionLogger.info(
        `转录结果保存完成 (文件ID: ${fileId}) - 耗时: ${processingTime}ms, segments: ${data.segments?.length || 0}`,
      )

      return transcriptId
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    transcriptionLogger.error(
      `转录结果保存失败 (文件ID: ${fileId}) - 耗时: ${processingTime}ms`,
      error,
    )

    try {
      await db.transaction('rw', db.subtitles, db.segments, async (tx) => {
        const subtitles = await tx.table('subtitles').where('mediaId').equals(fileId).toArray()

        for (const subtitle of subtitles) {
          if (subtitle.id) {
            await tx.table('segments').where('transcriptId').equals(subtitle.id).delete()
            await tx.table('subtitles').delete(subtitle.id)
          }
        }
      })
    } catch (cleanupError) {
      transcriptionLogger.error('清理失败转录数据时出错:', cleanupError)
    }

    throw error
  }
}

async function updatePostProcessStatus(
  transcriptId: number,
  fileId: number,
  status: 'pending' | 'completed' | 'failed',
  queryClient?: ReturnType<typeof import('@tanstack/react-query').useQueryClient>,
  error?: string,
): Promise<void> {
  await DBUtils.update(db.subtitles, transcriptId, {
    postProcessStatus: status,
    postProcessError: error,
    updatedAt: new Date(),
  })

  if (queryClient) {
    queryClient.invalidateQueries({
      queryKey: transcriptionKeys.forFile(fileId),
    })
  }
}

async function postProcessTranscription(
  transcriptId: number,
  fileId: number,
  segments: Array<{ start: number; end: number; text: string; segmentIndex?: number }>,
  sourceLanguage: string,
  targetLanguage: string,
  queryClient?: ReturnType<typeof import('@tanstack/react-query').useQueryClient>,
): Promise<void> {
  if (!segments || segments.length === 0) {
    transcriptionLogger.warn('后处理跳过：没有 segments')
    return
  }

  transcriptionLogger.info(`开始后处理 ${segments.length} 个 segments`)
  transcriptionLogger.info(`源语言(音频): ${sourceLanguage} → 目标语言(翻译): ${targetLanguage}`)

  await updatePostProcessStatus(transcriptId, fileId, 'pending', queryClient)

  try {
    const response = await fetch('/api/postprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments: segments.map((s, index) => ({
          text: s.text,
          start: s.start,
          end: s.end,
          segmentIndex: s.segmentIndex ?? index,
        })),
        language: sourceLanguage,
        targetLanguage: targetLanguage,
        enableAnnotations: true,
        enableFurigana: sourceLanguage === 'ja',
      }),
    })

    if (!response.ok) {
      const errorMessage = `后处理 API 失败: ${response.status} ${response.statusText}`
      transcriptionLogger.error(errorMessage)
      await updatePostProcessStatus(transcriptId, fileId, 'failed', queryClient, errorMessage)
      return
    }

    const result = await response.json()
    transcriptionLogger.debug('后处理 API 响应:', {
      success: result.success,
      segmentCount: result.data?.segments?.length,
    })

    if (!result.success || !result.data?.segments) {
      const errorMessage = '后处理响应无效'
      transcriptionLogger.error(errorMessage, result)
      await updatePostProcessStatus(transcriptId, fileId, 'failed', queryClient, errorMessage)
      return
    }

    let updatedCount = 0
    for (const processedSegment of result.data.segments) {
      const segIndex = processedSegment.segmentIndex
      let count: number

      if (typeof segIndex === 'number') {
        count = await db.segments
          .where('transcriptId')
          .equals(transcriptId)
          .and((segment) => segment.segmentIndex === segIndex)
          .modify({
            normalizedText: processedSegment.normalizedText,
            translation: processedSegment.translation,
            annotations: processedSegment.annotations,
            furigana: processedSegment.furigana,
          })
      } else {
        count = await db.segments
          .where('transcriptId')
          .equals(transcriptId)
          .and(
            (segment) =>
              segment.start === processedSegment.start && segment.end === processedSegment.end,
          )
          .modify({
            normalizedText: processedSegment.normalizedText,
            translation: processedSegment.translation,
            annotations: processedSegment.annotations,
            furigana: processedSegment.furigana,
          })
      }
      updatedCount += count
    }

    transcriptionLogger.info(`后处理完成，更新了 ${updatedCount} 个 segments`)
    await DBUtils.update(db.subtitles, transcriptId, { targetLanguage })
    await updatePostProcessStatus(transcriptId, fileId, 'completed', queryClient)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '后处理异常'
    transcriptionLogger.error('后处理异常:', error)
    await updatePostProcessStatus(transcriptId, fileId, 'failed', queryClient, errorMessage)
  }
}

async function callTranscribeAPI(
  fileId: number,
  language: string,
  file: NonNullable<Awaited<ReturnType<typeof DBUtils.getMedia>>>,
  signal?: AbortSignal,
): Promise<TranscriptionResponse['data']> {
  if (signal?.aborted) {
    throw new DOMException('转录已取消', 'AbortError')
  }

  const formData = new FormData()
  formData.append('audio', file.blob as Blob, file.title)
  formData.append('meta', JSON.stringify({ fileId: file.id?.toString() || '' }))

  const response = await fetch(`/api/transcribe?fileId=${fileId}&language=${language}`, {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    const code = errorData?.error?.code || 'TRANSCRIPTION_ERROR'
    const bodyMsg = errorData?.message || errorData?.error?.message || response.statusText || ''
    throw new TranscriptionError(
      `HTTP ${response.status}: ${bodyMsg}`,
      code,
      undefined,
      response.status,
    )
  }

  const result: TranscriptionResponse = await response.json()

  if (!result.success) {
    throw new TranscriptionError(
      result.error?.message || '转录请求失败',
      result.error?.code || 'TRANSCRIPTION_ERROR',
    )
  }

  return result.data
}

export function useTranscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      fileId,
      language = 'auto',
      nativeLanguage = 'zh-CN',
      signal,
    }: {
      fileId: number
      language?: string
      nativeLanguage?: string
      signal?: AbortSignal
    }) => {
      const file = await DBUtils.getMedia(fileId)
      if (!file?.blob) {
        throw new Error('File not found or file data is corrupted')
      }

      const data = await smartRetry(() => callTranscribeAPI(fileId, language, file, signal), {
        fileId,
        operation: 'transcribe',
        fileName: file.title,
        language,
        attempt: 0,
        maxAttempts: 3,
      })

      const transcriptId = await saveTranscriptionResults(fileId, data)

      const detectedLanguage = data.language || language

      postProcessTranscription(
        transcriptId,
        fileId,
        data.segments,
        detectedLanguage,
        nativeLanguage,
        queryClient,
      ).catch((err) => {
        transcriptionLogger.error('后处理失败:', err)
      })

      return data
    },
    onSuccess: (_result, variables) => {
      handleTranscriptionSuccess({
        fileId: variables.fileId,
        operation: 'transcribe',
        language: variables.language,
      })

      queryClient.invalidateQueries({
        queryKey: transcriptionKeys.forFile(variables.fileId),
      })
    },
    onError: (error, variables) => {
      handleTranscriptionError(error, {
        fileId: variables.fileId,
        operation: 'transcribe',
        language: variables.language,
      })

      queryClient.invalidateQueries({
        queryKey: transcriptionKeys.forFile(variables.fileId),
      })
    },
  })
}
