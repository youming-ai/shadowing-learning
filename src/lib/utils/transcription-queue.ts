/** * Transcription队列管理 * 提供并发控制和取消functionality*/

import type { TranscriptionLanguageCode } from '~/components/layout/contexts/TranscriptionLanguageContext'

export interface TranscriptionTask {
  fileId: number
  language: TranscriptionLanguageCode
  abortController: AbortController
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  error?: string
  createdAt: Date
}

interface TranscriptionQueueConfig {
  maxConcurrent: number
}

type TaskCallback = (task: TranscriptionTask) => Promise<void>
type StatusChangeCallback = (
  fileId: number,
  status: TranscriptionTask['status'],
  error?: string,
) => void

interface TaskResolvers {
  resolve: () => void
  reject: (error: unknown) => void
}

/** * Transcription队列管理器 * 控制并发数量，支持取消operations*/
export class TranscriptionQueue {
  private queue: TranscriptionTask[] = []
  private processing: Map<number, TranscriptionTask> = new Map()
  private config: TranscriptionQueueConfig
  private statusChangeCallback: StatusChangeCallback | null = null
  // 按 fileId 存回调/完成 promise ——之前用单一共享槽位（setTaskCallback）在两个文件同时排队时
  // 会被后注册的覆盖，先注册那个的 promise 永远不 settle。这里改成每个任务各自独立。
  private callbacks: Map<number, TaskCallback> = new Map()
  private promises: Map<number, Promise<void>> = new Map()
  private resolvers: Map<number, TaskResolvers> = new Map()

  constructor(config: TranscriptionQueueConfig = { maxConcurrent: 1 }) {
    this.config = config
  }

  /** * Setstate变更回调*/
  setStatusChangeCallback(callback: StatusChangeCallback): void {
    this.statusChangeCallback = callback
  }

  /**
   * Add任务To队列，绑定该任务专属的回调。
   * 若 fileId 已在队列/Processin中，返回已有任务的 controller + promise（调用方等同"加入已有任务"），
   * 不会用新 callback 覆盖已注册的那个。
   */
  add(
    fileId: number,
    language: TranscriptionLanguageCode,
    callback: TaskCallback,
  ): { abortController: AbortController; promise: Promise<void> } {
    // If已经在队列或Processin，返回现有 controller + promise
    const existing = this.queue.find((t) => t.fileId === fileId) || this.processing.get(fileId)
    if (existing) {
      return {
        abortController: existing.abortController,
        promise: this.promises.get(fileId) ?? Promise.resolve(),
      }
    }

    const abortController = new AbortController()
    const task: TranscriptionTask = {
      fileId,
      language,
      abortController,
      status: 'pending',
      createdAt: new Date(),
    }

    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    this.callbacks.set(fileId, callback)
    this.promises.set(fileId, promise)
    this.resolvers.set(fileId, { resolve, reject })

    this.queue.push(task)
    this.notifyStatusChange(fileId, 'pending')

    // 尝试Process队列
    this.processNext()

    return { abortController, promise }
  }

  /** * 取消特定任务*/
  cancel(fileId: number): boolean {
    // Checkis否在队列in
    const queueIndex = this.queue.findIndex((t) => t.fileId === fileId)
    if (queueIndex !== -1) {
      const task = this.queue[queueIndex]
      task.abortController.abort()
      task.status = 'cancelled'
      this.queue.splice(queueIndex, 1)
      this.notifyStatusChange(fileId, 'cancelled')
      // 任务还没跑到 processNext，回调不会被调用——这里手动 settle，否则 add() 返回的 promise 永远挂着
      this.resolvers.get(fileId)?.resolve()
      this.cleanupTask(fileId)
      return true
    }

    // Checkis否正在Process
    const processingTask = this.processing.get(fileId)
    if (processingTask) {
      processingTask.abortController.abort()
      processingTask.status = 'cancelled'
      this.processing.delete(fileId)
      this.notifyStatusChange(fileId, 'cancelled')
      // 正在跑的 processNext() 调用会在其 finally 里自行 settle + 清理，这里不重复处理
      // 继续Process下一个任务
      this.processNext()
      return true
    }

    return false
  }

  /** * 取消所有任务*/
  cancelAll(): void {
    // 取消队列in任务
    for (const task of this.queue) {
      task.abortController.abort()
      task.status = 'cancelled'
      this.notifyStatusChange(task.fileId, 'cancelled')
      this.resolvers.get(task.fileId)?.resolve()
      this.cleanupTask(task.fileId)
    }
    this.queue = []

    // 取消Processin任务
    for (const [fileId, task] of this.processing) {
      task.abortController.abort()
      task.status = 'cancelled'
      this.notifyStatusChange(fileId, 'cancelled')
    }
    this.processing.clear()
  }

  /** * Check任务i否在Processin*/
  isProcessing(fileId: number): boolean {
    return this.processing.has(fileId)
  }

  /** * Check任务i否在队列in（包括Processin）*/
  isInQueue(fileId: number): boolean {
    return this.queue.some((t) => t.fileId === fileId) || this.processing.has(fileId)
  }

  /** * Get队列长度*/
  get length(): number {
    return this.queue.length + this.processing.size
  }

  /** * Get等待in任务数*/
  get pendingCount(): number {
    return this.queue.length
  }

  /** * GetProcessin任务数*/
  get processingCount(): number {
    return this.processing.size
  }

  /** * Process下一个任务*/
  private async processNext(): Promise<void> {
    // Checkis否可以Process更多任务
    if (this.processing.size >= this.config.maxConcurrent) {
      return
    }

    // Get下一个待Process任务
    const task = this.queue.shift()
    if (!task) {
      return
    }

    // Checkis否已被取消
    if (task.abortController.signal.aborted) {
      this.processNext()
      return
    }

    // 标记asProcessin
    task.status = 'processing'
    this.processing.set(task.fileId, task)
    this.notifyStatusChange(task.fileId, 'processing')

    const callback = this.callbacks.get(task.fileId)
    const resolvers = this.resolvers.get(task.fileId)

    try {
      if (callback) {
        await callback(task)
      }

      // 只有在未被取消情况下才标记完成
      if (!task.abortController.signal.aborted) {
        task.status = 'completed'
        this.notifyStatusChange(task.fileId, 'completed')
      }
      resolvers?.resolve()
    } catch (error) {
      // Checkis否i取消Error
      if (error instanceof DOMException && error.name === 'AbortError') {
        task.status = 'cancelled'
        this.notifyStatusChange(task.fileId, 'cancelled')
        resolvers?.resolve()
      } else {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : '转录失败'
        this.notifyStatusChange(task.fileId, 'failed', task.error)
        resolvers?.reject(error)
      }
    } finally {
      this.processing.delete(task.fileId)
      this.cleanupTask(task.fileId)
      // 继续Process下一个任务
      this.processNext()
    }
  }

  private cleanupTask(fileId: number): void {
    this.callbacks.delete(fileId)
    this.promises.delete(fileId)
    this.resolvers.delete(fileId)
  }

  /** * 通知state变更*/
  private notifyStatusChange(
    fileId: number,
    status: TranscriptionTask['status'],
    error?: string,
  ): void {
    if (this.statusChangeCallback) {
      this.statusChangeCallback(fileId, status, error)
    }
  }
}

// 全局队列实例
let globalQueue: TranscriptionQueue | null = null

/** * Get全局Transcription队列*/
export function getTranscriptionQueue(): TranscriptionQueue {
  if (!globalQueue) {
    globalQueue = new TranscriptionQueue({ maxConcurrent: 1 })
  }
  return globalQueue
}
