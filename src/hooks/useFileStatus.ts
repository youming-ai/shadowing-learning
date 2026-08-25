/**
 * File 状态管理 Hook — 统一 Transcription 队列与 Query 缓存。
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptionLanguageCode } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { useTranscriptionLanguage } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { useTranscription } from '~/hooks/api/useTranscription'
import { filesKeys } from '~/hooks/db/useFiles'
import { DBUtils, db } from '~/lib/db/db'
import { handleTranscriptionError } from '~/lib/utils/transcription-error-handler'
import { getTranscriptionQueue } from '~/lib/utils/transcription-queue'

export const fileStatusKeys = {
  all: ['fileStatus'] as const,
  forFile: (fileId: number) => [...fileStatusKeys.all, 'file', fileId] as const,
}

export function useFileStatusManager(fileId: number) {
  const queryClient = useQueryClient()
  const transcription = useTranscription()
  const { learningLanguage } = useTranscriptionLanguage()
  const [isTranscribing, setIsTranscribing] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 更新转录状态（仅更新 TranscriptRow）
  const updateTranscriptionStatus = useCallback(
    async (status: 'pending' | 'processing' | 'completed' | 'failed', error?: string) => {
      try {
        const transcript = await DBUtils.findSubtitleByMediaId(fileId)

        if (transcript?.id) {
          await DBUtils.updateSubtitleStatus(transcript.id, status)
          if (error) {
            await DBUtils.update(db.subtitles, transcript.id, { error })
          }
        } else if (status === 'pending' || status === 'processing') {
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

        queryClient.invalidateQueries({
          queryKey: fileStatusKeys.forFile(fileId),
        })
        queryClient.invalidateQueries({ queryKey: filesKeys.all })
      } catch {
        // 静默处理状态更新失败，不影响用户体验
      }
    },
    [fileId, queryClient],
  )

  // 开始转录（使用队列和学习语言配置）
  const startTranscription = useCallback(
    async (language?: TranscriptionLanguageCode) => {
      const queue = getTranscriptionQueue()
      const effectiveLanguage = (language ?? 'auto') as TranscriptionLanguageCode
      const nativeLang = learningLanguage.nativeLanguage

      // 回调按 fileId 绑定在队列内部（见 transcription-queue.ts）：若 fileId 已在排队/处理中，
      // add() 会直接把已有任务的 promise 返回给这次调用，而不是丢弃这次注册、返回 undefined
      // （旧实现在"已排队"时提前 return，调用方会误把 undefined 当成功）。
      const { promise } = queue.add(fileId, effectiveLanguage, async (task) => {
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
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            await updateTranscriptionStatus('pending')
            return
          }

          const errorMessage = error instanceof Error ? error.message : '转录失败'
          handleTranscriptionError(error, {
            fileId: task.fileId,
            operation: 'transcribe',
            language: task.language,
          })
          await updateTranscriptionStatus('failed', errorMessage)
          throw error
        } finally {
          setIsTranscribing(false)
          abortControllerRef.current = null
        }
      })

      return promise
    },
    [fileId, transcription, updateTranscriptionStatus, learningLanguage],
  )

  // 取消转录
  const cancelTranscription = useCallback(() => {
    const queue = getTranscriptionQueue()
    queue.cancel(fileId)
    setIsTranscribing(false)
  }, [fileId])

  // 重置文件状态
  const resetFileStatus = useCallback(async () => {
    cancelTranscription()

    const transcript = await DBUtils.findSubtitleByMediaId(fileId)
    if (transcript?.id) {
      await DBUtils.deleteSubtitleWithSegments(transcript.id)
    }

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
