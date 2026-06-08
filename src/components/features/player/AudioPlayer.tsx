'use client'

import React, { useEffect, useRef } from 'react'
import AudioControls from '~/components/features/player/AudioControls'
import PlaybackSpeedControl from '~/components/features/player/PlaybackSpeedControl'
import VolumeControl from '~/components/features/player/VolumeControl'
import { Card } from '~/components/ui/card'
import { useAudioPlayerState } from '~/hooks/ui/useAudioPlayerState'
import { useAudioPlayerTime } from '~/hooks/ui/useAudioPlayerTime'
import { useKeyboardControls } from '~/hooks/ui/useKeyboardControls'

interface AudioPlayerProps {
  audioUrl?: string
  currentTime?: number
  duration?: number
  isPlaying?: boolean
  onPlay?: () => void
  onPause?: () => void
  onSeek?: (time: number) => void
  onSkipBack?: () => void
  onSkipForward?: () => void
  title?: string
  className?: string
}

const AudioPlayer = React.memo<AudioPlayerProps>(
  ({
    audioUrl,
    currentTime = 0,
    duration = 0,
    isPlaying = false,
    onPlay,
    onPause,
    onSeek,
    onSkipBack,
    onSkipForward,
    title = 'Audio Player',
    className = '',
  }) => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const { formatTime } = useAudioPlayerTime()
    const { isMuted, volume, playbackRate, setVolume, setPlaybackRate, toggleMute } =
      useAudioPlayerState()

    const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
    const formattedCurrentTime = formatTime(safeCurrentTime)
    const formattedDuration = formatTime(safeDuration)
    const progress = safeDuration > 0 ? Math.min(100, (safeCurrentTime / safeDuration) * 100) : 0

    const handlePlayPause = () => {
      if (isPlaying) {
        onPause?.()
      } else {
        onPlay?.()
      }
    }

    const handleVolumeChange = (value: number[]) => {
      const newVolume = value[0]
      setVolume([newVolume])
    }

    const handlePlaybackRateChange = (value: number[]) => {
      const newRate = value[0]
      setPlaybackRate([newRate])
    }

    // Keyboard controls
    useKeyboardControls({
      audioUrl,
      onPlayPause: handlePlayPause,
      onSkipBack,
      onSkipForward,
      onToggleMute: toggleMute,
      onSetPlaybackRate: (rate) => setPlaybackRate([rate]),
    })

    // Audio element effects
    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.volume = volume[0]
        audioRef.current.playbackRate = playbackRate[0]
      }
    }, [volume, playbackRate])

    useEffect(() => {
      if (!audioRef.current) return
      if (Math.abs(audioRef.current.currentTime - safeCurrentTime) < 0.05) {
        return
      }
      audioRef.current.currentTime = safeCurrentTime
    }, [safeCurrentTime])

    // Handle play/pause
    useEffect(() => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.play().catch(() => {
            // Silently handle play failures (common in mobile browsers)
          })
        } else {
          audioRef.current.pause()
        }
      }
    }, [isPlaying])

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const audio = e.target as HTMLAudioElement
      onSeek?.(audio.currentTime)
    }

    return (
      <Card
        className={`space-y-6 border border-primary/20 bg-gradient-to-br from-background to-primary-light p-6 shadow-lg ${className}`}
        role="region"
        aria-label="音频播放器控制面板"
      >
        {/*主要播放控制区域*/}
        <div className="flex flex-col space-y-6">
          {/*播放信息和控制按钮*/}
          <div className="flex flex-col space-y-4">
            {/*File名*/}
            <div className="text-center">
              <h2
                className="truncate px-4 font-bold text-foreground text-xl"
                aria-label={`当前播放: ${title}`}
              >
                {title}
              </h2>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex w-full items-center gap-3">
                <span className="w-12 text-right text-xs text-muted-foreground" aria-hidden>
                  {formattedCurrentTime}
                </span>
                <div className="relative h-1 flex-1 rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="w-12 text-left text-xs text-muted-foreground" aria-hidden>
                  {formattedDuration}
                </span>
              </div>
            </div>

            {/*播放控制按钮*/}
            <div className="flex items-center justify-center space-x-6">
              <AudioControls
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onSkipBack={onSkipBack}
                onSkipForward={onSkipForward}
                audioUrl={audioUrl}
                compact={false}
              />
            </div>

            {/*高级控制*/}
            <div className="flex items-center justify-center space-x-6">
              <VolumeControl
                isMuted={isMuted}
                volume={volume}
                onToggleMute={toggleMute}
                onVolumeChange={handleVolumeChange}
                compact={false}
              />

              <PlaybackSpeedControl
                playbackRate={playbackRate}
                onPlaybackRateChange={handlePlaybackRateChange}
                compact={false}
              />
            </div>
          </div>

          {/*隐藏Audio元素*/}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={onPause}
              aria-label={`音频播放器: ${title}`}
              preload="metadata"
            >
              <track kind="captions" srcLang="zh" label="中文字幕" default />
              <track kind="captions" srcLang="en" label="English subtitles" />
              您的浏览器不支持音频播放。
            </audio>
          )}
        </div>
      </Card>
    )
  },
)

AudioPlayer.displayName = 'AudioPlayer'

export default AudioPlayer
