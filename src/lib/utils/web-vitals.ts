/** * Web Vitals 性能监控模块 * * 提供core Web Vitals 指标收集和报告： * - LCP (Largest Contentful Paint): 最大内容绘制 * - FID (First Input Delay): 首次输入delay * - CLS (Cumulative Layout Shift): 累计布局偏移 * - FCP (First Contentful Paint): 首次内容绘制 * - TTFB (Time to First Byte): 首字节时间 * - INP (Interaction to Next Paint): 交互To下一次绘制*/

import { getMonitoringService } from './monitoring-service'

// Web Vitals 指标class型
export interface WebVitalsMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  navigationType?: string
}

// Web Vitals 阈值
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
}

// Get指标评级
function getRating(
  name: keyof typeof THRESHOLDS,
  value: number,
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name]
  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

// 生成唯一 ID
function generateId(): string {
  return `v${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

// 报告指标To监控服务
function reportMetric(metric: WebVitalsMetric): void {
  const monitoring = getMonitoringService()
  monitoring.logCustomEvent('web-vitals', metric.name, {
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  })

  // 开发环境下打印To控制台
  if (process.env.NODE_ENV === 'development') {
    const color =
      metric.rating === 'good'
        ? '\x1b[32m' // 绿色
        : metric.rating === 'needs-improvement'
          ? '\x1b[33m' // 黄色
          : '\x1b[31m' // 红色
    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      `color: ${color === '\x1b[32m' ? 'green' : color === '\x1b[33m' ? 'orange' : 'red'}`,
    )
  }
}

// 观察 LCP (Largest Contentful Paint)
function observeLCP(): void {
  if (typeof PerformanceObserver === 'undefined') return

  try {
    let lcpValue = 0
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
        startTime: number
      }
      if (lastEntry) {
        lcpValue = lastEntry.startTime
      }
    })

    observer.observe({ type: 'largest-contentful-paint', buffered: true })

    // 页面隐藏时报告最终值
    addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden' && lcpValue > 0) {
          reportMetric({
            name: 'LCP',
            value: lcpValue,
            rating: getRating('LCP', lcpValue),
            delta: lcpValue,
            id: generateId(),
            navigationType: getNavigationType(),
          })
          observer.disconnect()
        }
      },
      { once: true },
    )
  } catch {
    // PerformanceObserver 不支持此指标
  }
}

// 观察 FID (First Input Delay)
function observeFID(): void {
  if (typeof PerformanceObserver === 'undefined') return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fidEntry = entry as PerformanceEventTiming
        const value = fidEntry.processingStart - fidEntry.startTime
        reportMetric({
          name: 'FID',
          value,
          rating: getRating('FID', value),
          delta: value,
          id: generateId(),
          navigationType: getNavigationType(),
        })
        observer.disconnect()
        break
      }
    })

    observer.observe({ type: 'first-input', buffered: true })
  } catch {
    // PerformanceObserver 不支持此指标
  }
}

// 观察 CLS (Cumulative Layout Shift)
function observeCLS(): void {
  if (typeof PerformanceObserver === 'undefined') return

  try {
    let clsValue = 0
    let sessionValue = 0
    let sessionEntries: PerformanceEntry[] = []

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShiftEntry = entry as PerformanceEntry & {
          hadRecentInput: boolean
          value: number
        }

        // 只计算没有用户输入布局偏移
        if (!layoutShiftEntry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0] as
            | (PerformanceEntry & { startTime: number })
            | undefined
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1] as
            | (PerformanceEntry & { startTime: number })
            | undefined

          // If间隔超过 1 seconds或总时间超过 5 seconds，开始新会话
          if (
            sessionValue &&
            (entry.startTime - (lastSessionEntry?.startTime || 0) > 1000 ||
              entry.startTime - (firstSessionEntry?.startTime || 0) > 5000)
          ) {
            clsValue = Math.max(clsValue, sessionValue)
            sessionValue = layoutShiftEntry.value
            sessionEntries = [entry]
          } else {
            sessionValue += layoutShiftEntry.value
            sessionEntries.push(entry)
          }
        }
      }
    })

    observer.observe({ type: 'layout-shift', buffered: true })

    // 页面隐藏时报告最终值
    addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          clsValue = Math.max(clsValue, sessionValue)
          if (clsValue > 0) {
            reportMetric({
              name: 'CLS',
              value: clsValue,
              rating: getRating('CLS', clsValue),
              delta: clsValue,
              id: generateId(),
              navigationType: getNavigationType(),
            })
          }
          observer.disconnect()
        }
      },
      { once: true },
    )
  } catch {
    // PerformanceObserver 不支持此指标
  }
}

// 观察 FCP (First Contentful Paint)
function observeFCP(): void {
  if (typeof PerformanceObserver === 'undefined') return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          const value = entry.startTime
          reportMetric({
            name: 'FCP',
            value,
            rating: getRating('FCP', value),
            delta: value,
            id: generateId(),
            navigationType: getNavigationType(),
          })
          observer.disconnect()
          break
        }
      }
    })

    observer.observe({ type: 'paint', buffered: true })
  } catch {
    // PerformanceObserver 不支持此指标
  }
}

// 观察 TTFB (Time to First Byte)
function observeTTFB(): void {
  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

    if (navigation) {
      const value = navigation.responseStart - navigation.requestStart
      if (value >= 0) {
        reportMetric({
          name: 'TTFB',
          value,
          rating: getRating('TTFB', value),
          delta: value,
          id: generateId(),
          navigationType: getNavigationType(),
        })
      }
    }
  } catch {
    // 不支持
  }
}

// 观察 INP (Interaction to Next Paint)
function observeINP(): void {
  if (typeof PerformanceObserver === 'undefined') return

  try {
    let maxINP = 0
    const interactions: number[] = []

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const eventEntry = entry as PerformanceEventTiming
        const duration = eventEntry.duration

        // 只record有意义交互
        if (duration > 0) {
          interactions.push(duration)
          maxINP = Math.max(maxINP, duration)
        }
      }
    })

    observer.observe({ type: 'event', buffered: true })

    // 页面隐藏时报告 P98 值
    addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden' && interactions.length > 0) {
          // 计算 P98
          interactions.sort((a, b) => a - b)
          const p98Index = Math.ceil(interactions.length * 0.98) - 1
          const inpValue = interactions[p98Index] || maxINP

          reportMetric({
            name: 'INP',
            value: inpValue,
            rating: getRating('INP', inpValue),
            delta: inpValue,
            id: generateId(),
            navigationType: getNavigationType(),
          })
          observer.disconnect()
        }
      },
      { once: true },
    )
  } catch {
    // PerformanceObserver 不支持此指标
  }
}

// Get导航class型
function getNavigationType(): string {
  if (typeof performance === 'undefined') return 'unknown'

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

  if (navigation) {
    return navigation.type
  }

  return 'unknown'
}

/** * 初始化 Web Vitals 监控 * 应在页面加载后调用*/
export function initWebVitals(): void {
  if (typeof window === 'undefined') return

  // 使用 requestIdleCallback 在空闲时初始化
  const init = () => {
    observeLCP()
    observeFID()
    observeCLS()
    observeFCP()
    observeTTFB()
    observeINP()
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(init)
  } else {
    setTimeout(init, 0)
  }
}

/** * 手动报告自定义性能指标*/
export function reportCustomMetric(
  name: string,
  value: number,
  metadata?: Record<string, unknown>,
): void {
  const monitoring = getMonitoringService()
  monitoring.logCustomEvent('custom-metric', name, {
    value,
    timestamp: Date.now(),
    ...metadata,
  })
}

/** * 测量函数执行时间*/
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    reportCustomMetric(name, duration, { status: 'success', ...metadata })
    return result
  } catch (error) {
    const duration = performance.now() - start
    reportCustomMetric(name, duration, {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      ...metadata,
    })
    throw error
  }
}

/** * 测量同步函数执行时间*/
export function measureSync<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
  const start = performance.now()
  try {
    const result = fn()
    const duration = performance.now() - start
    reportCustomMetric(name, duration, { status: 'success', ...metadata })
    return result
  } catch (error) {
    const duration = performance.now() - start
    reportCustomMetric(name, duration, {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      ...metadata,
    })
    throw error
  }
}
