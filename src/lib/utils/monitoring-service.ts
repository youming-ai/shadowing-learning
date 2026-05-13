/** * 监控服务模块 * 提供系统监控、性能跟踪和日志recordfunctionality*/

import type { AppError, ErrorContext, ExtendedErrorMonitor } from './error-handler'

// 性能指标API
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

// 用户行asAPI
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

// 自定义事件API
export interface CustomEvent {
  id: string
  timestamp: number
  name: string
  category: string
  value?: number
  metadata?: Record<string, unknown>
}

// 监控配置API
export interface MonitoringConfig {
  enabled: boolean
  sampleRate: number // 采样率 0-1
  maxBatchSize: number
  maxQueueSize: number
  flushInterval: number
  trackPerformance: boolean
  trackUserActions: boolean
  trackResources: boolean
  trackCustomEvents: boolean
  enableConsoleCapture: boolean
  apiEndpoint?: string | null
}

// 监控数据批ProcessAPI
export interface MonitoringBatch {
  timestamp: number
  sessionId: string
  userAgent: string
  url: string
  metrics: {
    performance?: PerformanceMetrics
    userActions: UserAction[]
    resources: ResourceMetrics[]
    customEvents: CustomEvent[]
    errors: Array<{
      error: Error
      context: ErrorContext
      timestamp: number
    }>
  }
}

// 默认监控配置
const DEFAULT_MONITORING_CONFIG: Required<MonitoringConfig> = {
  enabled: true,
  sampleRate: 1.0,
  maxBatchSize: 50,
  maxQueueSize: 1000,
  flushInterval: 30000, // 30seconds
  trackPerformance: true,
  trackUserActions: true,
  trackResources: true,
  trackCustomEvents: true,
  enableConsoleCapture: false,
  apiEndpoint: null as string | null,
}

// 监控服务class
export class MonitoringService implements ExtendedErrorMonitor {
  private config: Required<MonitoringConfig>
  private sessionId: string
  private queue: MonitoringBatch['metrics']
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

  // 初始化监控服务
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

  // 销毁监控服务
  destroy(): void {
    this.stopFlushTimer()
    this.flush()
    this.isInitialized = false
  }

  // recordError（实现ErrorMonitorAPI）
  logError(error: Error | AppError, context?: ErrorContext): void {
    if (!this.shouldSample()) return

    // 将AppError转换asError
    const errorObj = error instanceof Error ? error : new Error(error.message)

    this.queue.errors.push({
      error: errorObj,
      context: {
        timestamp: Date.now(),
        ...context,
      },
      timestamp: Date.now(),
    })

    this.checkQueueSize()
  }

  // record信息
  logInfo(message: string, context?: ErrorContext): void {
    this.logCustomEvent('system', 'info', { message, ...context })
  }

  // record警告
  logWarning(message: string, context?: ErrorContext): void {
    this.logCustomEvent('system', 'warning', { message, ...context })
  }

  // record用户operations
  logUserAction(action: Omit<UserAction, 'id' | 'timestamp' | 'url'>): void {
    if (!this.config.trackUserActions || !this.shouldSample()) return

    const userAction: UserAction = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      url: window.location.href,
      ...action,
    }

