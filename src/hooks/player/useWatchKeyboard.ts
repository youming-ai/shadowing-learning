import { useCallback, useEffect } from 'react'

interface UseWatchKeyboardProps {
  enabled: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onToggleMute: () => void
  onSetRate: (rate: number) => void
}

export function useWatchKeyboard({
  enabled,
  onPlayPause,
  onPrev,
  onNext,
  onToggleMute,
  onSetRate,
}: UseWatchKeyboardProps) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      )
        return

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault()
          onPlayPause()
          break
        case 'arrowleft':
          event.preventDefault()
          onPrev()
          break
        case 'arrowright':
          event.preventDefault()
          onNext()
          break
        case 'm':
          event.preventDefault()
          onToggleMute()
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          event.preventDefault()
          onSetRate(parseInt(event.key, 10) * 0.25)
          break
        }
      }
    },
    [enabled, onPlayPause, onPrev, onNext, onToggleMute, onSetRate],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])
}
