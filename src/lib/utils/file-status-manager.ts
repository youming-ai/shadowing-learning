/** * 统一Filestate管理器 * 消除 FileRow.status 和 TranscriptRow.status 不一致问题 * 以 TranscriptRow.status a唯一真实数据源 (Single Source of Truth)*/

import { db } from "@/lib/db/db";
import type { ProcessingStatus } from "@/types/db/database";

export type FileDisplayStatus = "uploaded" | "transcribing" | "completed" | "error";

export function mapProcessingStatusToFileStatus(
  status: ProcessingStatus | undefined,
): FileDisplayStatus {
  switch (status) {
    case "processing":
      return "transcribing";
    case "completed":
      return "completed";
    case "failed":
      return "error";
    default:
      return "uploaded";
  }
}

export async function getFileRealStatus(fileId: number): Promise<{
  status: FileDisplayStatus;
  transcriptId?: number;
  transcript?: any;
}> {
  try {
    const transcripts = await db.transcripts.where("fileId").equals(fileId).toArray();
    const transcript = transcripts.length > 0 ? transcripts[0] : null;

    if (!transcript) {
      return { status: "uploaded" };
    }

    return {
      status: mapProcessingStatusToFileStatus(transcript.status),
      transcriptId: transcript.id,
      transcript,
    };
  } catch (error) {
    console.error("获取文件真实状态失败:", error);
    return { status: "error" };
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
    return await db.transaction("rw", db.transcripts, async () => {
      // 查找现有Transcriptionrecord
      const transcripts = await db.transcripts.where("fileId").equals(fileId).toArray();

      let transcriptId: number;

      if (transcripts.length > 0 && transcripts[0].id) {
        // Update现有Transcriptionrecord
        transcriptId = transcripts[0].id;
        await db.transcripts.update(transcriptId, {
          status,
          error: error || undefined,
          updatedAt: new Date(),
          ...additionalData,
        });
      } else {
        // 创建新Transcriptionrecord（仅在开始Transcription时）
        transcriptId = await db.transcripts.add({
          fileId,
          status,
          error: error || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...additionalData,
        });
      }

      return transcriptId;
    });
  } catch (error) {
    console.error("更新转录状态失败:", error);
    throw error;
  }
}

export async function getFilesStatus(fileIds: number[]): Promise<Map<number, FileDisplayStatus>> {
  try {
    const transcripts = await db.transcripts.where("fileId").anyOf(fileIds).toArray();

    const statusMap = new Map<number, FileDisplayStatus>();

    fileIds.forEach((fileId) => {
      statusMap.set(fileId, "uploaded");
    });

    transcripts.forEach((transcript) => {
      if (transcript.fileId) {
        statusMap.set(transcript.fileId, mapProcessingStatusToFileStatus(transcript.status));
      }
    });

    return statusMap;
  } catch (error) {
    console.error("批量获取文件状态失败:", error);
    const errorMap = new Map<number, FileDisplayStatus>();
    fileIds.forEach((fileId) => {
      errorMap.set(fileId, "error");
    });
    return errorMap;
  }
}

/** * 清理过期Transcriptionrecord * Delete长时间处于 failed staterecord*/
export async function cleanupFailedTranscriptions(olderThanDays: number = 7): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const failedTranscripts = await db.transcripts
      .where("status")
      .equals("failed")
      .and((transcript) => transcript.updatedAt < cutoffDate)
      .toArray();

    for (const transcript of failedTranscripts) {
      if (transcript.id) {
        // Delete相关 segments
        await db.segments.where("transcriptId").equals(transcript.id).delete();
        // DeleteTranscriptionrecord
        await db.transcripts.delete(transcript.id);
      }
    }

    console.log(`清理了 ${failedTranscripts.length} 个过期的失败转录记录`);
  } catch (error) {
    console.error("清理过期转录记录失败:", error);
  }
}

/** * stateValidate器 * Validatestate转换i否合法*/
export function isValidStatusTransition(
  fromStatus: ProcessingStatus | undefined,
  toStatus: ProcessingStatus,
): boolean {
  // 允许state转换
  const validTransitions: Record<string, ProcessingStatus[]> = {
    undefined: ["pending", "processing"], // 初始state
    pending: ["processing", "failed"],
    processing: ["completed", "failed"],
    completed: ["processing"], // 允许重新Transcription
    failed: ["pending", "processing"], // 允许重试
  };

  const from = fromStatus || undefined;
  return validTransitions[String(from)]?.includes(toStatus) ?? false;
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
    const currentStatusInfo = await getFileRealStatus(fileId);
    const currentStatus = currentStatusInfo.transcript?.status;

    // Validatestate转换
    if (!isValidStatusTransition(currentStatus, toStatus)) {
      console.warn(`无效的状态转换: ${currentStatus} -> ${toStatus} (文件ID: ${fileId})`);
      // 可以选择抛出Error或继续执行
    }

    // 执行Update
    return await updateTranscriptionStatus(fileId, toStatus, error, additionalData);
  } catch (error) {
    console.error("安全更新转录状态失败:", error);
    throw error;
  }
}
