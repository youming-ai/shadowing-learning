/** * API 性能监控 Hook * * 提供 API request性能监控functionality： * - request耗时统计 * - Error率追踪 * - 自动重试监控*/

import { useCallback, useRef } from 'react'
import { reportCustomMetric } from '~/lib/utils/web-vitals'

export interface ApiMetrics {
  /** API 端点*/
  endpoint: string
  /** requestmethod*/
  method: string
  /** responsestate码*/
  status: number
  /** request耗时（毫seconds）*/
  duration: number
  /** i否Success*/
  success: boolean
  /** i否a重试request*/
  isRetry: boolean
  /** 重试次数*/
  retryCount: number
  /** requestsize（字节）*/
  requestSize?: number
  /** responsesize（字节）*/
  responseSize?: number
  /** Error信息*/
  error?: string
}

/** * 报告 API 指标*/
export function reportApiMetrics(metrics: ApiMetrics): void {
  reportCustomMetric('api-request', metrics.duration, {
    endpoint: metrics.endpoint,
    method: metrics.method,
    status: metrics.status,
    success: metrics.success,
    isRetry: metrics.isRetry,
    retryCount: metrics.retryCount,
    requestSize: metrics.requestSize,
    responseSize: metrics.responseSize,
    error: metrics.error,
  })
}

/** * 包装 fetch request，自动收集性能指标*/
export async function monitoredFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method || 'GET'
  const startTime = performance.now()

  // 估算requestsize
  let requestSize = 0
  if (init?.body) {
    if (typeof init.body === 'string') {
      requestSize = new Blob([init.body]).size
    } else if (init.body instanceof Blob) {
      requestSize = init.body.size
    } else if (init.body instanceof FormData) {
      // FormData size估算比较复杂，这里SimplifiedProcess
      requestSize = 0
    }
  }

  try {
    const response = await fetch(input, init)
    const duration = performance.now() - startTime

    // Getresponsesize
    const contentLength = response.headers.get('content-length')
    const responseSize = contentLength ? parseInt(contentLength, 10) : undefined

    reportApiMetrics({
      endpoint: new URL(url, window.location.origin).pathname,
      method,
      status: response.status,
      duration,
      success: response.ok,
      isRetry: false,
      retryCount: 0,
      requestSize,
      responseSize,
    })

    return response
  } catch (error) {
    const duration = performance.now() - startTime

    reportApiMetrics({
      endpoint: new URL(url, window.location.origin).pathname,
      method,
      status: 0,
      duration,
      success: false,
      isRetry: false,
      retryCount: 0,
      requestSize,
      error: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

/** * API 性能监控 Hook * * 提供带有性能监控 fetch method*/
export function useApiMonitoring() {
  const retryCountRef = useRef<Map<string, number>>(new Map())

  /** * 带监控 fetch request*/
  const fetchWithMonitoring = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const cacheKey = `${init?.method || 'GET'}:${url}`

      const currentRetryCount = retryCountRef.current.get(cacheKey) || 0
      const startTime = performance.now()

      try {
        const response = await fetch(input, init)
        const duration = performance.now() - startTime

        // Success后重置重试计数
        retryCountRef.current.delete(cacheKey)

        reportApiMetrics({
          endpoint: new URL(url, window.location.origin).pathname,
          method: init?.method || 'GET',
          status: response.status,
          duration,
          success: response.ok,
          isRetry: currentRetryCount > 0,
          retryCount: currentRetryCount,
        })

        return response
      } catch (error) {
        const duration = performance.now() - startTime

        // 增加重试计数
        retryCountRef.current.set(cacheKey, currentRetryCount + 1)

        reportApiMetrics({
          endpoint: new URL(url, window.location.origin).pathname,
          method: init?.method || 'GET',
          status: 0,
          duration,
          success: false,
          isRetry: currentRetryCount > 0,
          retryCount: currentRetryCount,
          error: error instanceof Error ? error.message : String(error),
        })

        throw error
      }
    },
    [],
  )

  /** * 测量 API 调用性能*/
  const measureApiCall = useCallback(
    async <T>(
      name: string,
      apiCall: () => Promise<T>,
      metadata?: Record<string, unknown>,
    ): Promise<T> => {
      const startTime = performance.now()

      try {
        const result = await apiCall()
        const duration = performance.now() - startTime

        reportCustomMetric(`api:${name}`, duration, {
          status: 'success',
          ...metadata,
        })

        return result
      } catch (error) {
        const duration = performance.now() - startTime

        reportCustomMetric(`api:${name}`, duration, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          ...metadata,
        })

        throw error
      }
    },
    [],
  )

  return {
    fetchWithMonitoring,
    measureApiCall,
    monitoredFetch,
  }
}
