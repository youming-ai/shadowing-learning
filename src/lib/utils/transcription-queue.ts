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

/** * Transcription队列管理器 * 控制并发数量，支持取消operations*/
export class TranscriptionQueue {
  private queue: TranscriptionTask[] = []
  private processing: Map<number, TranscriptionTask> = new Map()
  private config: TranscriptionQueueConfig
  private taskCallback: TaskCallback | null = null
  private statusChangeCallback: StatusChangeCallback | null = null

  constructor(config: TranscriptionQueueConfig = { maxConcurrent: 1 }) {
    this.config = config
  }

  /** * Set任务执行回调*/
  setTaskCallback(callback: TaskCallback): void {
    this.taskCallback = callback
  }

  /** * Setstate变更回调*/
  setStatusChangeCallback(callback: StatusChangeCallback): void {
    this.statusChangeCallback = callback
  }

  /** * Add任务To队列*/
  add(fileId: number, language: TranscriptionLanguageCode): AbortController {
    // If已经在队列或Processin，返回现有 controller
    const existing = this.queue.find((t) => t.fileId === fileId) || this.processing.get(fileId)
    if (existing) {
      return existing.abortController
    }

    const abortController = new AbortController()
    const task: TranscriptionTask = {
      fileId,
      language,
      abortController,
      status: 'pending',
      createdAt: new Date(),
    }

    this.queue.push(task)
    this.notifyStatusChange(fileId, 'pending')

    // 尝试Process队列
    this.processNext()

    return abortController
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
      return true
    }

    // Checkis否正在Process
    const processingTask = this.processing.get(fileId)
    if (processingTask) {
      processingTask.abortController.abort()
      processingTask.status = 'cancelled'
      this.processing.delete(fileId)
      this.notifyStatusChange(fileId, 'cancelled')
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

    try {
      if (this.taskCallback) {
        await this.taskCallback(task)
      }

      // 只有在未被取消情况下才标记完成
      if (!task.abortController.signal.aborted) {
        task.status = 'completed'
        this.notifyStatusChange(task.fileId, 'completed')
      }
    } catch (error) {
      // Checkis否i取消Error
      if (error instanceof DOMException && error.name === 'AbortError') {
        task.status = 'cancelled'
        this.notifyStatusChange(task.fileId, 'cancelled')
      } else {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : '转录失败'
        this.notifyStatusChange(task.fileId, 'failed', task.error)
      }
    } finally {
      this.processing.delete(task.fileId)
      // 继续Process下一个任务
      this.processNext()
    }
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
