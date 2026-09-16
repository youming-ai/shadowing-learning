import { describe, expect, it } from 'vitest'
import {
  AI_PROVIDERS,
  type AiProvider,
  findProvider,
  isBringYourOwn,
  SERVER_ENGINE_ID,
} from '~/lib/ai/catalog'
import {
  clearStoredKey,
  getStoredKey,
  maskKey,
  setSelectedEngineId,
  setStoredKey,
} from '~/lib/ai/keys'
import { buildWireRequest, describeWireError, parseWireResponse } from '~/lib/ai/protocol'
import { createDirectTransport, createServerTransport, resolveEngine } from '~/lib/ai/transports'

/** 目录里必然存在；缺失就让测试直接失败（比非空断言更明确）。*/
function provider(id: string): AiProvider {
  const found = findProvider(id)
  if (!found) throw new Error(`catalog is missing provider: ${id}`)
  return found
}

const groq = provider('groq')
const anthropic = provider('anthropic')

const chatReq = {
  system: 'sys',
  user: 'usr',
  temperature: 0.2,
  jsonMode: true,
}

describe('catalog', () => {
  it('每条供应商数据都完整（缺字段会让 UI 出现空选项）', () => {
    for (const p of AI_PROVIDERS) {
      expect(p.id, 'id').toBeTruthy()
      expect(p.label, `${p.id} label`).toBeTruthy()
      expect(p.endpoint.startsWith('https://'), `${p.id} endpoint`).toBe(true)
      expect(p.defaultModel, `${p.id} defaultModel`).toBeTruthy()
      expect(p.suggestedModels.length, `${p.id} suggestedModels`).toBeGreaterThan(0)
      expect(p.suggestedModels).toContain(p.defaultModel)
      expect(p.keysUrl.startsWith('https://'), `${p.id} keysUrl`).toBe(true)
    }
  })

  it('id 唯一', () => {
    const ids = AI_PROVIDERS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('供应商 id 不会与服务器引擎冲突', () => {
    expect(AI_PROVIDERS.some((p) => p.id === SERVER_ENGINE_ID)).toBe(false)
  })

  it('isBringYourOwn 只对真实供应商为真', () => {
    expect(isBringYourOwn(SERVER_ENGINE_ID)).toBe(false)
    expect(isBringYourOwn('groq')).toBe(true)
    expect(isBringYourOwn('nope')).toBe(false)
  })
})

describe('buildWireRequest', () => {
  it('openai 协议：Bearer 鉴权 + JSON 模式 + system 作为消息', () => {
    const wire = buildWireRequest(groq, 'm', 'sk-secret', chatReq)
    expect(wire.headers.authorization).toBe('Bearer sk-secret')
    const body = JSON.parse(wire.body)
    expect(body.model).toBe('m')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'usr' })
  })

  it('openai 协议：关掉 JSON 模式时不带 response_format', () => {
    const body = JSON.parse(buildWireRequest(groq, 'm', 'k', { ...chatReq, jsonMode: false }).body)
    expect(body.response_format).toBeUndefined()
  })

  it('anthropic 协议：x-api-key + 版本头 + 浏览器直连开关 + 顶层 system + 必填 max_tokens', () => {
    const wire = buildWireRequest(anthropic, 'claude', 'sk-ant', chatReq)
    expect(wire.headers['x-api-key']).toBe('sk-ant')
    expect(wire.headers['anthropic-version']).toBe('2023-06-01')
    expect(wire.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    // Anthropic 不用 Authorization，漏了这条会被当匿名请求
    expect(wire.headers.authorization).toBeUndefined()

    const body = JSON.parse(wire.body)
    expect(body.system).toBe('sys')
    expect(body.max_tokens).toBeGreaterThan(0)
    expect(body.messages).toEqual([{ role: 'user', content: 'usr' }])
    // Anthropic 没有 response_format，不该硬塞
    expect(body.response_format).toBeUndefined()
  })

  it('key 只出现在请求头，绝不出现在 body', () => {
    for (const p of AI_PROVIDERS) {
      const wire = buildWireRequest(p, 'm', 'sk-very-secret', chatReq)
      expect(wire.body.includes('sk-very-secret'), `${p.id} body 泄漏 key`).toBe(false)
    }
  })
})

describe('parseWireResponse', () => {
  it('openai 形状取 choices[0].message.content', () => {
    expect(parseWireResponse(groq, { choices: [{ message: { content: 'hi' } }] })).toBe('hi')
  })

  it('anthropic 形状从 content 数组里挑 text 块', () => {
    const payload = {
      content: [
        { type: 'thinking', thinking: '...' },
        { type: 'text', text: 'hi' },
      ],
    }
    expect(parseWireResponse(anthropic, payload)).toBe('hi')
  })

  it('形状不符时抛错（交给内核降级，而不是悄悄返回空串）', () => {
    expect(() => parseWireResponse(groq, { nope: 1 })).toThrow()
    expect(() => parseWireResponse(anthropic, { content: [] })).toThrow()
    expect(() => parseWireResponse(anthropic, {})).toThrow()
  })
})

describe('describeWireError', () => {
  it('区分无效 key 与限流，便于 UI 给不同指引', () => {
    expect(describeWireError(401, null)).toContain('INVALID_KEY')
    expect(describeWireError(403, null)).toContain('INVALID_KEY')
    expect(describeWireError(429, null)).toContain('RATE_LIMITED')
    expect(describeWireError(500, null)).toContain('HTTP 500')
  })

  it('带上供应商返回的错误消息', () => {
    const msg = describeWireError(401, { error: { message: 'bad key' } })
    expect(msg).toContain('bad key')
  })
})

describe('keys', () => {
  it('存取与清除', () => {
    clearStoredKey('groq')
    expect(getStoredKey('groq')).toBeNull()
    setStoredKey('groq', '  sk-abc  ')
    expect(getStoredKey('groq')).toBe('sk-abc')
    clearStoredKey('groq')
    expect(getStoredKey('groq')).toBeNull()
  })

  it('空白 key 视为未设置', () => {
    setStoredKey('openai', '   ')
    expect(getStoredKey('openai')).toBeNull()
    clearStoredKey('openai')
  })

  it('不同供应商的 key 互不覆盖', () => {
    setStoredKey('groq', 'k-groq')
    setStoredKey('openai', 'k-openai')
    expect(getStoredKey('groq')).toBe('k-groq')
    expect(getStoredKey('openai')).toBe('k-openai')
    clearStoredKey('groq')
    clearStoredKey('openai')
  })

  it('掩码不泄漏长度与中段', () => {
    expect(maskKey('sk-1234567890abcdef')).toBe('sk-1••••••••cdef')
    expect(maskKey('short')).toBe('••••••••')
  })
})

describe('BYOK 直连的系统性失败必须暴露出来', () => {
  const seg = [{ segmentIndex: 0, start: 0, end: 1, text: 'a' }]
  const opts = { language: 'ja', targetLanguage: 'en' }

  /** 让 fetch 返回指定状态（响应体可选） */
  function stubFetch(status: number, body: unknown): typeof fetch {
    return (async () =>
      new Response(body === null ? '' : JSON.stringify(body), {
        status,
      })) as unknown as typeof fetch
  }

  async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
    const original = globalThis.fetch
    globalThis.fetch = impl
    try {
      return await fn()
    } finally {
      globalThis.fetch = original
    }
  }

  it('401 无效 key → 抛错，而不是返回空翻译的"成功"', async () => {
    await withFetch(stubFetch(401, { error: { message: 'bad key' } }), async () => {
      await expect(createDirectTransport('groq', 'sk-wrong', 'm').run(seg, opts)).rejects.toThrow(
        'INVALID_KEY',
      )
    })
  })

  it('429 配额耗尽与 404 配置错误同样抛错', async () => {
    await withFetch(stubFetch(429, null), async () => {
      await expect(createDirectTransport('groq', 'k', 'm').run(seg, opts)).rejects.toThrow(
        'RATE_LIMITED',
      )
    })
    await withFetch(stubFetch(404, null), async () => {
      await expect(createDirectTransport('groq', 'k', 'm').run(seg, opts)).rejects.toThrow()
    })
  })

  it('网络 / 跨域失败 → 抛错（整套配置都跑不通，不能静默降级）', async () => {
    const failingFetch = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await withFetch(failingFetch, async () => {
      await expect(createDirectTransport('groq', 'k', 'm').run(seg, opts)).rejects.toThrow(
        'NETWORK_ERROR',
      )
    })
  })

  it('响应形状不对（端点或模型错）→ 抛错', async () => {
    await withFetch(stubFetch(200, { unexpected: true }), async () => {
      await expect(createDirectTransport('groq', 'k', 'm').run(seg, opts)).rejects.toThrow(
        'BAD_RESPONSE_SHAPE',
      )
    })
  })

  it('5xx 属单次调用失败 → 不抛，交给内核降级', async () => {
    await withFetch(stubFetch(503, null), async () => {
      const out = await createDirectTransport('groq', 'k', 'm').run(seg, opts)
      expect(out[0].normalizedText).toBe('a')
    })
  })
})

