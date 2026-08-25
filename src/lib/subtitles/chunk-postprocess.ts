/**
 * 客户端分片翻译编排。
 * 服务端 /api/postprocess 实际只校验段数：0 段报 NO_SEGMENTS，>100 段报 TOO_MANY_SEGMENTS。
 * 下面的 10000 字符上限是客户端自定策略（控制单次请求体与延迟），服务端并不校验字符数。
 * 注意：串行只是避免并发，并不构成限流保护。/api/postprocess 限 20 次/分钟，
 * 分片数超过 20 且响应够快时仍会撞 429；而任何非 2xx（含 429）都会直接终止剩余分片，无重试。
 */

export interface ChunkSegment {
  segmentIndex: number // 全局 index，跨片保持，回写靠它
  start: number
  end: number
  text: string
}

export interface ProcessedSegment {
  segmentIndex: number
  normalizedText?: string
  translation?: string
  annotations?: string[]
  furigana?: string
}

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
  /** 每片成功后回调（调用方负责写库 + invalidate 查询，实现逐片上屏） */
  onChunkDone: (
    processed: ProcessedSegment[],
    chunkIndex: number,
    totalChunks: number,
  ) => Promise<void> | void
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>
}

export interface RunChunkedResult {
  completedChunks: number
  totalChunks: number
  failed: boolean
  error?: string
}

export async function runChunkedPostProcess(opts: RunChunkedOptions): Promise<RunChunkedResult> {
  const { segments, language, targetLanguage, enableFurigana, onChunkDone } = opts
  const fetchImpl = opts.fetchImpl ?? fetch
  const chunks = chunkSegmentsForPostProcess(segments)
  let completed = 0

  for (let i = completed; i < chunks.length; i++) {
    try {
      const response = await fetchImpl('/api/postprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: chunks[i],
          language,
          targetLanguage,
          enableAnnotations: true,
          enableFurigana,
        }),
      })
      if (!response.ok) {
        return {
          completedChunks: completed,
          totalChunks: chunks.length,
          failed: true,
          error: `postprocess HTTP ${response.status}`,
        }
      }
      const json = await response.json()
      if (!json.success || !json.data?.segments) {
        return {
          completedChunks: completed,
          totalChunks: chunks.length,
          failed: true,
          error: 'postprocess invalid response',
        }
      }
      await onChunkDone(json.data.segments as ProcessedSegment[], i, chunks.length)
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
