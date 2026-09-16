/**
 * 后处理的两种传输方式，二选一：
 *
 * | 引擎 | 走哪条路 | key 在哪 | 谁付费 |
 * |---|---|---|---|
 * | `server`（默认） | `POST /api/postprocess` → Worker → Groq | 服务器 secret | 我们（有额度上限） |
 * | 任一供应商 | **浏览器直连**供应商端点 | 用户本机 localStorage | 用户自己的额度 |
 *
 * 两条路径共用 `~shared/ai/postprocess-core` 里同一份 prompt 与解析逻辑，
 * 所以输出形状与降级行为一致，差别只在"谁来回答"。
 *
 * 安全不变量：`server` 传输的请求体里**绝不包含**任何用户 key。有测试守着这一条。
 */

import {
  type ChatFn,
  FatalEngineError,
  type PostProcessOptions,
  type PostProcessResult,
  type PostProcessSegmentInput,
  processSegmentsWithChat,
} from '~shared/ai/postprocess-core'
import { AI_PROVIDERS, findProvider, SERVER_ENGINE_ID } from './catalog'
import { getSelectedEngineId, getStoredKey, getStoredModel } from './keys'
import {
  buildWireRequest,
  describeWireError,
  isFatalWireStatus,
  parseWireResponse,
} from './protocol'

export interface PostProcessTransport {
  /** 用于 UI 显示当前走的是哪条链路 */
  id: string
  run(
    segments: PostProcessSegmentInput[],
    options: PostProcessOptions,
  ): Promise<PostProcessResult[]>
}

/** 服务器额度：沿用既有 `/api/postprocess` 契约（Worker 侧已改成调用共享内核）。*/
export function createServerTransport(fetchImpl: typeof fetch = fetch): PostProcessTransport {
  return {
    id: SERVER_ENGINE_ID,
    async run(segments, options) {
      const response = await fetchImpl('/api/postprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          language: options.language,
          targetLanguage: options.targetLanguage,
          enableAnnotations: options.enableAnnotations ?? true,
          enableFurigana: options.enableFurigana ?? false,
        }),
      })
      if (!response.ok) {
        throw new Error(`postprocess HTTP ${response.status}`)
      }
      const json = (await response.json()) as {
        success?: boolean
        data?: { segments?: PostProcessResult[] }
      }
      if (!json.success || !json.data?.segments) {
        throw new Error('postprocess invalid response')
      }
      return json.data.segments
    },
  }
}

/**
 * 把一次 chat 请求直连发到供应商，返回模型原始文本。
 *
 * 这里**声明哪些失败是系统性**（抛 `FatalEngineError`），内核负责别吞掉它们：
 * BYOK 最常见的失败恰恰是配置问题（key 打错、额度用完、跨域被拦），换一段文本重试
 * 也一样失败。若被内核降级成"保留原文"，用户会看到一份空翻译却标着"已完成"，
 * 既不知道 key 有问题，改完也不会重试。
 * 只有单次调用失败（5xx / 超时）才交回内核降级。
 */
function createDirectChat(providerId: string, apiKey: string, model: string): ChatFn {
  const provider = findProvider(providerId)
  if (!provider) throw new Error(`unknown AI provider: ${providerId}`)

  return async (req) => {
    const wire = buildWireRequest(provider, model, apiKey, req)

    let response: Response
    try {
      response = await fetch(wire.url, {
        method: wire.method,
        headers: wire.headers,
        body: wire.body,
      })
    } catch (error) {
      // 网络不可达 / 被 CORS 拦截：整套配置都跑不通，属系统性失败
      const msg = error instanceof Error ? error.message : String(error)
      throw new FatalEngineError(`NETWORK_ERROR: ${msg}`, 'NETWORK_ERROR')
    }

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      // 有些网关在 5xx 时返回 HTML；下面按状态码给错误即可
    }

    if (!response.ok) {
      const described = describeWireError(response.status, payload)
      if (isFatalWireStatus(response.status)) {
        throw new FatalEngineError(described, 'ENGINE_UNAVAILABLE')
      }
      throw new Error(described)
    }

    try {
      return parseWireResponse(provider, payload)
    } catch (error) {
      // 形状始终不符（端点或模型不对）→ 同样是配置问题，不该被静默降级
      const msg = error instanceof Error ? error.message : String(error)
      throw new FatalEngineError(`BAD_RESPONSE_SHAPE: ${msg}`, 'BAD_RESPONSE_SHAPE')
    }
  }
}

/** BYOK：用户自己的 key 直连供应商，我们不经手。*/
export function createDirectTransport(
  providerId: string,
  apiKey: string,
  model: string,
): PostProcessTransport {
  const chat = createDirectChat(providerId, apiKey, model)
  return {
    id: providerId,
    run: (segments, options) => processSegmentsWithChat(segments, options, chat),
  }
}

export interface ResolvedEngine {
  transport: PostProcessTransport
  /** 实际生效的引擎 id。选了 BYOK 但没填 key 时会回退成 server。 */
  engineId: string
  /** 是否发生了"选了 BYOK 但缺 key → 回退" */
  fellBackToServer: boolean
}

/**
 * 按本地设置解析出实际要用的传输方式。
 *
 * 回退规则：选了某供应商但没存 key（或供应商 id 未知）→ 用服务器额度，
 * 并把 `fellBackToServer` 标出来，让 UI 能说明"你选了 BYOK 但还没填 key，当前走免费额度"，
 * 而不是让用户对着一个静默失败的按钮发呆。
 */
export function resolveEngine(fetchImpl: typeof fetch = fetch): ResolvedEngine {
  const engineId = getSelectedEngineId()

  if (engineId !== SERVER_ENGINE_ID) {
    const provider = findProvider(engineId)
    const apiKey = provider ? getStoredKey(provider.id) : null
    if (provider && apiKey) {
      const model = getStoredModel(provider.id) ?? provider.defaultModel
      return {
        transport: createDirectTransport(provider.id, apiKey, model),
        engineId,
        fellBackToServer: false,
      }
    }
    return {
      transport: createServerTransport(fetchImpl),
      engineId: SERVER_ENGINE_ID,
      fellBackToServer: true,
    }
  }

  return {
    transport: createServerTransport(fetchImpl),
    engineId: SERVER_ENGINE_ID,
    fellBackToServer: false,
  }
}

/** 全部供应商 id，供清理设置时遍历（避免在 UI 里硬编码）。*/
export const ALL_PROVIDER_IDS: readonly string[] = AI_PROVIDERS.map((p) => p.id)
