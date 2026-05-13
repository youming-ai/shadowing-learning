import { useCallback, useEffect } from 'react'

interface UseKeyboardControlsProps {
  audioUrl?: string
  onPlayPause: () => void
  onSkipBack?: () => void
  onSkipForward?: () => void
  onToggleMute: () => void
  onSetPlaybackRate: (rate: number) => void
}

export function useKeyboardControls({
  audioUrl,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onToggleMute,
  onSetPlaybackRate,
}: UseKeyboardControlsProps) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!audioUrl) return

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault()
          onPlayPause()
          break
        case 'arrowleft':
          event.preventDefault()
          onSkipBack?.()
          break
        case 'arrowright':
          event.preventDefault()
          onSkipForward?.()
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
          const speed = parseInt(event.key, 10) * 0.25
          onSetPlaybackRate(speed)
          break
        }
      }
    },
    [audioUrl, onPlayPause, onSkipBack, onSkipForward, onToggleMute, onSetPlaybackRate],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])
}
