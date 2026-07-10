import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { CurrentSentence } from '~/components/features/watch/CurrentSentence'
import { MediaViewport } from '~/components/features/watch/MediaViewport'
import { SubtitlePanel } from '~/components/features/watch/SubtitlePanel'
import { WatchControls } from '~/components/features/watch/WatchControls'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useSubtitlePipeline } from '~/hooks/media/useSubtitlePipeline'
import { usePlayerAdapter } from '~/hooks/player/usePlayerAdapter'
import { useSegmentLoop } from '~/hooks/player/useSegmentLoop'
import { useSegmentNavigation } from '~/hooks/player/useSegmentNavigation'
import { useShadowingPractice } from '~/hooks/player/useShadowingPractice'
import { useWatchKeyboard } from '~/hooks/player/useWatchKeyboard'
import { DBUtils } from '~/lib/db/db'
import type { Segment } from '~/types/db/database'

export const mediaKeys = {
  all: ['media'] as const,
  byId: (id: number) => [...mediaKeys.all, id] as const,
}

export default function WatchPage({ mediaId }: { mediaId: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const parsedId = Number.parseInt(mediaId, 10)
  const validId = Number.isFinite(parsedId) && parsedId > 0

  const mediaQuery = useQuery({
    queryKey: mediaKeys.byId(parsedId),
    enabled: validId,
    queryFn: async () => (await DBUtils.getMedia(parsedId)) ?? null,
  })
  const media = mediaQuery.data ?? null

  const pipeline = useSubtitlePipeline(media)
  const player = usePlayerAdapter(media)
  const {
    activeIndex: navActiveIndex,
    goPrev,
    goNext,
  } = useSegmentNavigation(pipeline.segments, player.currentTime, player.seekTo)
  const { isLooping, toggleLoop } = useSegmentLoop(
    pipeline.segments,
    player.currentTime,
    player.seekTo,
  )

  const [playbackRate, setPlaybackRateState] = useState(1)
  const [volume, setVolumeState] = useState(1)

  const playerControls = useMemo(
    () => ({
      play: player.play,
      pause: player.pause,
      seekTo: player.seekTo,
      setRate: player.setRate,
    }),
    [player.play, player.pause, player.seekTo, player.setRate],
  )

  const shadowing = useShadowingPractice({
    segments: pipeline.segments,
    currentTime: player.currentTime,
    player: playerControls,
    browseRate: playbackRate,
  })

  // While shadowing is active, the FSM owns the active sentence index.
  const activeIndex =
    shadowing.config.enabled && shadowing.state.phase !== 'idle'
      ? shadowing.state.activeIndex
      : navActiveIndex

  const handleTogglePlay = useCallback(() => {
    if (player.isPlaying) player.pause()
    else player.play()
  }, [player])

  const handleRateChange = useCallback(
    (rate: number) => {
      setPlaybackRateState(rate)
      if (!shadowing.config.enabled) {
        player.setRate(rate)
      }
    },
    [player, shadowing.config.enabled],
  )

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolumeState(v)
      player.setVolume(v)
    },
    [player],
  )

  const handleSegmentClick = useCallback(
    (segment: Segment, index: number) => {
      if (shadowing.config.enabled) {
        shadowing.jumpToIndex(index)
        return
      }
      player.seekTo(segment.start)
      if (!player.isPlaying) player.play()
    },
    [player, shadowing],
  )

  const handlePrev = useCallback(() => {
    if (shadowing.config.enabled) {
      const idx = Math.max(0, activeIndex - 1)
      shadowing.jumpToIndex(idx)
      return
    }
    goPrev()
  }, [shadowing, activeIndex, goPrev])

  const handleNext = useCallback(() => {
    if (shadowing.config.enabled) {
      const idx = Math.min(pipeline.segments.length - 1, activeIndex + 1)
      if (idx >= 0) shadowing.jumpToIndex(idx)
      return
    }
    goNext()
  }, [shadowing, activeIndex, pipeline.segments.length, goNext])

  const handleToggleLoop = useCallback(() => {
    if (shadowing.config.enabled) return
    toggleLoop()
  }, [shadowing.config.enabled, toggleLoop])

  const handleRegenerate = useCallback(() => {
    if (pipeline.subtitle?.source === 'whisper') {
      if (!window.confirm(t('watch.regenerateConfirm'))) return
    }
    void pipeline.regenerate()
  }, [pipeline, t])

  useWatchKeyboard({
    enabled: Boolean(media),
    onPlayPause: handleTogglePlay,
    onPrev: handlePrev,
    onNext: handleNext,
    onToggleMute: () => handleVolumeChange(volume === 0 ? 1 : 0),
    onSetRate: handleRateChange,
    onToggleShadowing: shadowing.toggleShadowing,
  })

  if (!validId || (!mediaQuery.isLoading && !media)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-[var(--text-secondary)]">{t('watch.notFound')}</p>
        <button type="button" onClick={() => navigate({ to: '/' })} className="btn-primary">
          {t('player.back')}
        </button>
      </div>
    )
  }
  if (mediaQuery.isLoading || !media) {
    return <PageLoadingState />
  }

  const activeSegment = activeIndex >= 0 ? (pipeline.segments[activeIndex] ?? null) : null
  const showOriginalOnly = pipeline.subtitle?.source === 'official'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:h-screen">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="btn-secondary !h-9 !w-9 !rounded-full !p-0"
          aria-label={t('player.back')}
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">
            {media.title}
          </h1>
          {media.channelName && (
            <p className="truncate text-xs text-[var(--text-secondary)]">{media.channelName}</p>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-0 flex-col gap-3">
          <MediaViewport
            media={media}
            containerRef={player.containerRef}
            embedBlocked={player.embedBlocked}
          />
          <CurrentSentence segment={activeSegment} showOriginalOnly={Boolean(showOriginalOnly)} />
          <WatchControls
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            availableRates={player.availableRates}
            playbackRate={playbackRate}
            volume={volume}
            isLooping={isLooping}
            onTogglePlay={handleTogglePlay}
            onSeek={player.seekTo}
            onPrev={handlePrev}
            onNext={handleNext}
            onToggleLoop={handleToggleLoop}
            onRateChange={handleRateChange}
            onVolumeChange={handleVolumeChange}
            shadowingEnabled={shadowing.config.enabled}
            shadowingState={shadowing.state}
            shadowingConfig={shadowing.config}
            onToggleShadowing={shadowing.toggleShadowing}
            onShadowingConfigChange={shadowing.setShadowingConfig}
          />
        </div>
        <div className="min-h-[40vh] lg:min-h-0">
          <SubtitlePanel
            segments={pipeline.segments}
            subtitle={pipeline.subtitle}
            activeIndex={activeIndex}
            stage={pipeline.stage}
            translateProgress={pipeline.translateProgress}
            onSegmentClick={handleSegmentClick}
            onRegenerate={handleRegenerate}
            onRetry={() => void pipeline.retry()}
          />
        </div>
      </div>
    </div>
  )
}
