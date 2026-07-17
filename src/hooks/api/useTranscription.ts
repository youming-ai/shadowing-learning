import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subtitleKeys } from '~/hooks/media/subtitle-keys'
import { DBUtils, db } from '~/lib/db/db'
import { runChunkedPostProcess } from '~/lib/subtitles/chunk-postprocess'
import { transcriptionLogger } from '~/lib/utils/logger'
import { withRetry } from '~/lib/utils/retry-utils'
import {
  handleTranscriptionError,
  handleTranscriptionSuccess,
} from '~/lib/utils/transcription-error-handler'
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
    // watch 页（useSubtitlePipeline）读的是 subtitleKeys 查询——不失效它的话，
    // 音频转写/翻译完成后字幕面板会一直停在旧数据（refetchOnWindowFocus 已关闭，无自愈机会）
    queryClient.invalidateQueries({
      queryKey: subtitleKeys.forMedia(fileId),
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
    let updatedCount = 0

    const result = await runChunkedPostProcess({
      segments: segments.map((s, index) => ({
        segmentIndex: s.segmentIndex ?? index,
        start: s.start,
        end: s.end,
        text: s.text,
      })),
      language: sourceLanguage,
      targetLanguage,
      enableFurigana: sourceLanguage === 'ja',
      onChunkDone: async (processed) => {
        for (const processedSegment of processed) {
          const count = await db.segments
            .where('transcriptId')
            .equals(transcriptId)
            .and((segment) => segment.segmentIndex === processedSegment.segmentIndex)
            .modify({
              normalizedText: processedSegment.normalizedText,
              translation: processedSegment.translation,
              annotations: processedSegment.annotations,
              furigana: processedSegment.furigana,
            })
          updatedCount += count
        }
        if (queryClient) {
          queryClient.invalidateQueries({ queryKey: subtitleKeys.forMedia(fileId) })
        }
      },
    })

    if (result.failed) {
      const errorMessage = result.error ?? '后处理失败'
      transcriptionLogger.error(errorMessage)
      await updatePostProcessStatus(transcriptId, fileId, 'failed', queryClient, errorMessage)
      return
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

      // withRetry 不区分错误类型分别限流重试次数（transcription-recovery.ts 那套已删，无其他调用方），
      // 用 shouldRetry 保留最关键的两条：取消不重试、鉴权/客户端错误不重试。
      const retryResult = await withRetry(() => callTranscribeAPI(fileId, language, file, signal), {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        shouldRetry: (error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return false
          const statusCode = (error as TranscriptionError).statusCode
          if (statusCode === 401 || statusCode === 403) return false
          if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429)
            return false
          return true
        },
      })

      if (!retryResult.success || retryResult.data === undefined) {
        throw retryResult.error ?? new Error('转录请求失败')
      }
      const data = retryResult.data

      const transcriptId = await saveTranscriptionResults(fileId, data)

      const detectedLanguage = data.language || language

      // await（而非 fire-and-forget）：让 mutateAsync 覆盖"转录+后处理"整个流程，
      // 这样 useSubtitlePipeline 的 runningRef 才能在后处理结束前保持占用，
      // 避免与"恢复卡在 pending 的字幕"分支在同一会话内重复触发 runTranslate。
      // postProcessTranscription 内部已把后处理失败落库为 failed 且不会重新抛出，故这里不会让 mutation reject。
      await postProcessTranscription(
        transcriptId,
        fileId,
        data.segments,
        detectedLanguage,
        nativeLanguage,
        queryClient,
      )

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
      queryClient.invalidateQueries({
        queryKey: subtitleKeys.forMedia(variables.fileId),
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
      queryClient.invalidateQueries({
        queryKey: subtitleKeys.forMedia(variables.fileId),
      })
    },
  })
}
