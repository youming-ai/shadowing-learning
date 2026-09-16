/**
 * 站点元数据（robots.txt / sitemap.xml）的生成逻辑。
 *
 * 抽成模块而不是写在 `vite.config.ts` 里，是为了**可测**：这些文件的错误
 * （比如把 localhost 当线上地址、Disallow 一个不存在的路由）在代码评审里很难被发现，
 * 只有构建产物可见。有测试守着就不会复发。
 *
 * 唯一事实来源：
 * - 私有路由清单与 `src/lib/config/routes.ts` 的实际路由保持一致
 * - 域名来自构建期环境变量 `SITE_URL`
 */

/**
 * 不应被搜索引擎索引的路径。
 *
 * - `/watch/`：每个视频是**用户本地的**库内容，对搜索引擎没有意义
 * - `/settings`、`/account`：私有页面
 *
 * 注意历史问题：这里曾写着 `/player/`，而项目从来没有这个路由。
 */
export const PRIVATE_PATHS = ['/watch/', '/settings', '/account'] as const

/** 去掉末尾斜杠，得到规范的站点根地址。 */
export function normalizeSiteUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : undefined
}

export function buildRobotsTxt(siteUrl?: string): string {
  const lines = [
    '# 由 src/lib/config/site-metadata.ts 生成，请勿直接编辑产物',
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
  ]
  // 未配置域名时刻意不写 Sitemap 行：相对路径不符合规范，而假域名只会误导爬虫
  if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`)
  return `${lines.join('\n')}\n`
}

/**
 * 本应用只有首页是可索引的静态页面 —— 其余路由都依赖浏览器本地数据。
 * 未配置域名时返回 `null`，调用方不应产出文件（宁可没有，也不要写假地址）。
 */
export function buildSitemapXml(siteUrl?: string): string | null {
  if (!siteUrl) return null
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${siteUrl}/</loc>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n')
}

/** 配置了域名时要注入 `<head>` 的标签（canonical 与社交卡片）。 */
export function buildHeadTags(siteUrl: string): string {
  return [
    `    <link rel="canonical" href="${siteUrl}/" />`,
    `    <meta property="og:url" content="${siteUrl}/" />`,
    `    <meta property="og:image" content="${siteUrl}/icon.png" />`,
  ].join('\n')
}
