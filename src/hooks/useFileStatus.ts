/** * 统一Filestate管理 Hook * 完全基于 TranscriptRow.status，Removed FileRow.status 依赖*/

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptionLanguageCode } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { useTranscriptionLanguage } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { useTranscription } from '~/hooks/api/useTranscription'
import { filesKeys } from '~/hooks/db/useFiles'
import { DBUtils, db } from '~/lib/db/db'
import type { FileDisplayStatus } from '~/lib/utils/file-status-manager'
import { mapProcessingStatusToFileStatus } from '~/lib/utils/file-status-manager'
import { handleTranscriptionError } from '~/lib/utils/transcription-error-handler'
import { getTranscriptionQueue } from '~/lib/utils/transcription-queue'

export const fileStatusKeys = {
  all: ['fileStatus'] as const,
  forFile: (fileId: number) => [...fileStatusKeys.all, 'file', fileId] as const,
}

/** * GetFilestate * 完全基于 TranscriptRow.status 判断state*/
export function useFileStatus(fileId: number) {
  return useQuery({
    queryKey: fileStatusKeys.forFile(fileId),
    queryFn: async () => {
      // 从 DBUtils GetFile信息
      const file = await DBUtils.getMedia(fileId)
      if (!file) {
        return { status: 'error' as FileDisplayStatus, error: 'File not found' }
      }

      // Through DBUtils CheckTranscriptionrecord
      const transcript = await DBUtils.findSubtitleByMediaId(fileId)

      // 完全基于 TranscriptRow.status 确定state
      const status = transcript
        ? mapProcessingStatusToFileStatus(transcript.status)
        : ('uploaded' as FileDisplayStatus)

      return {
        status,
        transcriptId: transcript?.id,
        transcript,
        file,
      }
    },
    staleTime: 1000 * 60 * 5, // 5minutesCache
    gcTime: 1000 * 60 * 15, // 15minutes垃圾回收
  })
}

