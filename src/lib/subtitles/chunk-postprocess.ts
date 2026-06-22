/**
 * 客户端分片翻译编排。
 * 服务端 /api/postprocess 硬限制：≤100 段、总文本 ≤10000 字符、单段 ≤2000 字符，
 * 单请求一次性返回——所以分片、串行（天然满足其 20 次/分钟限流）、逐片回写都在客户端做。
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
  /** 断点续传：跳过前 N 片（已完成片数） */
  startAtChunk?: number
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
  let completed = opts.startAtChunk ?? 0

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
