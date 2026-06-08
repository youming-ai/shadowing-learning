import { createFileRoute } from '@tanstack/react-router'
import { apiSuccess } from '~/lib/utils/api-response'
import { performanceLogger } from '~/lib/utils/logger'

const performanceStore = new Map<string, StoredPerformanceData[]>()
const MAX_DAYS_TO_KEEP = 7

function cleanupOldData(): void {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS_TO_KEEP)
  const cutoffKey = cutoffDate.toISOString().split('T')[0]

  for (const key of performanceStore.keys()) {
    if (key < cutoffKey) {
      performanceStore.delete(key)
    }
  }
}

type MetricValue = number | undefined

interface PerformanceMetrics {
  [metricName: string]: MetricValue
  fcp?: number
  lcp?: number
  fid?: number
  cls?: number
  transcriptionTime?: number
  uploadTime?: number
  apiResponseTime?: number
  memoryUsage?: number
  errorCount?: number
  crashCount?: number
}

interface PerformanceData {
  metrics: PerformanceMetrics
  url: string
  timestamp: number
  userAgent: string
  sessionId?: string
}

interface StoredPerformanceData extends PerformanceData {
  receivedAt: number
}

interface PercentileStats {
  p50: number
  p75: number
  p90: number
  p95: number
  avg: number
  min: number
  max: number
}

interface PerformanceStats {
  coreWebVitals: {
    fcp: PercentileStats | null
    lcp: PercentileStats | null
    fid: PercentileStats | null
    cls: PercentileStats | null
  }
  customMetrics: {
    transcriptionTime: PercentileStats | null
    uploadTime: PercentileStats | null
    apiResponseTime: PercentileStats | null
  }
  errors: {
    totalErrors: number
    totalCrashes: number
  }
  sessions: {
    uniqueSessions: number
    averageSessionLength: number
  }
}

function generateSessionId(userAgent: string): string {
  const timestamp = Date.now().toString()
  const hash = simpleHash(userAgent + timestamp)
  return `session_${hash}`
}

function isValidSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && /^session_[a-z0-9]{1,64}$/i.test(sessionId)
}

function isPerformanceAdminAuthorized(request: Request): boolean {
  const isLocalDev = process.env.NODE_ENV === 'development'
  if (isLocalDev) {
    return true
  }

  const adminToken = process.env.PERFORMANCE_ADMIN_TOKEN
  const authHeader = request.headers.get('authorization')
  return Boolean(adminToken && authHeader === `Bearer ${adminToken}`)
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

function detectPerformanceIssues(metrics: PerformanceMetrics): string[] {
  const issues: string[] = []

  if (isValidMetricValue(metrics.fcp) && metrics.fcp > 2500) {
    issues.push(`FCP 过慢: ${Math.round(metrics.fcp)}ms`)
  }

  if (isValidMetricValue(metrics.lcp) && metrics.lcp > 4000) {
    issues.push(`LCP 过慢: ${Math.round(metrics.lcp)}ms`)
  }

  if (isValidMetricValue(metrics.fid) && metrics.fid > 300) {
    issues.push(`FID 过慢: ${Math.round(metrics.fid)}ms`)
  }

  if (isValidMetricValue(metrics.cls) && metrics.cls > 0.25) {
    issues.push(`CLS 过高: ${metrics.cls.toFixed(3)}`)
  }

  if (isValidMetricValue(metrics.transcriptionTime) && metrics.transcriptionTime > 60000) {
    issues.push(`转录时间过长: ${Math.round(metrics.transcriptionTime / 1000)}秒`)
  }

  if (isValidMetricValue(metrics.uploadTime) && metrics.uploadTime > 30000) {
    issues.push(`上传时间过长: ${Math.round(metrics.uploadTime / 1000)}秒`)
  }

  if (isValidMetricValue(metrics.apiResponseTime) && metrics.apiResponseTime > 5000) {
    issues.push(`API响应时间过长: ${Math.round(metrics.apiResponseTime)}ms`)
  }

  if (isValidMetricValue(metrics.memoryUsage) && metrics.memoryUsage > 100 * 1024 * 1024) {
    issues.push(`内存使用过高: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`)
  }

  if (isValidMetricValue(metrics.errorCount) && metrics.errorCount > 5) {
    issues.push(`错误次数过多: ${metrics.errorCount}次`)
  }

  return issues
}

function calculatePerformanceStats(data: StoredPerformanceData[]): PerformanceStats | null {
  if (data.length === 0) {
    return null
  }

  const fcpValues = collectMetricValues(data, (metrics) => metrics.fcp)
  const lcpValues = collectMetricValues(data, (metrics) => metrics.lcp)
  const fidValues = collectMetricValues(data, (metrics) => metrics.fid)
  const clsValues = collectMetricValues(data, (metrics) => metrics.cls)

  const transcriptionTimes = collectMetricValues(data, (metrics) => metrics.transcriptionTime)
  const uploadTimes = collectMetricValues(data, (metrics) => metrics.uploadTime)
  const apiResponseTimes = collectMetricValues(data, (metrics) => metrics.apiResponseTime)

  const totalErrors = data.reduce((sum, entry) => sum + (entry.metrics.errorCount ?? 0), 0)
  const totalCrashes = data.reduce((sum, entry) => sum + (entry.metrics.crashCount ?? 0), 0)
  const uniqueSessions = new Set(
    data
      .map((entry) => entry.sessionId)
      .filter(
        (sessionId): sessionId is string => typeof sessionId === 'string' && sessionId.length > 0,
      ),
  ).size

  return {
    coreWebVitals: {
      fcp: calculatePercentiles(fcpValues),
      lcp: calculatePercentiles(lcpValues),
      fid: calculatePercentiles(fidValues),
      cls: calculatePercentiles(clsValues),
    },
    customMetrics: {
      transcriptionTime: calculatePercentiles(transcriptionTimes),
      uploadTime: calculatePercentiles(uploadTimes),
      apiResponseTime: calculatePercentiles(apiResponseTimes),
    },
    errors: {
      totalErrors,
      totalCrashes,
    },
    sessions: {
      uniqueSessions,
      averageSessionLength: calculateAverageSessionLength(data),
    },
  }
}

function calculatePercentiles(values: number[]): PercentileStats | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const len = sorted.length

  return {
    p50: sorted[Math.min(Math.floor(len * 0.5), len - 1)],
    p75: sorted[Math.min(Math.floor(len * 0.75), len - 1)],
    p90: sorted[Math.min(Math.floor(len * 0.9), len - 1)],
    p95: sorted[Math.min(Math.floor(len * 0.95), len - 1)],
    avg: sorted.reduce((sum, val) => sum + val, 0) / len,
    min: sorted[0],
    max: sorted[len - 1],
  }
}

