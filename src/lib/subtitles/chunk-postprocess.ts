/**
 * 客户端分片翻译编排。
 *
 * 本模块只负责**分片与逐片回写**，不关心"谁来翻译"：具体链路由注入的
 * `PostProcessTransport` 决定（服务器额度 / 用户自带 key 直连供应商，见 `~/lib/ai/transports`）。
 * 这样 BYOK 与默认额度共用同一套分片、重试语义与逐片上屏行为。
 *
 * 服务端 /api/postprocess 实际只校验段数：0 段报 NO_SEGMENTS，>100 段报 TOO_MANY_SEGMENTS。
 * 下面的 10000 字符上限是客户端自定策略（控制单次请求体与延迟），服务端并不校验字符数。
 * 注意：串行只是避免并发，并不构成限流保护。服务端 `/api/postprocess` 限 20 次/分钟，
 * 分片数超过 20 时必然撞 429 —— 因此这里对**可重试**失败做退避重试（见 `RETRY_POLICY`），
 * 并尊重服务端的 `Retry-After`。没有这层重试就不能开启限流：长视频会被打成部分翻译。
 */

import type { PostProcessTransport } from '~/lib/ai/transports'
import {
  isRetryableEngineError,
  type PostProcessOptions,
  type PostProcessResult,
} from '~shared/ai/postprocess-core'

/**
 * 可重试失败的退避策略。
 *
 * 只对 `RetryableEngineError`（429 / 408 / 5xx）生效；系统性失败（无效 key、端点错）
 * 立即放弃，因为重试没有意义。
 *
 * 为什么必须有它：服务端限流是 20 req/60s，而分片按片计请求。一个 2000 段以上的视频
 * 会产生 >20 片，没有退避就必然中途 429 并丢掉剩余分片。**重试与开启限流必须同时上线。**
 */
export const RETRY_POLICY = {
  /** 单片最多尝试次数（含首次） */
  maxAttempts: 4,
  /** 首次退避基准（毫秒） */
  baseDelayMs: 1500,
  /** 单次退避上限（毫秒） */
  maxDelayMs: 20_000,
} as const

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

/** 带 jitter 的指数退避；服务端给了 Retry-After 就听服务端的。 */
function nextDelayMs(attempt: number, retryAfterSec: number | null, policy: RetryPolicy): number {
  if (retryAfterSec !== null) return Math.min(retryAfterSec * 1000, policy.maxDelayMs)
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1)
  // jitter：避免多个客户端在同一时刻一起重试
  const jitter = exponential * 0.25 * Math.random()
  return Math.min(exponential + jitter, policy.maxDelayMs)
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

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
  /** 覆盖重试策略（测试用） */
  retryPolicy?: Partial<RetryPolicy>
  /** 注入 sleep（测试用，避免真等） */
  sleep?: (ms: number) => Promise<void>
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
  const policy: RetryPolicy = { ...RETRY_POLICY, ...opts.retryPolicy }
  const sleep = opts.sleep ?? defaultSleep
  let completed = 0

  for (let i = completed; i < chunks.length; i++) {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        const processed = await transport.run(chunks[i], processOptions)
        await onChunkDone(processed, i, chunks.length)
        completed = i + 1
        lastError = null
        break
      } catch (error) {
        lastError = error
        // 只有可重试失败才继续；系统性失败（无效 key / 端点错）立即放弃
        if (!isRetryableEngineError(error) || attempt === policy.maxAttempts) break
        await sleep(nextDelayMs(attempt, error.retryAfterSec, policy))
      }
    }

    if (lastError) {
      const message = lastError instanceof Error ? lastError.message : String(lastError)
      const tried = isRetryableEngineError(lastError) ? `（已重试 ${policy.maxAttempts} 次）` : ''
      return {
        completedChunks: completed,
        totalChunks: chunks.length,
        failed: true,
        error: `${message}${tried}`,
      }
    }
  }
  return { completedChunks: completed, totalChunks: chunks.length, failed: false }
}
