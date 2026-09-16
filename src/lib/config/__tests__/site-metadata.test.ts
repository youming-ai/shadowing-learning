import { describe, expect, it } from 'vitest'
import {
  buildHeadTags,
  buildRobotsTxt,
  buildSitemapXml,
  normalizeSiteUrl,
  PRIVATE_PATHS,
} from '~/lib/config/site-metadata'

describe('normalizeSiteUrl', () => {
  it('去掉末尾斜杠并 trim', () => {
    expect(normalizeSiteUrl('  https://a.com/  ')).toBe('https://a.com')
    expect(normalizeSiteUrl('https://a.com///')).toBe('https://a.com')
  })

  it('空值与空白视为未配置', () => {
    expect(normalizeSiteUrl(undefined)).toBeUndefined()
    expect(normalizeSiteUrl('')).toBeUndefined()
    expect(normalizeSiteUrl('   ')).toBeUndefined()
  })
})

describe('buildRobotsTxt', () => {
  it('禁止的是真实存在的私有路由（历史 bug：曾 Disallow /player/，该路由不存在）', () => {
    const robots = buildRobotsTxt()
    expect(robots).toContain('Disallow: /watch/')
    expect(robots).toContain('Disallow: /settings')
    expect(robots).toContain('Disallow: /account')
    expect(robots).not.toContain('/player/')
  })

  it('导出的私有路径清单与断言一致（避免有人只改一处）', () => {
    expect([...PRIVATE_PATHS]).toEqual(['/watch/', '/settings', '/account'])
  })

  it('未配置域名时不写 Sitemap 行（相对路径不合规范）', () => {
    const robots = buildRobotsTxt()
    expect(robots).not.toContain('Sitemap:')
    expect(robots).not.toContain('localhost')
  })

  it('配置域名时写入绝对 Sitemap 地址', () => {
    expect(buildRobotsTxt('https://a.com')).toContain('Sitemap: https://a.com/sitemap.xml')
  })
})

describe('buildSitemapXml', () => {
  it('未配置域名时不产出 sitemap（宁可没有，也不写假地址）', () => {
    expect(buildSitemapXml()).toBeNull()
    expect(buildSitemapXml(undefined)).toBeNull()
  })

  it('绝不出现 localhost（这正是被修掉的线上问题）', () => {
    expect(buildRobotsTxt('https://a.com')).not.toContain('localhost')
    expect(buildSitemapXml('https://a.com')).not.toContain('localhost')
    // 未配置时也不该有任何地址
    expect(buildRobotsTxt()).not.toContain('http')
  })

  it('配置域名时产出合法的 urlset 且只列首页', () => {
    const xml = buildSitemapXml('https://a.com')
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<loc>https://a.com/</loc>')
    expect(xml?.match(/<url>/g)).toHaveLength(1)
  })
})

describe('buildHeadTags', () => {
  it('注入 canonical 与 og:url/og:image，且都用配置的域名', () => {
    const tags = buildHeadTags('https://a.com')
    expect(tags).toContain('<link rel="canonical" href="https://a.com/" />')
    expect(tags).toContain('<meta property="og:url" content="https://a.com/" />')
    expect(tags).toContain('<meta property="og:image" content="https://a.com/icon.png" />')
  })
})
