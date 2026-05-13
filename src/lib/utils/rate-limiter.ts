/** * 基于滑动窗口 API 限流器 * 使用Memory存储，适Used for单实例部署 * * 特点： * - 滑动窗口算法，更平滑限流 * - 支持按 IP 或自定义 key 限流 * - 自动清理过期数据 * - 提供限流state信息*/

export interface RateLimitConfig {
  /** 时间窗口size（毫seconds）*/
  windowMs: number
  /** 窗口内最大request数*/
  maxRequests: number
  /** 限流消息*/
  message?: string
}

export interface RateLimitResult {
  /** i否被限流*/
  limited: boolean
  /** 剩余request数*/
  remaining: number
  /** 限制总数*/
  limit: number
  /** 重置时间（Unix 时间戳，seconds）*/
  resetTime: number
  /** 重试等待时间（seconds）*/
  retryAfter?: number
}

interface RateLimitEntry {
  /** request时间戳数组*/
  timestamps: number[]
  /** 首次request时间*/
  firstRequest: number
}

// 默认配置
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minutes
  maxRequests: 60, // 每minutes 60 次
  message: '请求过于频繁，请稍后再试',
}

// API 路由专用配置（更严格）
export const API_RATE_LIMIT_CONFIG: Record<string, RateLimitConfig> = {
  // Transcription API - 计算密集型，限制较严
  '/api/transcribe': {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: '转录请求过于频繁，请稍后再试',
  },
  // 后Process API
  '/api/postprocess': {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: '文本处理请求过于频繁，请稍后再试',
  },
  // 默认 API 限制
  default: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: '请求过于频繁，请稍后再试',
  },
}

/** * Memory限流存储 * 使用 Map 存储每个 key requestrecord*/
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly CLEANUP_INTERVAL = 60 * 1000 // 1 minutes清理一次
  private readonly MAX_STORE_SIZE = 10000 // 最大存储条目数

  constructor() {
    this.startCleanup()
  }

  /** * Get或创建限流条目*/
  get(key: string): RateLimitEntry {
    const existing = this.store.get(key)
    if (existing) {
      return existing
    }

    const entry: RateLimitEntry = {
      timestamps: [],
      firstRequest: Date.now(),
    }
    this.store.set(key, entry)
    return entry
  }

  /** * Update限流条目*/
  set(key: string, entry: RateLimitEntry): void {
    // 防止存储过大
    if (this.store.size >= this.MAX_STORE_SIZE && !this.store.has(key)) {
      this.cleanup(Date.now())
    }
    this.store.set(key, entry)
  }

  /** * 清理过期条目*/
  cleanup(now: number, maxAge: number = 5 * 60 * 1000): void {
    const cutoff = now - maxAge
    for (const [key, entry] of this.store.entries()) {
      // Delete完全过期条目
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
        this.store.delete(key)
      }
    }
  }

  /** * 启动定期清理*/
  private startCleanup(): void {
    if (typeof window === 'undefined' && !this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup(Date.now())
      }, this.CLEANUP_INTERVAL)
    }
  }

  /** * 停止清理（Used for测试）*/
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /** * Get存储size（Used for监控）*/
  get size(): number {
    return this.store.size
  }
}

// 全局存储实例
const store = new RateLimitStore()

/** * 限流Check函数 * * @param key - 限流 key（通常i IP 地址或用户 ID） * @param config - 限流配置 * @returns 限流结果*/
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - config.windowMs

  // Get该 key requestrecord
  const entry = store.get(key)

  // 过滤掉窗口外request
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)

  // Checkis否超过限制
  const currentCount = entry.timestamps.length
  const limited = currentCount >= config.maxRequests

  // 计算重置时间
  const oldestTimestamp = entry.timestamps[0] || now
  const resetTime = Math.ceil((oldestTimestamp + config.windowMs) / 1000)

  // If没有被限流，record本次request
  if (!limited) {
    entry.timestamps.push(now)
    store.set(key, entry)
  }

  const result: RateLimitResult = {
    limited,
    remaining: Math.max(0, config.maxRequests - currentCount - (limited ? 0 : 1)),
    limit: config.maxRequests,
    resetTime,
  }

  // If被限流，计算重试等待时间
  if (limited && entry.timestamps.length > 0) {
    result.retryAfter = Math.ceil((entry.timestamps[0] + config.windowMs - now) / 1000)
  }

  return result
}

/** * 根据pathGet限流配置*/
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  // 精确匹配
  if (pathname in API_RATE_LIMIT_CONFIG) {
    return API_RATE_LIMIT_CONFIG[pathname]
  }

  // 前缀匹配
  for (const [path, config] of Object.entries(API_RATE_LIMIT_CONFIG)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      return config
    }
  }

  return API_RATE_LIMIT_CONFIG.default
}

/** * 从requestin提取client标识 * 优先使用 X-Forwarded-For，其次使用 X-Real-IP*/
export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // 取第一个 IP（最原始client IP）
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // 回退To一个默认标识
  return 'unknown'
}

/** * 生成限流response头*/
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  }

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString()
  }

  return headers
}

/** * Get限流存储统计（Used for监控）*/
export function getRateLimitStats(): { storeSize: number } {
  return {
    storeSize: store.size,
  }
}
