/** * 优化事件管理器 * 提供防抖、节流、batch事件发射等functionality*/

import { logger } from './logger'
import { debounce, throttle } from './performance-monitoring'

export interface EventListener<TData = unknown> {
  callback: (data: TData) => void
  priority?: number
  once?: boolean
  id: string
}

export interface EventEmitterOptions {
  maxListeners?: number
  debounceTime?: number
  throttleTime?: number
  batchEvents?: boolean
  batchSize?: number
  batchTimeout?: number
}

type EmitFunction<TEvents extends Record<string, unknown>> = <K extends keyof TEvents>(
  event: K,
  data: TEvents[K],
) => void

type CancelableEmitFunction<TEvents extends Record<string, unknown>> = EmitFunction<TEvents> & {
  cancel?: () => void
}

export class OptimizedEventEmitter<T extends Record<string, unknown> = Record<string, unknown>> {
  private listeners = new Map<keyof T, Map<string, EventListener<unknown>>>()
  private eventQueue: Array<{ type: keyof T; data: T[keyof T] }> = []
  private options: Required<EventEmitterOptions>
  private batchTimer?: NodeJS.Timeout
  private eventCounts = new Map<keyof T, number>()

  constructor(options: EventEmitterOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners || 100,
      debounceTime: options.debounceTime || 100,
      throttleTime: options.throttleTime || 16,
      batchEvents: options.batchEvents || false,
      batchSize: options.batchSize || 10,
      batchTimeout: options.batchTimeout || 50,
    }

    const emitImmediateFn: EmitFunction<T> = (event, data) => {
      this.emitImmediate(event, data)
    }

