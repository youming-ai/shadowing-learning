/**
 * 客户端分片翻译编排。
 *
 * 本模块只负责**分片与逐片回写**，不关心"谁来翻译"：具体链路由注入的
 * `PostProcessTransport` 决定（服务器额度 / 用户自带 key 直连供应商，见 `~/lib/ai/transports`）。
 * 这样 BYOK 与默认额度共用同一套分片、重试语义与逐片上屏行为。
 *
 * 服务端 /api/postprocess 实际只校验段数：0 段报 NO_SEGMENTS，>100 段报 TOO_MANY_SEGMENTS。
 * 下面的 10000 字符上限是客户端自定策略（控制单次请求体与延迟），服务端并不校验字符数。
 * 注意：串行只是避免并发，并不构成限流保护。/api/postprocess 限 20 次/分钟，
 * 分片数超过 20 且响应够快时仍会撞 429；而任何非 2xx（含 429）都会直接终止剩余分片，无重试。
 */

import type { PostProcessTransport } from '~/lib/ai/transports'
import type { PostProcessOptions, PostProcessResult } from '~shared/ai/postprocess-core'

export interface ChunkSegment {
  segmentIndex: number // 全局 index，跨片保持，回写靠它
  start: number
  end: number
  text: string
}

export type ProcessedSegment = PostProcessResult

const MAX_SEGMENTS_PER_CHUNK = 100
const MAX_CHARS_PER_CHUNK = 10_000

export function chunkSegmentsForPostProcess(segments: ChunkSegment[]): ChunkSegment[][] {
  const chunks: ChunkSegment[][] = []
  let current: ChunkSegment[] = []
  let chars = 0
  for (const s of segments) {
    const len = s.text.length
    if (
      current.length >= MAX_SEGMENTS_PER_CHUNK ||
      (current.length > 0 && chars + len > MAX_CHARS_PER_CHUNK)
    ) {
      chunks.push(current)
      current = []
      chars = 0
    }
    current.push(s)
    chars += len
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

export interface RunChunkedOptions {
  segments: ChunkSegment[]
  language: string
  targetLanguage: string
  enableFurigana: boolean
  /** 实际执行翻译的链路（服务器额度或 BYOK 直连）。*/
  transport: PostProcessTransport
  /** 每片成功后回调（调用方负责写库 + invalidate 查询，实现逐片上屏） */
  onChunkDone: (
    processed: ProcessedSegment[],
    chunkIndex: number,
    totalChunks: number,
  ) => Promise<void> | void
}

export interface RunChunkedResult {
  completedChunks: number
  totalChunks: number
  failed: boolean
  error?: string
}

export async function runChunkedPostProcess(opts: RunChunkedOptions): Promise<RunChunkedResult> {
  const { segments, language, targetLanguage, enableFurigana, transport, onChunkDone } = opts
  const chunks = chunkSegmentsForPostProcess(segments)
  const processOptions: PostProcessOptions = {
    language,
    targetLanguage,
    // 注释目前恒开：UI 还没有单独开关，与既有行为保持一致
    enableAnnotations: true,
    enableFurigana,
  }
  let completed = 0

  for (let i = completed; i < chunks.length; i++) {
    try {
      const processed = await transport.run(chunks[i], processOptions)
      await onChunkDone(processed, i, chunks.length)
      completed = i + 1
    } catch (error) {
      return {
        completedChunks: completed,
        totalChunks: chunks.length,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return { completedChunks: completed, totalChunks: chunks.length, failed: false }
}
