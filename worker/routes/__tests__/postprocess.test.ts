import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { MAX_JSON_BODY_BYTES } from '../../lib/body-guard'
import type { Env } from '../../lib/types'
import { postprocessRoute } from '../postprocess'

const app = new Hono<{ Bindings: Env }>()
app.route('/api/postprocess', postprocessRoute)

/** 带一个假的 GROQ_API_KEY，让流程能走到校验之后的阶段。 */
const testEnv: Env = { GROQ_API_KEY: 'test-key', ASSETS: {} as Env['ASSETS'] }

function post(body: BodyInit, headers: Record<string, string> = {}) {
  return app.request(
    '/api/postprocess',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    },
    testEnv,
  )
}

describe('POST /api/postprocess 的请求体防护', () => {
  it('超过上限的请求体在解析前被拒（413）', async () => {
    // 构造一个明显超限的合法 JSON：约 300 KB
    const big = JSON.stringify({
      segments: [{ text: 'x'.repeat(300 * 1024), start: 0, end: 1 }],
    })
    expect(big.length).toBeGreaterThan(MAX_JSON_BODY_BYTES)

    const res = await post(big)
    expect(res.status).toBe(413)
    const json = (await res.json()) as { error?: { code?: string } }
    expect(json.error?.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('正常大小的请求体照常进入业务校验（空 segments → 400 NO_SEGMENTS）', async () => {
    const res = await post(JSON.stringify({ segments: [] }))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error?: { code?: string } }
    expect(json.error?.code).toBe('NO_SEGMENTS')
  })

  it('非法 JSON 返回稳定的 400，而不是把解析错误原文透出去', async () => {
    const res = await post('{ not json')
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error?: { code?: string; message?: string } }
    expect(json.error?.code).toBe('VALIDATION_ERROR')
    expect(json.error?.message).toBe('请求体不是合法 JSON')
  })

  it('谎报小 Content-Length 也无法绕过（流式封顶仍然拒）', async () => {
    const big = 'x'.repeat(300 * 1024)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ note: big })))
        controller.close()
      },
    })
    // 故意声明一个很小的长度
    const res = await post(body, { 'content-length': '10' })
    expect(res.status).toBe(413)
    const json = (await res.json()) as { error?: { code?: string } }
    expect(json.error?.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('小体积的正常请求不受封顶影响（快路径与流式路径都放行）', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ segments: [] })))
        controller.close()
      },
    })
    const res = await post(stream)
    expect(res.status).toBe(400) // 通过封顶 → 进入业务校验 → NO_SEGMENTS
    const json = (await res.json()) as { error?: { code?: string } }
    expect(json.error?.code).toBe('NO_SEGMENTS')
  })

  it('未配置 GROQ_API_KEY 时返回 CONFIG_ERROR（健康检查之外的显式失败）', async () => {
    const res = await app.request(
      '/api/postprocess',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ segments: [] }),
      },
      { ASSETS: {} as Env['ASSETS'] } as Env,
    )
    expect(res.status).toBe(500)
    const json = (await res.json()) as { error?: { code?: string } }
    expect(json.error?.code).toBe('CONFIG_ERROR')
  })
})
