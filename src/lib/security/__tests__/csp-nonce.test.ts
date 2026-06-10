import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from '~/lib/security/csp-nonce'

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
