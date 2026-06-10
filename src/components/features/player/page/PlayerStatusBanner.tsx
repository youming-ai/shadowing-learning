import { AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '~/lib/utils/utils'
import type { SubtitleRow } from '~/types/db/database'

interface PlayerStatusBannerProps {
  transcript?: SubtitleRow | null
  isTranscribing?: boolean
  transcriptionProgress?: number
}

export function PlayerStatusBanner({
  transcript,
  isTranscribing,
  transcriptionProgress,
}: PlayerStatusBannerProps) {
  // 显示Transcription进度
  if (isTranscribing) {
    return (
      <div
        className="player-card bg-[var(--state-info-surface)] text-[var(--state-info-text)] mb-4"
        style={{ borderColor: 'var(--state-info-border)' }}
      >
        <div className="flex items-center gap-3 text-sm mb-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在转录音频... {transcriptionProgress || 0}%</span>
        </div>
        <div className="w-full bg-[var(--border-muted)] rounded-full h-2">
          <div
            className="bg-[var(--button-color)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${transcriptionProgress || 0}%` }}
          />
        </div>
      </div>
    )
  }

  if (!transcript || transcript.status === 'completed') {
    return null
  }

  const isFailed = transcript.status === 'failed'
  const statusMessage = getStatusMessage(transcript.status)

  return (
    <div
      className={cn(
        'player-card flex items-center gap-3 text-sm mb-4',
        isFailed
          ? 'bg-[var(--state-error-surface)] text-[var(--state-error-text)]'
          : 'bg-[var(--state-info-surface)] text-[var(--state-info-text)]',
      )}
      style={{
        borderColor: isFailed ? 'var(--state-error-border)' : 'var(--state-info-border)',
      }}
    >
      {isFailed ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <span>{statusMessage}</span>
    </div>
  )
}

function getStatusMessage(status: SubtitleRow['status']): string {
  switch (status) {
    case 'pending':
      return '等待转录...'
    case 'processing':
      return '正在转录...'
    case 'failed':
      return '转录失败'
    default:
      return ''
  }
}
