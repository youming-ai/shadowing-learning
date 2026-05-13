/** * 简洁Transcriptionloadingcomponent * Used for替代complexstate面板，专注于loadingstate*/

'use client'

import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react'
import { Progress } from '~/components/ui/progress'
import { cn } from '~/lib/utils/utils'
import type { TranscriptionTask } from '~/types/transcription'

interface TranscriptionLoadingProps {
  task: TranscriptionTask | null
  className?: string
  showMessage?: boolean
  compact?: boolean
}

export function TranscriptionLoading({
  task,
  className,
  showMessage = true,
  compact = false,
}: TranscriptionLoadingProps) {
  if (!task) {
    return (
      <div className={cn('flex items-center gap-2 text-gray-500', className)}>
        <Clock className="h-4 w-4" />
        {showMessage && <span className="text-sm">等待转录</span>}
      </div>
    )
  }

  const getStatusDisplay = () => {
    switch (task.status) {
      case 'queued':
        return {
          icon: Clock,
          color: 'text-blue-500',
          message: '排队中...',
          showProgress: false,
        }

      case 'processing':
        return {
          icon: Loader2,
          color: 'text-primary',
          message: task.progress.message || '转录中...',
          showProgress: true,
          progress: task.progress.progress,
        }

      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          message: '转录完成',
          showProgress: false,
        }

      case 'failed':
        return {
          icon: XCircle,
          color: 'text-red-500',
          message: task.progress.error || '转录失败',
          showProgress: false,
        }

      case 'cancelled':
        return {
          icon: Clock,
          color: 'text-gray-500',
          message: '已取消',
          showProgress: false,
        }

      case 'paused':
        return {
          icon: Clock,
          color: 'text-orange-500',
          message: '已暂停',
          showProgress: false,
        }

      default:
        return {
          icon: Clock,
          color: 'text-gray-500',
          message: '未知状态',
          showProgress: false,
        }
    }
  }

  const status = getStatusDisplay()
  const Icon = status.icon

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Icon
          className={cn('h-3 w-3', status.color, task.status === 'processing' && 'animate-spin')}
        />
        {showMessage && <span className="text-xs text-gray-600">{status.message}</span>}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/*state指示器*/}
      <div className="flex items-center gap-2">
        <Icon
          className={cn('h-4 w-4', status.color, task.status === 'processing' && 'animate-spin')}
        />
        {showMessage && <span className={cn('text-sm', status.color)}>{status.message}</span>}
      </div>

      {/*进度条 - 仅在Processin时显示*/}
      {status.showProgress && (
        <div className="space-y-1">
          <Progress value={status.progress} className="h-1 w-full" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{status.progress}%</span>
            <span>
              {task.progress.estimatedDuration &&
                `预计 ${Math.ceil(task.progress.estimatedDuration / 60)} 分钟`}
            </span>
          </div>
        </div>
      )}

      {/*SimplifiedFile信息*/}
      {!compact && (
        <div className="text-xs text-gray-500">
          <div>{task.fileName}</div>
          {task.fileSize && <div>{(task.fileSize / 1024 / 1024).toFixed(1)} MB</div>}
        </div>
      )}
    </div>
  )
}

// 更简洁版本，仅显示最基本state
export function TranscriptionStatusMinimal({
  task,
  className,
}: {
  task: TranscriptionTask | null
  className?: string
}) {
  if (!task) return null

  const isProcessing = task.status === 'processing'
  const isCompleted = task.status === 'completed'
  const hasError = task.status === 'failed' || task.status === 'cancelled'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
      {isCompleted && <CheckCircle className="h-3 w-3 text-green-500" />}
      {hasError && <XCircle className="h-3 w-3 text-red-500" />}
      {!isProcessing && !isCompleted && !hasError && <Clock className="h-3 w-3 text-gray-400" />}
    </div>
  )
}