describe('server transport 的安全不变量', () => {
  it('请求体里不含任何 key', async () => {
    setStoredKey('groq', 'sk-must-not-leak')
    let captured = ''
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      captured = String(init?.body)
      return new Response(JSON.stringify({ success: true, data: { segments: [] } }), {
        status: 200,
      })
    }) as unknown as typeof fetch

    await createServerTransport(fetchImpl).run([{ segmentIndex: 0, start: 0, end: 1, text: 'a' }], {
      language: 'ja',
      targetLanguage: 'en',
    })

    expect(captured.includes('sk-must-not-leak')).toBe(false)
    expect(captured.includes('key')).toBe(false)
    clearStoredKey('groq')
  })

  it('非 2xx 抛错（由分片编排决定是否继续）', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch
    await expect(createServerTransport(fetchImpl).run([], { language: 'ja' })).rejects.toThrow(
      'HTTP 500',
    )
  })
})

describe('resolveEngine', () => {
  it('默认走服务器额度', () => {
    const { transport, engineId, fellBackToServer } = resolveEngine()
    expect(engineId).toBe(SERVER_ENGINE_ID)
    expect(transport.id).toBe(SERVER_ENGINE_ID)
    expect(fellBackToServer).toBe(false)
  })

  it('选了 BYOK 且填了 key 时走直连', () => {
    setStoredKey('groq', 'sk-my-key')
    setSelectedEngineId('groq')
    const { transport, engineId, fellBackToServer } = resolveEngine()
    expect(engineId).toBe('groq')
    expect(transport.id).toBe('groq')
    expect(fellBackToServer).toBe(false)
    clearStoredKey('groq')
    setSelectedEngineId(SERVER_ENGINE_ID)
  })

  it('选了 BYOK 但没填 key 时回退到服务器额度，并标记回退', () => {
    setSelectedEngineId('groq')
    clearStoredKey('groq')
    const { transport, fellBackToServer } = resolveEngine()
    expect(transport.id).toBe(SERVER_ENGINE_ID)
    expect(fellBackToServer).toBe(true)
    setSelectedEngineId(SERVER_ENGINE_ID)
  })

  it('未知引擎 id 也回退到服务器额度，而不是崩掉', () => {
    setSelectedEngineId('ghost-provider')
    const { transport, fellBackToServer } = resolveEngine()
    expect(transport.id).toBe(SERVER_ENGINE_ID)
    expect(fellBackToServer).toBe(true)
    setSelectedEngineId(SERVER_ENGINE_ID)
  })

  it('直连传输层 id 为供应商 id（便于 UI 显示当前链路）', () => {
    expect(createDirectTransport('openai', 'k', 'm').id).toBe('openai')
  })
})
