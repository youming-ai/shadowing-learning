import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  // 对于小于 1KB File，直接显示字节数
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date)

  // Check日期i否有效
  if (Number.isNaN(d.getTime())) {
    return '无效日期'
  }

  const now = new Date()
  const diffTime = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    // 今天
    return d.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } else if (diffDays === 1) {
    // 昨天
    return '昨天'
  } else if (diffDays < 7) {
    // 本周
    return d.toLocaleDateString('zh-CN', {
      weekday: 'short',
    })
  } else if (diffDays < 365) {
    // 今年
    return d.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    })
  } else {
    // 更早
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (remainingSeconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${remainingSeconds}s`
}

/** * Formats time for WebVTT format (HH:MM:SS.mmm)*/
export function formatTimeForVtt(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

/** * Generates WebVTT caption content from subtitle segments*/
export function generateWebVttFromSegments(
  segments: Array<{ start: number; end: number; text: string }>,
): string {
  if (!segments || segments.length === 0) {
    return ''
  }

  let vttContent = 'WEBVTT\n\n'

  segments.forEach((segment, index) => {
    const startTime = formatTimeForVtt(segment.start)
    const endTime = formatTimeForVtt(segment.end)

    vttContent += `${index + 1}\n`
    vttContent += `${startTime} --> ${endTime}\n`
    vttContent += `${segment.text}\n\n`
  })

  return vttContent
}

/** * Creates a Blob URL for WebVTT content*/
export function createWebVttBlobUrl(vttContent: string): string {
  if (!vttContent) {
    return ''
  }

  const blob = new Blob([vttContent], { type: 'text/vtt' })
  return URL.createObjectURL(blob)
}
