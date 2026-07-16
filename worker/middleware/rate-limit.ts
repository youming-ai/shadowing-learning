import type { Context, Next } from "hono"
import type { Env } from "../lib/types"

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX = 60

const ROUTE_CONFIGS: Record<string, { windowMs: number; maxRequests: number }> = {
  "/api/transcribe": { windowMs: 60_000, maxRequests: 10 },
  "/api/postprocess": { windowMs: 60_000, maxRequests: 20 },
  "/api/youtube/resolve": { windowMs: 600_000, maxRequests: 20 },
  "/api/youtube/captions": { windowMs: 600_000, maxRequests: 20 },
  "/api/youtube/transcribe": { windowMs: 3_600_000, maxRequests: 4 },
}

function getConfig(pathname: string) {
  for (const [prefix, cfg] of Object.entries(ROUTE_CONFIGS)) {
    if (pathname.startsWith(prefix)) return cfg
  }
  return { windowMs: DEFAULT_WINDOW_MS, maxRequests: DEFAULT_MAX }
}

function getClientId(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (ip) return ip
  const cf = (request as Request & { cf?: { colo?: string } }).cf
  if (cf?.colo) return `cf:${cf.colo}`
  const ua = request.headers.get("user-agent") ?? ""
  const al = request.headers.get("accept-language") ?? ""
  let hash = 0
  const fp = `${ua}|${al}`
  for (let i = 0; i < fp.length; i++) {
    hash = (hash << 5) - hash + fp.charCodeAt(i)
    hash &= hash
  }
  return `anon:${Math.abs(hash).toString(36)}`
}

export async function rateLimit(c: Context<{ Bindings: Env }>, next: Next) {
  const url = new URL(c.req.url)
  const config = getConfig(url.pathname)
  const clientId = getClientId(c.req.raw)
  const key = `rl:${url.pathname}:${clientId}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  const raw = await c.env.RATE_LIMIT_KV.get(key)
  let timestamps: number[] = raw ? JSON.parse(raw) : []
  timestamps = timestamps.filter((ts: number) => ts > windowStart)

  const limited = timestamps.length >= config.maxRequests

  let remaining = 0
  let resetTime = 0

  if (!limited) {
    timestamps.push(now)
    remaining = Math.max(0, config.maxRequests - timestamps.length)
    resetTime = Math.ceil((timestamps[0] + config.windowMs) / 1000)
    c.executionCtx.waitUntil(
      c.env.RATE_LIMIT_KV.put(key, JSON.stringify(timestamps), {
        expirationTtl: Math.ceil(config.windowMs / 1000) + 1,
      }),
    )
  } else {
    remaining = 0
    resetTime = Math.ceil((timestamps[0] + config.windowMs) / 1000)
  }

  c.res.headers.set("X-RateLimit-Limit", String(config.maxRequests))
  c.res.headers.set("X-RateLimit-Remaining", String(remaining))
  c.res.headers.set("X-RateLimit-Reset", String(resetTime))

  if (limited) {
    const retryAfter = Math.ceil((timestamps[0] + config.windowMs - now) / 1000)
    c.res.headers.set("Retry-After", String(retryAfter))
    return c.json(
      { error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后再试", retryAfter } },
      429,
    )
  }

  await next()
}
