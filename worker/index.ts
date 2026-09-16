import { Hono } from 'hono'
import { cors } from './middleware/cors'
import { rateLimit } from './middleware/rate-limit'
import { securityHeaders } from './middleware/security-headers'
import { postprocessRoute } from './routes/postprocess'
import { youtubeRoute } from './routes/youtube'

interface Env {
  RATE_LIMIT_KV?: KVNamespace
  GROQ_API_KEY: string
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors)
app.use('/api/*', rateLimit)
app.use('/api/*', securityHeaders)

app.route('/api/postprocess', postprocessRoute)
app.route('/api/youtube', youtubeRoute)

/**
 * 健康检查。
 *
 * 以前恒返回 `{status:'ok'}`，于是**部署漏配密钥时也报健康**，而 postprocess 实际
 * 每次都 500 —— 监控看不出任何异常。现在把配置就绪度暴露出来：
 * 缺 GROQ_API_KEY 时 `status` 变成 `degraded`，探针应据此告警。
 * （仍返回 200：SPA 与 BYOK 直连不受影响，只是服务器额度那条链路不可用。）
 */
app.get('/api/health', (c) => {
  const groqKey = Boolean(c.env.GROQ_API_KEY)
  const rateLimitBound = Boolean(c.env.RATE_LIMIT_KV)
  return c.json({
    status: groqKey ? 'ok' : 'degraded',
    config: { groqKey, rateLimit: rateLimitBound },
  })
})

app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>
