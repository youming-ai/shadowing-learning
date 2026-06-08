import { AlertCircle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface PlayerErrorStateProps {
  message: string
  onRetry: () => void
  onBack: () => void
}

interface PlayerMissingFileStateProps {
  onBack: () => void
}

export function PlayerLoadingState() {
  return (
    <div className="player-card flex min-h-[40vh] flex-col items-center justify-center gap-4 text-sm text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
      <Loader2 className="h-10 w-10 animate-spin text-[var(--player-accent-color)]" />
      <p>加载播放器中...</p>
    </div>
  )
}

export function PlayerErrorState({ message, onRetry, onBack }: PlayerErrorStateProps) {
  return (
    <div className="player-card flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-3 text-[var(--state-error-text)]">
        <AlertCircle className="h-5 w-5" />
        <h2 className="text-lg font-semibold">加载失败</h2>
      </div>
      <p className="text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <PlayerStateButton onClick={onRetry} variant="outline" fullWidth>
          重试
        </PlayerStateButton>
        <PlayerStateButton onClick={onBack} variant="primary" fullWidth>
          返回
        </PlayerStateButton>
      </div>
    </div>
  )
}

export function PlayerMissingFileState({ onBack }: PlayerMissingFileStateProps) {
  return (
    <div className="player-card flex flex-col gap-4 text-sm text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
      <div className="flex items-center gap-3 text-[var(--text-color)]">
        <AlertCircle className="h-5 w-5" />
        <h2 className="text-lg font-semibold">文件不存在</h2>
      </div>
      <p>找不到指定的音频文件</p>
      <PlayerStateButton onClick={onBack} variant="primary" fullWidth>
        返回主页
      </PlayerStateButton>
    </div>
  )
}

interface PlayerStateButtonProps {
  children: ReactNode
  onClick: () => void
  variant: 'primary' | 'outline'
  fullWidth?: boolean
}

function PlayerStateButton({
  children,
  onClick,
  variant,
  fullWidth = false,
}: PlayerStateButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--player-accent-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-color)]'

  const widthClass = fullWidth ? ' flex-1' : ''

  const variantClasses =
    variant === 'primary'
      ? 'bg-[var(--player-accent-color)] text-[var(--player-tooltip-text)] shadow hover:brightness-110'
      : 'border border-[var(--border-muted)] text-[var(--text-color)]/80 hover:bg-[var(--state-info-surface)]'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses}${widthClass} ${variantClasses}`}
    >
      {children}
    </button>
  )
}