/** * Filestate管理 Hook * 使用Transcription队列和统一state管理*/
export function useFileStatusManager(fileId: number) {
  const queryClient = useQueryClient()
  const transcription = useTranscription()
  const { learningLanguage } = useTranscriptionLanguage()
  const [isTranscribing, setIsTranscribing] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // UpdateTranscriptionstate（仅Update TranscriptRow）
  const updateTranscriptionStatus = useCallback(
    async (status: 'pending' | 'processing' | 'completed' | 'failed', error?: string) => {
      try {
        // Through DBUtils 查找现有Transcriptionrecord
        const transcript = await DBUtils.findSubtitleByMediaId(fileId)

        if (transcript?.id) {
          // Through DBUtils Update现有Transcriptionrecord
          await DBUtils.updateSubtitleStatus(transcript.id, status)
          if (error) {
            await DBUtils.update(db.subtitles, transcript.id, { error })
          }
        } else if (status === 'pending' || status === 'processing') {
          // Through DBUtils 创建新Transcriptionrecord
          await DBUtils.addSubtitle({
            mediaId: fileId,
            source: 'whisper',
            status,
            sourceLanguage: '',
            targetLanguage: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        // 刷新QueryCache
        queryClient.invalidateQueries({
          queryKey: fileStatusKeys.forFile(fileId),
        })
        queryClient.invalidateQueries({ queryKey: filesKeys.all })
      } catch {
        // 静默ProcessstateUpdateFailed，不影响用户体验
      }
    },
    [fileId, queryClient],
  )

  // 开始Transcription（使用队列和学习Language配置）
  const startTranscription = useCallback(
    async (language?: TranscriptionLanguageCode) => {
      const queue = getTranscriptionQueue()

      if (queue.isInQueue(fileId)) {
        return
      }

      const effectiveLanguage = (language ?? 'auto') as TranscriptionLanguageCode
      const nativeLang = learningLanguage.nativeLanguage

      return new Promise<void>((resolve, reject) => {
        queue.setTaskCallback(async (task) => {
          setIsTranscribing(true)
          abortControllerRef.current = task.abortController

          try {
            await updateTranscriptionStatus('processing')

            await transcription.mutateAsync({
              fileId: task.fileId,
              language: task.language,
              nativeLanguage: nativeLang,
              signal: task.abortController.signal,
            })

            await updateTranscriptionStatus('completed')
            resolve()
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              await updateTranscriptionStatus('pending')
              resolve()
              return
            }

            const errorMessage = error instanceof Error ? error.message : '转录失败'
            handleTranscriptionError(error, {
              fileId: task.fileId,
              operation: 'transcribe',
              language: task.language,
            })
            await updateTranscriptionStatus('failed', errorMessage)
            reject(error)
          } finally {
            setIsTranscribing(false)
            abortControllerRef.current = null
          }
        })

        queue.add(fileId, effectiveLanguage)
      })
    },
    [fileId, transcription, updateTranscriptionStatus, learningLanguage],
  )

  // 取消Transcription
  const cancelTranscription = useCallback(() => {
    const queue = getTranscriptionQueue()
    queue.cancel(fileId)
    setIsTranscribing(false)
  }, [fileId])

  // 重置Filestate
  const resetFileStatus = useCallback(async () => {
    // 取消正在进行Transcription
    cancelTranscription()

    // Through DBUtils Delete现有Transcriptionrecord
    const transcript = await DBUtils.findSubtitleByMediaId(fileId)
    if (transcript?.id) {
      await DBUtils.deleteSubtitleWithSegments(transcript.id)
    }

    // 刷新QueryCache
    queryClient.invalidateQueries({
      queryKey: fileStatusKeys.forFile(fileId),
    })
  }, [fileId, queryClient, cancelTranscription])

  // 清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    updateTranscriptionStatus,
    startTranscription,
    cancelTranscription,
    resetFileStatus,
    isTranscribing: isTranscribing || transcription.isPending,
  }
}

/** * batchFilestate管理 * 使用Transcription队列进行并发控制*/
export function useBatchFileStatus() {
  const queryClient = useQueryClient()
  const transcription = useTranscription()

  // batchTranscription - 使用队列
  const startBatchTranscription = useCallback(
    async (fileIds: number[], language: TranscriptionLanguageCode = 'ja') => {
      const queue = getTranscriptionQueue()
      const results: Array<{ fileId: number; success: boolean; error?: string }> = []

      // Set队列任务回调
      queue.setTaskCallback(async (task) => {
        // Through DBUtils 创建Transcriptionrecord
        await DBUtils.addSubtitle({
          mediaId: task.fileId,
          source: 'whisper',
          status: 'processing',
          sourceLanguage: '',
          targetLanguage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        queryClient.invalidateQueries({
          queryKey: fileStatusKeys.forFile(task.fileId),
        })

        // 执行Transcription
        await transcription.mutateAsync({
          fileId: task.fileId,
          language: task.language,
          signal: task.abortController.signal,
        })

        // Through DBUtils Updatestateas完成
        const transcript = await DBUtils.findSubtitleByMediaId(task.fileId)
        if (transcript?.id) {
          await DBUtils.updateSubtitleStatus(transcript.id, 'completed')
        }

        queryClient.invalidateQueries({
          queryKey: fileStatusKeys.forFile(task.fileId),
        })

        results.push({ fileId: task.fileId, success: true })
      })

      // Setstate变更回调
      queue.setStatusChangeCallback(async (fileId, status, error) => {
        if (status === 'failed') {
          const transcript = await DBUtils.findSubtitleByMediaId(fileId)
          if (transcript?.id) {
            await DBUtils.update(db.subtitles, transcript.id, {
              status: 'failed',
              error,
            })
          }
          queryClient.invalidateQueries({
            queryKey: fileStatusKeys.forFile(fileId),
          })
          results.push({ fileId, success: false, error })
        }
      })

      // 将所有任务AddTo队列
      for (const fileId of fileIds) {
        queue.add(fileId, language)
      }

      return results
    },
    [queryClient, transcription],
  )

  // 取消所有Transcription
  const cancelAllTranscriptions = useCallback(() => {
    const queue = getTranscriptionQueue()
    queue.cancelAll()
  }, [])

  return {
    startBatchTranscription,
    cancelAllTranscriptions,
  }
}
