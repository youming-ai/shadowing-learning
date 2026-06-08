import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitConfig,
  getRateLimitHeaders,
  type RateLimitConfig,
} from '../rate-limiter'

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 5,
      }

      const result = checkRateLimit('test-key-1', config)

      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(4)
      expect(result.limit).toBe(5)
    })

    it('should block requests when limit exceeded', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 3,
      }

      // 发送 3 次request
      checkRateLimit('test-key-2', config)
      checkRateLimit('test-key-2', config)
      checkRateLimit('test-key-2', config)

      // 第 4 次应该被限流
      const result = checkRateLimit('test-key-2', config)

      expect(result.limited).toBe(true)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeDefined()
    })

    it('should reset after window expires', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 2,
      }

      // 用完配额
      checkRateLimit('test-key-3', config)
      checkRateLimit('test-key-3', config)
      const blockedResult = checkRateLimit('test-key-3', config)
      expect(blockedResult.limited).toBe(true)

      // 时间推进超过窗口期
      vi.advanceTimersByTime(61000)

      // 应该可以再次request
      const allowedResult = checkRateLimit('test-key-3', config)
      expect(allowedResult.limited).toBe(false)
      expect(allowedResult.remaining).toBe(1)
    })

    it('should track different keys independently', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
      }

      const result1 = checkRateLimit('key-a', config)
      const result2 = checkRateLimit('key-b', config)

      expect(result1.limited).toBe(false)
      expect(result2.limited).toBe(false)
    })

    it('should use default config when not provided', () => {
      const result = checkRateLimit('test-default')

      expect(result.limit).toBe(60) // 默认 60 次/minutes
      expect(result.limited).toBe(false)
    })
  })

  describe('getRateLimitConfig', () => {
    it('should return specific config for known paths', () => {
      const transcribeConfig = getRateLimitConfig('/api/transcribe')
      expect(transcribeConfig.maxRequests).toBe(10)

      const postprocessConfig = getRateLimitConfig('/api/postprocess')
      expect(postprocessConfig.maxRequests).toBe(20)
    })

    it('should return default config for unknown paths', () => {
      const config = getRateLimitConfig('/api/unknown')
      expect(config.maxRequests).toBe(100)
    })

    it('should match path prefix', () => {
      const config = getRateLimitConfig('/api/transcribe/some-id')
      expect(config.maxRequests).toBe(10)
    })
  })

  describe('getClientIdentifier', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      })

      const clientId = getClientIdentifier(request)
      expect(clientId).toBe('192.168.1.1')
    })

    it('should use X-Real-IP as fallback', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '192.168.1.100',
        },
      })

      const clientId = getClientIdentifier(request)
      expect(clientId).toBe('192.168.1.100')
    })

    it('should hash user-agent when no IP headers', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'user-agent': 'TestBrowser/1.0',
        },
      })

      const clientId = getClientIdentifier(request)
      expect(clientId).toMatch(/^anon:[a-z0-9]+$/)
    })

    it("should return 'unknown' when no identifying headers", () => {
      const request = new Request('http://localhost/api/test')

      const clientId = getClientIdentifier(request)
      expect(clientId).toBe('unknown')
    })
  })

  describe('getRateLimitHeaders', () => {
    it('should generate correct headers', () => {
      const result = {
        limited: false,
        remaining: 5,
        limit: 10,
        resetTime: 1234567890,
      }

      const headers = getRateLimitHeaders(result)

      expect(headers['X-RateLimit-Limit']).toBe('10')
      expect(headers['X-RateLimit-Remaining']).toBe('5')
      expect(headers['X-RateLimit-Reset']).toBe('1234567890')
      expect(headers['Retry-After']).toBeUndefined()
    })

    it('should include Retry-After when limited', () => {
      const result = {
        limited: true,
        remaining: 0,
        limit: 10,
        resetTime: 1234567890,
        retryAfter: 30,
      }

      const headers = getRateLimitHeaders(result)

      expect(headers['Retry-After']).toBe('30')
    })
  })
})
