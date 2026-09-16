'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '~/lib/utils/utils'

interface LoadingStateProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'spinner' | 'dots' | 'skeleton'
  text?: string
  loadingLabel?: string
  className?: string
}

export function LoadingState({
  size = 'md',
  variant = 'spinner',
  text,
  loadingLabel,
  className,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  const containerClasses = cn('flex flex-col items-center justify-center', className)

  if (variant === 'dots') {
    return (
      <output className={containerClasses} aria-label={loadingLabel ?? text}>
        <div className="flex space-x-1">
          <div
            className={cn(
              'animate-bounce rounded-full bg-[var(--button-fill)]',
              size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4',
            )}
            style={{ animationDelay: '0ms' }}
          />
          <div
            className={cn(
              'animate-bounce rounded-full bg-[var(--button-fill)]',
              size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4',
            )}
            style={{ animationDelay: '150ms' }}
          />
          <div
            className={cn(
              'animate-bounce rounded-full bg-primary',
              size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4',
            )}
            style={{ animationDelay: '300ms' }}
          />
        </div>
        {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
      </output>
    )
  }

  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
        {text && <p className="text-sm text-muted-foreground text-center">{text}</p>}
      </div>
    )
  }

  // Default spinner variant
  return (
    <output className={containerClasses} aria-label={loadingLabel ?? text}>
      <Loader2 className={cn('animate-spin text-[var(--color-primary)]', sizeClasses[size])} />
      {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
    </output>
  )
}

// 页面级加载state
export function PageLoadingState({ text, loadingLabel }: { text?: string; loadingLabel?: string }) {
  const resolvedText = text ?? loadingLabel
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingState size="lg" text={resolvedText} loadingLabel={loadingLabel} />
    </div>
  )
}
