/** * 统一媒体状态管理器 * 以 SubtitleRow.status 为唯一真实数据源 (Single Source of Truth)*/

import { db } from '~/lib/db/db'
import { dbLogger } from '~/lib/utils/logger'
import type { ProcessingStatus, SubtitleRow } from '~/types/db/database'

export type FileDisplayStatus = 'uploaded' | 'transcribing' | 'completed' | 'error'

export function mapProcessingStatusToFileStatus(
  status: ProcessingStatus | undefined,
): FileDisplayStatus {
  switch (status) {
    case 'processing':
      return 'transcribing'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'error'
    default:
      return 'uploaded'
  }
}

export async function getFileRealStatus(fileId: number): Promise<{
  status: FileDisplayStatus
  transcriptId?: number
  transcript?: SubtitleRow
}> {
  try {
    const subtitles = await db.subtitles.where('mediaId').equals(fileId).toArray()
    const subtitle = subtitles.length > 0 ? subtitles[0] : null

    if (!subtitle) {
      return { status: 'uploaded' }
    }

    return {
      status: mapProcessingStatusToFileStatus(subtitle.status),
      transcriptId: subtitle.id,
      transcript: subtitle,
    }
  } catch (error) {
    dbLogger.error('获取文件真实状态失败:', error)
    return { status: 'error' }
  }
}

/** * UpdateTranscriptionstate（统一Update入口） * 只Update TranscriptRow，不Update FileRow.status*/
export async function updateTranscriptionStatus(
  fileId: number,
  status: ProcessingStatus,
  error?: string,
  additionalData?: Partial<any>,
): Promise<number | undefined> {
  try {
    return await db.transaction('rw', db.subtitles, async () => {
      // 查找现有Transcriptionrecord
      const subtitles = await db.subtitles.where('mediaId').equals(fileId).toArray()

      let transcriptId: number

      if (subtitles.length > 0 && subtitles[0].id) {
        // Update现有Transcriptionrecord
        transcriptId = subtitles[0].id
        await db.subtitles.update(transcriptId, {
          status,
          error: error || undefined,
          updatedAt: new Date(),
          ...additionalData,
        })
      } else {
        // 创建新Transcriptionrecord（仅在开始Transcription时）
        transcriptId = await db.subtitles.add({
          mediaId: fileId,
          source: 'whisper' as const,
          status,
          sourceLanguage: '',
          targetLanguage: null,
          error: error || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...additionalData,
        })
      }

      return transcriptId
    })
  } catch (error) {
    dbLogger.error('更新转录状态失败:', error)
    throw error
  }
}

export async function getFilesStatus(fileIds: number[]): Promise<Map<number, FileDisplayStatus>> {
  try {
    const subtitles = await db.subtitles.where('mediaId').anyOf(fileIds).toArray()

    const statusMap = new Map<number, FileDisplayStatus>()

    fileIds.forEach((fileId) => {
      statusMap.set(fileId, 'uploaded')
    })

    subtitles.forEach((subtitle) => {
      if (subtitle.mediaId) {
        statusMap.set(subtitle.mediaId, mapProcessingStatusToFileStatus(subtitle.status))
      }
    })

    return statusMap
  } catch (error) {
    dbLogger.error('批量获取文件状态失败:', error)
    const errorMap = new Map<number, FileDisplayStatus>()
    fileIds.forEach((fileId) => {
      errorMap.set(fileId, 'error')
    })
    return errorMap
  }
}

/** * 清理过期Transcriptionrecord * Delete长时间处于 failed staterecord*/
export async function cleanupFailedTranscriptions(olderThanDays: number = 7): Promise<void> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const failedSubtitles = await db.subtitles
      .where('status')
      .equals('failed')
      .and((subtitle) => subtitle.updatedAt < cutoffDate)
      .toArray()

    for (const subtitle of failedSubtitles) {
      if (subtitle.id) {
        // Delete相关 segments
        await db.segments.where('transcriptId').equals(subtitle.id).delete()
        // DeleteTranscriptionrecord
        await db.subtitles.delete(subtitle.id)
      }
    }

    dbLogger.info(`清理了 ${failedSubtitles.length} 个过期的失败转录记录`)
  } catch (error) {
    dbLogger.error('清理过期转录记录失败:', error)
  }
}

/** * stateValidate器 * Validatestate转换i否合法*/
export function isValidStatusTransition(
  fromStatus: ProcessingStatus | undefined,
  toStatus: ProcessingStatus,
): boolean {
  // 允许state转换
  const validTransitions: Record<string, ProcessingStatus[]> = {
    undefined: ['pending', 'processing'], // 初始state
    pending: ['processing', 'failed'],
    processing: ['completed', 'failed'],
    completed: ['processing'], // 允许重新Transcription
    failed: ['pending', 'processing'], // 允许重试
  }

  const from = fromStatus || undefined
  return validTransitions[String(from)]?.includes(toStatus) ?? false
}

/** * 安全stateUpdate * 带stateValidateUpdate函数*/
export async function safeUpdateTranscriptionStatus(
  fileId: number,
  toStatus: ProcessingStatus,
  error?: string,
  additionalData?: Partial<any>,
): Promise<number | undefined> {
  try {
    // Get当前state
    const currentStatusInfo = await getFileRealStatus(fileId)
    const currentStatus = currentStatusInfo.transcript?.status

    // Validatestate转换
    if (!isValidStatusTransition(currentStatus, toStatus)) {
      dbLogger.warn(`无效的状态转换: ${currentStatus} -> ${toStatus} (文件ID: ${fileId})`)
      // 可以选择抛出Error或继续执行
    }

    // 执行Update
    return await updateTranscriptionStatus(fileId, toStatus, error, additionalData)
  } catch (error) {
    dbLogger.error('安全更新转录状态失败:', error)
    throw error
  }
}
