/** * 手动触发后Process工具函数 * Used foras已Transcription但没有TranslationFile生成Translation*/

import { db } from "@/lib/db/db";

const LEARNING_LANGUAGE_KEY = "shadowing-learning-language";

interface PostProcessOptions {
  transcriptId: number;
  sourceLanguage?: string; // Audio原始Language；默认从 settings 读取学习语言
  targetLanguage?: string; // Translation目标Language；默认从 settings 读取母语
}

/** * 从 settings (localStorage) 读取母语作为翻译目标。 * 音频源语言不再来自 settings — 由 Whisper auto-detect 写入 transcript.language。*/
function readNativeLanguageFromSettings(): string {
  if (typeof window === "undefined") return "zh-CN";
  try {
    const stored = window.localStorage.getItem(LEARNING_LANGUAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { nativeLanguage?: string };
      if (parsed?.nativeLanguage) return parsed.nativeLanguage;
    }
  } catch {
    // 静默
  }
  return "zh-CN";
}

/** * 从已存在的 transcript 记录读取 Whisper 检测到的源语言。*/
async function readSourceLanguageFromTranscript(transcriptId: number): Promise<string> {
  const transcript = await db.transcripts.get(transcriptId);
  return transcript?.language || "auto";
}

/** * 手动触发后Process * Used foras现有Transcription生成Translation*/
export async function manualPostProcess(options: PostProcessOptions): Promise<boolean> {
  const fallbackSource = await readSourceLanguageFromTranscript(options.transcriptId);
  const fallbackTarget = readNativeLanguageFromSettings();
  const {
    transcriptId,
    sourceLanguage = fallbackSource,
    targetLanguage = fallbackTarget,
  } = options;

  console.log(`🔄 手动后处理开始，transcriptId: ${transcriptId}`);
  console.log(`   源语言: ${sourceLanguage}, 目标语言: ${targetLanguage}`);

  try {
    // Get segments
    const segments = await db.segments.where("transcriptId").equals(transcriptId).toArray();

    if (segments.length === 0) {
      console.error("❌ 没有找到 segments");
      return false;
    }

    console.log(`📝 找到 ${segments.length} 个 segments`);

    // 调用后Process API
    const response = await fetch("/api/postprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segments: segments.map((s) => ({
          text: s.text,
          start: s.start,
          end: s.end,
        })),
        language: sourceLanguage,
        targetLanguage: targetLanguage,
        enableAnnotations: true,
        enableFurigana: sourceLanguage === "ja",
      }),
    });

    if (!response.ok) {
      console.error(`❌ 后处理 API 失败: ${response.status} ${response.statusText}`);
      return false;
    }

    const result = await response.json();
    console.log("📦 后处理 API 响应:", {
      success: result.success,
      segmentCount: result.data?.segments?.length,
    });

    if (!result.success || !result.data?.segments) {
      console.error("❌ 后处理响应无效:", result);
      return false;
    }

    // Updatedatabasein segments
    let updatedCount = 0;
    for (const processedSegment of result.data.segments) {
      const count = await db.segments
        .where("transcriptId")
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
        });
      updatedCount += count;
    }

    console.log(`✅ 后处理完成，更新了 ${updatedCount} 个 segments`);
    console.log("🔄 请刷新页面查看翻译");

    return true;
  } catch (error) {
    console.error("❌ 后处理异常:", error);
    return false;
  }
}

/** * 按 fileId 用 settings 当前的语言重新生成翻译。 * 浏览器控制台便捷入口： `retranslateFile(<fileId>)` */
export async function retranslateFile(fileId: number): Promise<boolean> {
  const transcript = await db.transcripts.where("fileId").equals(fileId).first();
  if (!transcript?.id) {
    console.error(`❌ 找不到 fileId=${fileId} 的转录记录`);
    return false;
  }
  return manualPostProcess({ transcriptId: transcript.id });
}

/** * 清掉一个文件的转录数据（不动 audio blob），让 player 自动重新跑 Whisper。 * 用于 Whisper 输出本身就乱（多语言混杂、识别错误）需要重做的情况。 * 完成后请刷新或返回首页再点进来——usePlayerDataQuery 会检测到没有转录并自动重启。 */
export async function retranscribeFile(fileId: number): Promise<boolean> {
  console.log(`🗑️  清理 fileId=${fileId} 的旧转录...`);
  try {
    const transcripts = await db.transcripts.where("fileId").equals(fileId).toArray();
    if (transcripts.length === 0) {
      console.warn(`⚠️ fileId=${fileId} 没有转录记录，可以直接刷新页面触发首次转录`);
      return true;
    }
    await db.transaction("rw", [db.transcripts, db.segments], async () => {
      for (const t of transcripts) {
        if (t.id !== undefined) {
          await db.segments.where("transcriptId").equals(t.id).delete();
          await db.transcripts.delete(t.id);
        }
      }
    });
    console.log(
      `✅ 已删除 ${transcripts.length} 条转录及其 segments。请刷新此页面或返回首页再次点进文件，会按当前 settings 的学习语言重新转录。`,
    );
    return true;
  } catch (error) {
    console.error("❌ 清理转录失败:", error);
    return false;
  }
}

// 导出To window object，方便在浏览器控制台调用
if (typeof window !== "undefined") {
  (window as any).manualPostProcess = manualPostProcess;
  (window as any).retranslateFile = retranslateFile;
  (window as any).retranscribeFile = retranscribeFile;
}
