import type { Context } from 'hono'
import { apiError } from './api-response'
import type { Env } from './types'

/**
 * JSON 请求体上限。
 *
 * 客户端一片最多 100 段 / 10k 字符（见 `src/lib/subtitles/chunk-postprocess.ts`），
 * 序列化后远小于 256 KB，正常请求绝不会碰到这个上限。
 */
export const MAX_JSON_BODY_BYTES = 256 * 1024

type Ctx = Context<{ Bindings: Env }>

function tooLargeResponse(maxBytes: number): Response {
  return apiError({
    code: 'PAYLOAD_TOO_LARGE',
    message: `请求体超过上限（${maxBytes} 字节）`,
    statusCode: 413,
  })
}

/**
 * 按上限读取请求体文本。返回 `{ ok: false }` 表示应当直接返回该响应。
 *
 * 两道防线，缺一不可：
 *
 * 1. **快速路径**：`Content-Length` 已声明且超限 → 不读一个字节就拒。
 * 2. **流式封顶**：逐块累加，超限即 `cancel()` 并拒。
 *
 * 为什么不能只靠第 1 条：`Content-Length` 可能缺失（客户端用 chunked 编码）或被**谎报**得偏小，
 * 那时若直接 `await c.req.json()`，整个 body 会先被读进内存并解析 —— 攻击者在被拒之前
 * 已经让我们付出了全额内存与 CPU。在无限流的情况下这足以打爆 Worker。
 *
 * 也刻意**不要求**该头必须存在：不同接入方式（本地 Hono 调用、代理转发、chunked 上传）
 * 是否带上它并不一致，把"必须带"当策略会误伤正常请求。第 2 条才是真正的保证。
 */
export async function readBodyTextWithLimit(
  c: Ctx,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
  const declared = Number(c.req.header('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: tooLargeResponse(maxBytes) }
  }

  const stream = c.req.raw.body
  if (!stream) return { ok: true, text: '' }

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return { ok: false, response: tooLargeResponse(maxBytes) }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true, text: new TextDecoder().decode(merged) }
}

/**
 * 读并解析 JSON 请求体。体积超限 → 413；JSON 非法 → 400
 * （不透传原始解析错误，既避免泄漏内部信息，也给客户端稳定错误码）。
 */
export async function readJsonBody<T>(
  c: Ctx,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<{ ok: true; body: T } | { ok: false; response: Response }> {
  const read = await readBodyTextWithLimit(c, maxBytes)
  if (!read.ok) return read

  try {
    return { ok: true, body: JSON.parse(read.text) as T }
  } catch {
    return {
      ok: false,
      response: apiError({
        code: 'VALIDATION_ERROR',
        message: '请求体不是合法 JSON',
        statusCode: 400,
      }),
    }
  }
}