    // 创建防抖和节流事件发射函数
    this.debouncedEmit = debounce(
      emitImmediateFn,
      this.options.debounceTime,
    ) as CancelableEmitFunction<T>
    this.throttledEmit = throttle(
      emitImmediateFn,
      this.options.throttleTime,
    ) as CancelableEmitFunction<T>
  }

  private getListenerMap<K extends keyof T>(
    event: K,
  ): Map<string, EventListener<T[K]>> | undefined {
    return this.listeners.get(event) as Map<string, EventListener<T[K]>> | undefined
  }

  // Add事件监听器
  on<K extends keyof T>(
    event: K,
    callback: (data: T[K]) => void,
    options: { priority?: number; once?: boolean } = {},
  ): string {
    const id = `listener-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    let eventListeners = this.getListenerMap(event)
    if (!eventListeners) {
      eventListeners = new Map()
      this.listeners.set(event, eventListeners as Map<string, EventListener<unknown>>)
    }

    // Check监听器数量限制
    if (eventListeners.size >= this.options.maxListeners) {
      logger.warn(`事件 ${String(event)} 的监听器数量已达到最大限制 ${this.options.maxListeners}`)
    }

    eventListeners.set(id, {
      callback,
      priority: options.priority || 0,
      once: options.once || false,
      id,
    })

    // 返回监听器ID
    return id
  }

  // Add事件监听器并返回清理函数
  onWithCleanup<K extends keyof T>(
    event: K,
    callback: (data: T[K]) => void,
    options: { priority?: number; once?: boolean } = {},
  ): () => void {
    const id = this.on(event, callback, options)
    return () => this.off(event, id)
  }

  // Removed事件监听器
  off<K extends keyof T>(event: K, idOrCallback: string | ((data: T[K]) => void)): void {
    const eventListeners = this.getListenerMap(event)
    if (!eventListeners) return

    if (typeof idOrCallback === 'string') {
      eventListeners.delete(idOrCallback)
    } else {
      // Through回调函数查找并Delete
      for (const [id, listener] of eventListeners) {
        if (listener.callback === idOrCallback) {
          eventListeners.delete(id)
          break
        }
      }
    }

    // If没有监听器了，Delete事件
    if (eventListeners.size === 0) {
      this.listeners.delete(event)
    }
  }

  // Removed所有监听器
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  // 立即发射事件
  private emitImmediate<K extends keyof T>(event: K, data: T[K]): void {
    const eventListeners = this.getListenerMap(event)
    if (!eventListeners) return

    // 按优先级排序监听器
    const sortedListeners = Array.from(eventListeners.values()).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0),
    )

    const toRemove: string[] = []

    for (const listener of sortedListeners) {
      try {
        listener.callback(data)

        // Ifis一次性监听器，标记a需要Delete
        if (listener.once) {
          toRemove.push(listener.id)
        }
      } catch (error) {
        logger.error(`事件监听器执行错误 (${String(event)}):`, error)
      }
    }

    // Delete一次性监听器
    for (const id of toRemove) {
      eventListeners.delete(id)
    }

    // Update事件计数
    const count = this.eventCounts.get(event) || 0
    this.eventCounts.set(event, count + 1)
  }

  // 普通事件发射
  emit<K extends keyof T>(event: K, data: T[K]): void {
    // 根据事件class型选择发射策略
    if (this.shouldDebounce(event)) {
      this.debouncedEmit(event, data)
    } else if (this.shouldThrottle(event)) {
      this.throttledEmit(event, data)
    } else if (this.options.batchEvents) {
      this.addToBatch(event, data)
    } else {
      this.emitImmediate(event, data)
    }
  }

  // 防抖事件发射
  emitDebounced<K extends keyof T>(event: K, data: T[K]): void {
    this.debouncedEmit(event, data)
  }

  // 节流事件发射
  emitThrottled<K extends keyof T>(event: K, data: T[K]): void {
    this.throttledEmit(event, data)
  }

  // batch事件Process
  private addToBatch<K extends keyof T>(event: K, data: T[K]): void {
    this.eventQueue.push({ type: event, data })

    // If队列达Tobatchsize或Settimeout
    if (this.eventQueue.length >= this.options.batchSize) {
      this.flushBatch()
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch()
      }, this.options.batchTimeout)
    }
  }

  // 立即刷新batch队列
  flushBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }

    if (this.eventQueue.length === 0) return

    // 按事件class型分组
    const eventGroups = new Map<keyof T, T[keyof T][]>()

    for (const { type, data } of this.eventQueue) {
      if (!eventGroups.has(type)) {
        eventGroups.set(type, [])
      }
      eventGroups.get(type)?.push(data)
    }

    // batch发射事件
    for (const [event, dataList] of eventGroups) {
      // If数据列table只有一个元素，直接发射
      if (dataList.length === 1) {
        this.emitImmediate(event, dataList[0])
      } else {
        // 对于多个数据，可以选择合并或依次发射
        // 这里选择依次发射以保持事件粒度
        for (const data of dataList) {
          this.emitImmediate(event, data)
        }
      }
    }

    // 清空队列
    this.eventQueue.length = 0
  }

  // 判断i否应该使用防抖
  private shouldDebounce<K extends keyof T>(event: K): boolean {
    // 对于高频Update事件（如进度Update），使用防抖
    const highFrequencyEvents = ['progress', 'update', 'change'] as string[]
    return highFrequencyEvents.includes(String(event))
  }

  // 判断i否应该使用节流
  private shouldThrottle<K extends keyof T>(event: K): boolean {
    // 对于需要实时性但又要控制频率事件，使用节流
    const realTimeEvents = ['scroll', 'resize', 'mousemove'] as string[]
    return realTimeEvents.includes(String(event))
  }

  // Get事件统计
  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const [event, count] of this.eventCounts) {
      stats[String(event)] = count
    }
    return stats
  }

  // Get监听器统计
  getListenerStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const [event, listeners] of this.listeners) {
      stats[String(event)] = listeners.size
    }
    return stats
  }

  // 清理资源
  dispose(): void {
    this.flushBatch()
    this.removeAllListeners()
    this.eventCounts.clear()

    // 重置防抖和节流函数
    this.debouncedEmit.cancel?.()
    this.throttledEmit.cancel?.()
  }

  // 私有method声明
  private debouncedEmit: CancelableEmitFunction<T>
  private throttledEmit: CancelableEmitFunction<T>
}

// class型安全事件发射器工厂
export function createEventEmitter<T extends Record<string, unknown>>(
  options?: EventEmitterOptions,
): OptimizedEventEmitter<T> {
  return new OptimizedEventEmitter<T>(options)
}

// 针对Transcription系统专用事件管理器
type GenericPayload = Record<string, unknown>

export interface TranscriptionEvents extends Record<string, unknown> {
  'task:added': { taskId: string; task: GenericPayload }
  'task:started': { taskId: string }
  'task:progress': { taskId: string; progress: number; message?: string }
  'task:completed': { taskId: string; result: GenericPayload }
  'task:failed': { taskId: string; error: Error }
  'task:cancelled': { taskId: string }
  'queue:updated': { queueState: GenericPayload }
  'system:cleanup': { reason: string }
}

export class TranscriptionEventManager extends OptimizedEventEmitter<TranscriptionEvents> {
  constructor() {
    super({
      maxListeners: 50,
      debounceTime: 100,
      throttleTime: 16,
      batchEvents: true,
      batchSize: 5,
      batchTimeout: 50,
    })
  }

  // Transcription专用method
  emitTaskProgress(taskId: string, progress: number, message?: string): void {
    this.emit('task:progress', { taskId, progress, message })
  }

  emitTaskAdded(taskId: string, task: GenericPayload): void {
    this.emit('task:added', { taskId, task })
  }

  emitTaskCompleted(taskId: string, result: GenericPayload): void {
    this.emit('task:completed', { taskId, result })
  }

  emitTaskFailed(taskId: string, error: Error): void {
    this.emit('task:failed', { taskId, error })
  }

  // 高频事件防抖发射
  emitDebouncedProgress(taskId: string, progress: number, message?: string): void {
    this.emitDebounced('task:progress', { taskId, progress, message })
  }

  // GetTranscription事件统计
  getTranscriptionStats(): {
    events: Record<string, number>
    listeners: Record<string, number>
  } {
    return {
      events: this.getEventStats(),
      listeners: this.getListenerStats(),
    }
  }
}

// 导出单例实例
export const transcriptionEventManager = new TranscriptionEventManager()