function calculateAverageSessionLength(data: StoredPerformanceData[]): number {
  const sessionLengths = new Map<string, number[]>()

  data.forEach((item) => {
    const sessionId = item.sessionId
    if (!sessionId) {
      return
    }

    if (!sessionLengths.has(sessionId)) {
      sessionLengths.set(sessionId, [])
    }
    sessionLengths.get(sessionId)?.push(item.timestamp)
  })

  let totalLength = 0
  let sessionCount = 0

  for (const timestamps of sessionLengths.values()) {
    if (timestamps.length > 1) {
      const sessionLength = Math.max(...timestamps) - Math.min(...timestamps)
      totalLength += sessionLength
      sessionCount++
    }
  }

  return sessionCount > 0 ? totalLength / sessionCount : 0
}

function collectMetricValues(
  entries: StoredPerformanceData[],
  selector: (metrics: PerformanceMetrics) => number | undefined,
): number[] {
  return entries
    .map((entry) => selector(entry.metrics))
    .filter((value): value is number => isValidMetricValue(value))
}

function isValidMetricValue(value: MetricValue): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

async function processPerformanceData(data: PerformanceData, issues: string[]): Promise<void> {
  if (issues.length > 0) {
    performanceLogger.warn('Performance issues detected:', {
      url: data.url,
      sessionId: data.sessionId,
      issues,
    })
  }
}

export const Route = createFileRoute('/api/performance')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data: PerformanceData = await request.json()

          if (!data.metrics || !data.timestamp) {
            return Response.json(
              {
                success: false,
                error: 'Invalid performance data format',
              },
              { status: 400 },
            )
          }

          const sessionId = isValidSessionId(data.sessionId)
            ? data.sessionId
            : generateSessionId(data.userAgent)
          data.sessionId = sessionId

          const dateKey = new Date().toISOString().split('T')[0]
          if (!performanceStore.has(dateKey)) {
            performanceStore.set(dateKey, [])
            cleanupOldData()
          }

          const dailyData = performanceStore.get(dateKey)
          if (dailyData) {
            dailyData.push({
              ...data,
              receivedAt: Date.now(),
            })

            if (dailyData.length > 1000) {
              dailyData.splice(0, dailyData.length - 1000)
            }
          }

          const issues = detectPerformanceIssues(data.metrics)

          processPerformanceData(data, issues).catch((error) => {
            performanceLogger.error('Failed to process performance data:', error)
          })

          return apiSuccess({
            received: true,
            sessionId,
            issues: issues.length > 0 ? issues : undefined,
          })
        } catch (error) {
          performanceLogger.error('Performance API error:', error)
          return Response.json(
            {
              success: false,
              error: 'Failed to process performance data',
            },
            { status: 500 },
          )
        }
      },
      GET: async ({ request }) => {
        try {
          if (!isPerformanceAdminAuthorized(request)) {
            return Response.json(
              {
                success: false,
                error: 'Not found',
              },
              { status: 404 },
            )
          }

          const { searchParams } = new URL(request.url)
          const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
          const sessionId = searchParams.get('session')

          let data: StoredPerformanceData[] = []

          if (sessionId) {
            for (const [, dailyData] of performanceStore.entries()) {
              const sessionData = dailyData.filter((item) => item.sessionId === sessionId)
              data.push(...sessionData)
            }
          } else {
            data = performanceStore.get(date) ?? []
          }

          const stats = calculatePerformanceStats(data)

          return apiSuccess({
            date,
            sessionId: sessionId || undefined,
            totalRecords: data.length,
            stats,
            recentData: data.slice(-10),
          })
        } catch (error) {
          performanceLogger.error('Performance GET error:', error)
          return Response.json(
            {
              success: false,
              error: 'Failed to retrieve performance data',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
