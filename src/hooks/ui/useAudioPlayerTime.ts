import { useCallback } from 'react'

export function useAudioPlayerTime() {
  const formatTime = useCallback((seconds: number) => {
    // Process无效值
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00.00'
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }, [])

  const parseTimeInput = useCallback((input: string): number => {
    const parts = input.split(':').map(Number)
    // 过滤无效数字
    if (parts.some((p) => !Number.isFinite(p))) return 0
    if (parts.length === 1) return Math.max(0, parts[0])
    if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1])
    if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2])
    return 0
  }, [])

  return { formatTime, parseTimeInput }
}
