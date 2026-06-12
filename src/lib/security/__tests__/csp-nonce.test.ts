// @vitest-environment node
// 用 node 环境：默认 happy-dom 下 `typeof window !== 'undefined'` 为真，getCspNonce()
// 会走浏览器分支恒返回 undefined，测不到服务端 nonce 传递路径。buildContentSecurityPolicy
// 是纯函数，在 node 环境下同样可测。
import { describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  createCspNonce,
  getCspNonce,
  runWithCspNonce,
} from '~/lib/security/csp-nonce'

describe('CSP for YouTube embedding', () => {
  const csp = buildContentSecurityPolicy('testnonce')
  it('allows YouTube iframes', () => {
    expect(csp).toContain('frame-src https://www.youtube.com https://www.youtube-nocookie.com')
  })
  it('allows iframe_api scripts from youtube.com', () => {
    expect(csp).toMatch(/script-src[^;]*https:\/\/www\.youtube\.com/)
  })
  it('keeps frame-ancestors none (we embed others, nobody embeds us)', () => {
    expect(csp).toContain("frame-ancestors 'none'")
  })
})

describe('CSP nonce propagation (server)', () => {
  it('getCspNonce() synchronously reads the nonce set by runWithCspNonce', async () => {
    const nonce = createCspNonce()
    // 回归守卫：getCspNonce 曾被 stub 成恒 undefined，导致 SSR 内联脚本拿不到 nonce、生产被 CSP 拦截
    const read = await runWithCspNonce(nonce, () => getCspNonce())
    expect(read).toBe(nonce)
  })

  it('returns undefined outside any runWithCspNonce context', () => {
    expect(getCspNonce()).toBeUndefined()
  })

  it('createCspNonce produces a dash-free hex token', () => {
    const nonce = createCspNonce()
    expect(nonce).toMatch(/^[a-f0-9]+$/)
    expect(nonce).not.toContain('-')
  })
})
