/**
 * 把中立的 `ChatRequest` 映射成各家供应商的**线上格式**，以及从响应里取回文本。
 *
 * 纯函数：不碰 fetch、不碰 storage。传输层负责真的发出去。
 * 分开的理由有两个协议差异很大（Anthropic 的 system 是顶层参数、必填 max_tokens、
 * 没有 response_format、响应是 content 数组），这些差异集中在这里，内核与 UI 都不感知。
 */

import type { ChatRequest } from '~shared/ai/postprocess-core'
import type { AiProvider } from './catalog'

/**
 * Anthropic 要求 `max_tokens` 必填。一次请求最多覆盖 100 个 segment（客户端分片上限），
 * 8192 对 claude-3-5-haiku 是安全上限；给小了会把长批次的输出截断成非法 JSON，
 * 结果整批降级（不报错但也没翻译）。
 */
const ANTHROPIC_MAX_TOKENS = 8192

/** Anthropic 官方就有的浏览器直连开关，必须显式带上。*/
const ANTHROPIC_BROWSER_HEADER = 'anthropic-dangerous-direct-browser-access'

export interface WireRequest {
  url: string
  method: 'POST'
  headers: Record<string, string>
  body: string
}

/** 构造线上请求。`apiKey` 只进请求头，绝不出现在 body 或日志里。*/
export function buildWireRequest(
  provider: AiProvider,
  model: string,
  apiKey: string,
  req: ChatRequest,
): WireRequest {
  const common = { 'content-type': 'application/json' }

  if (provider.protocol === 'anthropic') {
    return {
      url: provider.endpoint,
      method: 'POST',
      headers: {
        ...common,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        [ANTHROPIC_BROWSER_HEADER]: 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        temperature: req.temperature,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      }),
    }
  }

  return {
    url: provider.endpoint,
    method: 'POST',
    headers: { ...common, authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: req.temperature,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      // 只有确认支持 JSON 模式的协议才带这个字段
      ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * 从响应 JSON 里取出模型文本。
 *
 * 形状不符时抛错 —— 由内核捕获并降级为"保留原文"。这里不返回空串，因为空串会被
 * 下游当成"模型说了空话"，而抛错能走统一降级路径，语义更清楚。
 */
export function parseWireResponse(provider: AiProvider, payload: unknown): string {
  if (provider.protocol === 'anthropic') {
    const content = isRecord(payload) ? payload.content : undefined
    if (!Array.isArray(content)) {
      throw new Error(`anthropic: unexpected response shape from ${provider.id}`)
    }
    const text = content.find(
      (part): part is { type: string; text: string } =>
        isRecord(part) && part.type === 'text' && typeof part.text === 'string',
    )
    if (!text) throw new Error(`anthropic: no text block from ${provider.id}`)
    return text.text
  }

  const choices = isRecord(payload) ? payload.choices : undefined
  const first = Array.isArray(choices) ? choices[0] : undefined
  const message = isRecord(first) ? first.message : undefined
  const content = isRecord(message) ? message.content : undefined
  if (typeof content !== 'string') {
    throw new Error(`openai-compatible: unexpected response shape from ${provider.id}`)
  }
  return content
}

/**
 * 把供应商返回的错误体变成一句可展示的话。
 * 关键是识别 401/403（key 无效）与 429（配额/限流），这两种用户需要不同的动作。
 */
export function describeWireError(status: number, payload: unknown): string {
  const message =
    isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
      ? payload.error.message
      : undefined
  const suffix = message ? `: ${message}` : ''
  if (status === 401 || status === 403) return `INVALID_KEY (${status}${suffix})`
  if (status === 429) return `RATE_LIMITED (429${suffix})`
  return `HTTP ${status}${suffix}`
}

/**
 * HTTP 状态 → 失败归类的**唯一判据**（纯函数，可单测）。
 *
 * | 归类 | 状态 | 含义 | 上层行为 |
 * |---|---|---|---|
 * | `fatal` | 401 / 403 / 404 | key 无效、无权限、端点或模型不存在 | 立即失败并让用户看到（重试无用） |
 * | `retryable` | 408 / 429 / 5xx | 超时、限流/配额、临时服务端故障 | 退避重试；仍失败则如实报错 |
 *
 * 为什么 429 是"可重试"而不是"致命"：限流会随时间恢复，退避重试能救；
 * 而**不能**降级 —— 限流是按请求计的，降级会把整片空翻译写成"成功"。
 */
export type WireStatusClass = 'fatal' | 'retryable' | 'ok'

export function classifyWireStatus(status: number): WireStatusClass {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401 || status === 403 || status === 404) return 'fatal'
  if (status === 408 || status === 429 || status >= 500) return 'retryable'
  // 其余 4xx（如 400 请求体不合法）重试也没用
  return 'fatal'
}

/**
 * 解析 `Retry-After` 头。只支持秒数形式（HTTP-date 形式罕见，返回 null 让调用方退回自身退避）。
 * 上限夹在 60s：服务端给一个离谱的值时不该让用户干等。
 */
export function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null
  const seconds = Number(headerValue.trim())
  if (!Number.isFinite(seconds) || seconds < 0) return null
  return Math.min(seconds, 60)
}
