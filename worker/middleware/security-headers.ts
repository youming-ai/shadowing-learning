import type { MiddlewareHandler } from 'hono'

/**
 * `/api/*` 的响应头。
 *
 * 为什么必须写在这里而不是 `public/_headers`：官方文档明确说明 `_headers`
 * **只作用于静态资源响应**，对 Worker 代码生成的响应一律不生效。
 *
 * 与 `rate-limit.ts` 一样采用"先 next() 再补头"，这样不会覆盖下游已设置的头
 * （例如限流中间件写入的 `X-RateLimit-*`）。
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()

  // API 只返回 JSON，禁止浏览器按内容嗅探成别的东西
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  // API 响应里不含需要随请求携带的凭据，因此不需要把来源透给第三方
  c.res.headers.set('Referrer-Policy', 'no-referrer')
  // 后处理请求体里可能含用户自带的 key（BYOK 直连不经过我们，但服务器路径的请求也不该被缓存）
  c.res.headers.set('Cache-Control', 'no-store')
}