    this.queue.userActions.push(userAction)
    this.checkQueueSize()
  }

  // record自定义事件
  logCustomEvent(
    category: string,
    name: string,
    metadata?: Record<string, unknown>,
    value?: number,
  ): void {
    if (!this.config.trackCustomEvents || !this.shouldSample()) return

    const event: CustomEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      name,
      category,
      value,
      metadata,
    }

    this.queue.customEvents.push(event)
    this.checkQueueSize()
  }

  // record资源加载
  logResource(resource: Omit<ResourceMetrics, 'timestamp'>): void {
    if (!this.config.trackResources || !this.shouldSample()) return

    const resourceMetrics: ResourceMetrics = {
      timestamp: Date.now(),
      ...resource,
    }

    this.queue.resources.push(resourceMetrics)
    this.checkQueueSize()
  }

  // Get性能指标
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

  // 手动刷新数据
  async flush(): Promise<void> {
    if (!this.hasData()) return

    const batch = this.createBatch()
    await this.sendBatch(batch)
    this.clearQueue()
  }

  // Get会话ID
  getSessionId(): string {
    return this.sessionId
  }

  // Get队列size
  getQueueSize(): number {
    return (
      this.queue.userActions.length +
      this.queue.resources.length +
      this.queue.customEvents.length +
      this.queue.errors.length
    )
  }

  // 私有method

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

  private createBatch(): MonitoringBatch {
    return {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      metrics: {
        performance: this.getPerformanceMetrics() || undefined,
        userActions: [...this.queue.userActions],
        resources: [...this.queue.resources],
        customEvents: [...this.queue.customEvents],
        errors: [...this.queue.errors],
      },
    }
  }

  private async sendBatch(batch: MonitoringBatch): Promise<void> {
    if (!this.config.apiEndpoint) {
      return
    }

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
        keepalive: true, // 使用keepalive确保页面卸载时也能发送
      })

      if (!response.ok) {
      }
    } catch (_error) {}
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
      // 队列过满，清理旧数据
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
    if (!this.config.trackPerformance) return

    // 页面卸载时发送剩余数据
    window.addEventListener('beforeunload', () => {
      this.flush()
    })

    // 页面可见性变化时刷新
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.flush()
      }
    })
  }

  private setupUserActionTracking(): void {
    if (!this.config.trackUserActions) return

    // 点击事件
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      this.logUserAction({
        type: 'click',
        element: target.tagName.toLowerCase(),
        metadata: {
          targetId: target.id,
          targetClass: target.className,
          text: target.textContent?.substring(0, 100),
        },
      })
    })

    // 滚动事件（节流）
    let scrollTimer: NodeJS.Timeout
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        this.logUserAction({
          type: 'scroll',
          metadata: {
            scrollY: window.scrollY,
            scrollX: window.scrollX,
          },
        })
      }, 100)
    })

    // 输入事件
    document.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement
      this.logUserAction({
        type: 'input',
        element: target.tagName.toLowerCase(),
        value: target.type === 'password' ? '[hidden]' : target.value,
        metadata: {
          inputType: target.type,
          inputName: target.name,
        },
      })
    })

    // 页面导航
    window.addEventListener('popstate', () => {
      this.logUserAction({
        type: 'navigation',
        metadata: {
          method: 'popstate',
          url: window.location.href,
        },
      })
    })
  }

  private setupResourceTracking(): void {
    if (!this.config.trackResources) return

    // 监听资源加载
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming
          this.logResource({
            url: resource.name,
            duration: resource.duration,
            size: resource.transferSize || 0,
            type: this.getResourceType(resource.initiatorType),
            cached: resource.transferSize === 0,
            status: 200, // 无法从PerformanceResourceTimingGetstate码
          })
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['resource'] })
    } catch (_error) {}
  }

  private getResourceType(initiatorType: string): ResourceMetrics['type'] {
    switch (initiatorType) {
      case 'script':
        return 'script'
      case 'link':
        return 'style'
      case 'img':
        return 'image'
      case 'css':
      case 'other':
        return 'other'
      default:
        return 'other'
    }
  }

  private setupErrorHandling(): void {
    // 全局ErrorProcess
    window.addEventListener('error', (event) => {
      this.logError(event.error, {
        component: 'global',
        action: 'error',
        additional: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          message: event.message,
        },
      })
    })

    // 未ProcessPromise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(new Error(event.reason), {
        component: 'global',
        action: 'unhandledrejection',
        additional: {
          promise: event.promise,
        },
      })
    })
  }

  private setupConsoleCapture(): void {
    if (!this.config.enableConsoleCapture) return

    const consoleApi = globalThis.console
    const originalConsoleError = consoleApi.error.bind(consoleApi)
    const originalConsoleWarn = consoleApi.warn.bind(consoleApi)
    const originalConsoleInfo = consoleApi.info.bind(consoleApi)

    globalThis.console.error = (...args) => {
      originalConsoleError(...args)
      this.logCustomEvent('console', 'error', { args: args.map((arg) => String(arg)) })
    }

    globalThis.console.warn = (...args) => {
      originalConsoleWarn(...args)
      this.logCustomEvent('console', 'warn', { args: args.map((arg) => String(arg)) })
    }

    globalThis.console.info = (...args) => {
      originalConsoleInfo(...args)
      this.logCustomEvent('console', 'info', { args: args.map((arg) => String(arg)) })
    }
  }
}

// 全局监控服务实例
let globalMonitoringService: MonitoringService | null = null

// Get全局监控服务
export function getMonitoringService(): MonitoringService {
  if (!globalMonitoringService) {
    globalMonitoringService = new MonitoringService()
  }
  return globalMonitoringService
}

// 初始化全局监控服务
export function initializeMonitoring(_config?: Partial<MonitoringConfig>): void {
  const service = getMonitoringService()
  service.initialize()
}

// 便捷用户operationsrecord函数
export function trackUserAction(action: Omit<UserAction, 'id' | 'timestamp' | 'url'>): void {
  const service = getMonitoringService()
  service.logUserAction(action)
}

// 便捷自定义事件record函数
export function trackCustomEvent(
  category: string,
  name: string,
  metadata?: Record<string, unknown>,
  value?: number,
): void {
  const service = getMonitoringService()
  service.logCustomEvent(category, name, metadata, value)
}

// 便捷性能指标Get函数
export function getPerformanceMetrics(): PerformanceMetrics | null {
  const service = getMonitoringService()
  return service.getPerformanceMetrics()
}

// 监控Hook
export function useMonitoring() {
  return {
    trackUserAction,
    trackCustomEvent,
    getPerformanceMetrics,
    getSessionId: () => getMonitoringService().getSessionId(),
    flush: () => getMonitoringService().flush(),
  }
}
