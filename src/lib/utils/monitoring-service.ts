/**
 * 监控服务模块 — 提供系统监控、性能跟踪和日志记录。
 * 数据仅保留在内存,不上报远端。
 */

import type { AppError, ErrorContext, ExtendedErrorMonitor } from './error-handler'

// 性能指标 API
export interface PerformanceMetrics {
  timestamp: number
  pageLoad: number
  firstPaint: number
  firstContentfulPaint: number
  domInteractive: number
  firstInputDelay?: number
  cumulativeLayoutShift?: number
  largestContentfulPaint?: number
}

// 用户行为 API
export interface UserAction {
  id: string
  timestamp: number
  type: 'click' | 'scroll' | 'input' | 'navigation' | 'api_call' | 'custom'
  element?: string
  value?: string
  url: string
  metadata?: Record<string, unknown>
}

// 资源加载指标
export interface ResourceMetrics {
  timestamp: number
  url: string
  duration: number
  size: number
  type: 'script' | 'style' | 'image' | 'font' | 'other'
  cached: boolean
  status: number
}

// 自定义事件 API
export interface CustomEvent {
  id: string
  timestamp: number
  name: string
  category: string
  value?: number
  metadata?: Record<string, unknown>
}

// 监控配置
export interface MonitoringConfig {
  enabled: boolean
  sampleRate: number
  maxBatchSize: number
  maxQueueSize: number
  flushInterval: number
  trackPerformance: boolean
  trackUserActions: boolean
  trackResources: boolean
  trackCustomEvents: boolean
  enableConsoleCapture: boolean
}

// 内存队列条目
type MetricsQueue = {
  userActions: UserAction[]
  resources: ResourceMetrics[]
  customEvents: CustomEvent[]
  errors: Array<{ error: Error; context: ErrorContext; timestamp: number }>
}

const DEFAULT_MONITORING_CONFIG: Required<MonitoringConfig> = {
  enabled: true,
  sampleRate: 1.0,
  maxBatchSize: 50,
  maxQueueSize: 1000,
  flushInterval: 30000,
  trackPerformance: true,
  trackUserActions: true,
  trackResources: true,
  trackCustomEvents: true,
  enableConsoleCapture: false,
}

