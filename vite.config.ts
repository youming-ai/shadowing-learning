import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import {
  buildHeadTags,
  buildRobotsTxt,
  buildSitemapXml,
  normalizeSiteUrl,
} from './src/lib/config/site-metadata'

/**
 * 构建期生成 `robots.txt` / `sitemap.xml`，并按需注入 canonical / og:url / og:image。
 *
 * 生成逻辑放在 `src/lib/config/site-metadata.ts`（有单测）—— 这些文件的错误
 * （把 localhost 当线上地址、Disallow 一个不存在的路由）在评审里很难发现，
 * 只有构建产物可见，因此值得被测试守住。
 *
 * `SITE_URL` 未设置时**不产出 sitemap**，也不写任何地址 —— 宁可没有，也不写假域名。
 * 用法：`SITE_URL=https://example.com bun run build`
 */
function siteMetadata(): Plugin {
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL)

  return {
    name: 'site-metadata',

    transformIndexHtml(html) {
      if (!siteUrl || !html.includes('</head>')) return html
      return html.replace('</head>', `${buildHeadTags(siteUrl)}\n  </head>`)
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobotsTxt(siteUrl) })

      const sitemap = buildSitemapXml(siteUrl)
      if (sitemap) {
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      }
    },
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
      // 客户端与 Worker 共用的运行时中立代码（Worker 侧只能用相对路径，wrangler 不认别名）
      '~shared': resolve(__dirname, './shared'),
    },
  },
  plugins: [react(), tailwindcss(), siteMetadata()],
})
