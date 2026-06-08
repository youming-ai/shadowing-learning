import { useCallback, useState } from 'react'

export interface UseAudioPlayerStateReturn {
  isMuted: boolean
  volume: number[]
  playbackRate: number[]
  showAdvancedControls: boolean
  setVolume: (volume: number[]) => void
  setPlaybackRate: (rate: number[]) => void
  toggleMute: () => void
  setShowAdvancedControls: (show: boolean) => void
}

export function useAudioPlayerState(): UseAudioPlayerStateReturn {
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState([1])
  const [playbackRate, setPlaybackRate] = useState([1])
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMutedState = !prev
      setVolume(newMutedState ? [0] : [1])
      return newMutedState
    })
  }, [])

  return {
    isMuted,
    volume,
    playbackRate,
    showAdvancedControls,
    setVolume,
    setPlaybackRate,
    toggleMute,
    setShowAdvancedControls,
  }
}