export class MonitoringService implements ExtendedErrorMonitor {
  private config: Required<MonitoringConfig>
  private sessionId: string
  private queue: MetricsQueue
  private flushTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config }
    this.sessionId = this.generateSessionId()
    this.queue = {
      userActions: [],
      resources: [],
      customEvents: [],
      errors: [],
    }
  }

  initialize(): void {
    if (this.isInitialized || !this.config.enabled) {
      return
    }

    this.sessionId = this.generateSessionId()
    this.setupPerformanceTracking()
    this.setupUserActionTracking()
    this.setupResourceTracking()
    this.setupErrorHandling()
    this.setupConsoleCapture()
    this.startFlushTimer()

    this.isInitialized = true
    this.logInfo('Monitoring service initialized', { sessionId: this.sessionId })
  }

  destroy(): void {
    this.stopFlushTimer()
    this.flush()
    this.isInitialized = false
  }

  logError(error: Error | AppError, context?: ErrorContext): void {
    if (!this.shouldSample()) return

    const errorObj = error instanceof Error ? error : new Error(error.message)

    this.queue.errors.push({
      error: errorObj,
      context: { timestamp: Date.now(), ...context },
      timestamp: Date.now(),
    })

    this.checkQueueSize()
  }

  logInfo(message: string, context?: ErrorContext): void {
    this.logCustomEvent('system', 'info', { message, ...context })
  }

  logWarning(message: string, context?: ErrorContext): void {
    this.logCustomEvent('system', 'warning', { message, ...context })
  }

  logUserAction(action: Omit<UserAction, 'id' | 'timestamp' | 'url'>): void {
    if (!this.config.trackUserActions || !this.shouldSample()) return

    this.queue.userActions.push({
      id: this.generateEventId(),
      timestamp: Date.now(),
      url: window.location.href,
      ...action,
    })
    this.checkQueueSize()
  }

  logCustomEvent(
    category: string,
    name: string,
    metadata?: Record<string, unknown>,
    value?: number,
  ): void {
    if (!this.config.trackCustomEvents || !this.shouldSample()) return

    this.queue.customEvents.push({
      id: this.generateEventId(),
      timestamp: Date.now(),
      name,
      category,
      value,
      metadata,
    })
    this.checkQueueSize()
  }

  logResource(resource: Omit<ResourceMetrics, 'timestamp'>): void {
    if (!this.config.trackResources || !this.shouldSample()) return

    this.queue.resources.push({ timestamp: Date.now(), ...resource })
    this.checkQueueSize()
  }

  getPerformanceMetrics(): PerformanceMetrics | null {
    if (!this.config.trackPerformance) return null

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (!navigation) return null

    const paint = performance.getEntriesByType('paint')
    const firstPaint = paint.find((entry) => entry.name === 'first-paint')?.startTime || 0
    const firstContentfulPaint =
      paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0

    return {
      timestamp: Date.now(),
      pageLoad: navigation.loadEventEnd - navigation.fetchStart,
      firstPaint,
      firstContentfulPaint,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
    }
  }

  // 数据不上报,flush 仅清空内存队列
  async flush(): Promise<void> {
    if (!this.hasData()) return
    this.clearQueue()
  }

  getSessionId(): string {
    return this.sessionId
  }

  getQueueSize(): number {
    return (
      this.queue.userActions.length +
      this.queue.resources.length +
      this.queue.customEvents.length +
      this.queue.errors.length
    )
  }

  // 私有方法

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private hasData(): boolean {
    return this.getQueueSize() > 0
  }

  private clearQueue(): void {
    this.queue = {
      userActions: [],
      resources: [],
      customEvents: [],
      errors: [],
    }
  }

  private checkQueueSize(): void {
    if (this.getQueueSize() >= this.config.maxBatchSize) {
      this.flush()
    } else if (this.getQueueSize() >= this.config.maxQueueSize) {
      this.trimQueue()
    }
  }

  private trimQueue(): void {
    const maxItemsPerType = Math.floor(this.config.maxQueueSize / 4)

    if (this.queue.userActions.length > maxItemsPerType) {
      this.queue.userActions = this.queue.userActions.slice(-maxItemsPerType)
    }
    if (this.queue.resources.length > maxItemsPerType) {
      this.queue.resources = this.queue.resources.slice(-maxItemsPerType)
    }
    if (this.queue.customEvents.length > maxItemsPerType) {
      this.queue.customEvents = this.queue.customEvents.slice(-maxItemsPerType)
    }
    if (this.queue.errors.length > maxItemsPerType) {
      this.queue.errors = this.queue.errors.slice(-maxItemsPerType)
    }
  }

  private startFlushTimer(): void {
    this.stopFlushTimer()
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.config.flushInterval)
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  private setupPerformanceTracking(): void {
    // 由 web-vitals 主导
  }

  private setupUserActionTracking(): void {
    if (typeof document === 'undefined') return
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      this.logUserAction({
        type: 'click',
        element: target?.tagName?.toLowerCase(),
      })
    })
  }

  private setupResourceTracking(): void {
    if (typeof PerformanceObserver === 'undefined') return
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resourceEntry = entry as PerformanceResourceTiming
          this.logResource({
            url: resourceEntry.name,
            duration: resourceEntry.duration,
            size: resourceEntry.transferSize || 0,
            type: (resourceEntry.initiatorType as ResourceMetrics['type']) || 'other',
            cached: resourceEntry.transferSize === 0 && resourceEntry.duration === 0,
            status: 200,
          })
        }
      })
      observer.observe({ entryTypes: ['resource'] })
    } catch {
      // 浏览器不支持时静默失败
    }
  }

  private setupErrorHandling(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('error', (event) => {
      this.logError(event.error ?? new Error(event.message), { component: 'window.error' })
    })
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { component: 'unhandledrejection' },
      )
    })
  }

  private setupConsoleCapture(): void {
    if (!this.config.enableConsoleCapture || typeof console === 'undefined') return
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      this.logError(new Error(args.map(String).join(' ')), { component: 'console.error' })
      originalError.apply(console, args)
    }
  }
}

let _instance: MonitoringService | null = null

export function getMonitoringService(): MonitoringService {
  if (!_instance) {
    _instance = new MonitoringService()
  }
  return _instance
}

export function initializeMonitoring(config?: Partial<MonitoringConfig>): void {
  if (config) {
    _instance = new MonitoringService(config)
  }
  getMonitoringService().initialize()
}

export function trackUserAction(action: Omit<UserAction, 'id' | 'timestamp' | 'url'>): void {
  getMonitoringService().logUserAction(action)
}

export function trackCustomEvent(
  category: string,
  name: string,
  metadata?: Record<string, unknown>,
  value?: number,
): void {
  getMonitoringService().logCustomEvent(category, name, metadata, value)
}

export function getPerformanceMetrics(): PerformanceMetrics | null {
  return getMonitoringService().getPerformanceMetrics()
}

export function useMonitoring() {
  return {
    service: getMonitoringService(),
    trackUserAction,
    trackCustomEvent,
  }
}
