import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AI_PROVIDERS } from '~/lib/ai/catalog'

/**
 * CSP 与供应商目录必须保持同步。
 *
 * 背景：BYOK 是**浏览器直连**供应商，因此每个供应商的域名都必须在
 * `public/_headers` 的 `connect-src` 白名单里。若新增供应商却忘了改 CSP，
 * 表现为"填了 key 也无法翻译"，而线索只出现在浏览器控制台的 CSP 拦截日志里 ——
 * 属于很难定位的静默失效。这个测试把它变成构建期的显式失败。
 */
function loadHeaders(): string {
  // 从仓库根读取：vitest 的 cwd 就是项目根
  return readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')
}

function connectSrcDirectives(headers: string): string[] {
  const line = headers.split('\n').find((l) => l.includes('Content-Security-Policy-Report-Only'))
  if (!line) return []
  const policy = line.slice(line.indexOf(':') + 1)
  const directive = policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('connect-src'))
  if (!directive) return []
  return directive.split(/\s+/).slice(1)
}

describe('public/_headers 与 AI 供应商目录同步', () => {
  const headers = loadHeaders()

  it('每个供应商端点都被 CSP 的 connect-src 允许', () => {
    const allowed = connectSrcDirectives(headers)
    expect(allowed.length).toBeGreaterThan(0)

    for (const provider of AI_PROVIDERS) {
      const origin = new URL(provider.endpoint).origin
      expect(allowed, `${provider.id} 的 ${origin} 未出现在 CSP connect-src`).toContain(origin)
    }
  })

  it('connect-src 至少允许同源（/api/* 的服务器路径）', () => {
    expect(connectSrcDirectives(headers)).toContain("'self'")
  })

  it('CSP 里禁止内联之外的宽松项：不含 unsafe-eval 与通配符来源', () => {
    const policy = headers.slice(headers.indexOf('Content-Security-Policy-Report-Only'))
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).not.toContain('connect-src *')
    // script-src 不该放开任意 https 来源
    expect(policy).not.toMatch(/script-src[^;]*\shttps:\s/)
  })

  it('YouTube 播放器所需来源在白名单内（script-src / frame-src）', () => {
    expect(headers).toContain('https://www.youtube.com')
    expect(headers).toContain('https://www.youtube-nocookie.com')
  })
})
