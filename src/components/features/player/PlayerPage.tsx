"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import PlayerFooterContainer from "@/components/features/player/PlayerFooterContainer";
import {
  PlayerErrorState,
  PlayerLoadingState,
  PlayerMissingFileState,
} from "@/components/features/player/page/PlayerFallbackStates";
import { PlayerPageLayout } from "@/components/features/player/page/PlayerPageLayout";
import ScrollableSubtitleDisplay from "@/components/features/player/ScrollableSubtitleDisplay";
import ApiKeyError from "@/components/ui/ApiKeyError";
import { usePlayerDataQuery } from "@/hooks/player/usePlayerDataQuery";
import { useShadowingMode } from "@/hooks/player/useShadowingMode";
import { useAudioPlayer } from "@/hooks/ui/useAudioPlayer";
import { isApiKeyError } from "@/lib/utils/error-handler";
// 引入手动后Process工具，使其在浏览器控制台可用
import "@/lib/utils/manual-postprocess";
import type { Segment } from "@/types/db/database";

export default function PlayerPageComponent({ fileId }: { fileId: string }) {
  const router = useRouter();
  const { file, segments, transcript, audioUrl, loading, error, retry } =
    usePlayerDataQuery(fileId);

  const {
    audioPlayerState,
    handleSeek,
    onPlay,
    onPause,
    clearAudio,
    setCurrentFile,
    updatePlayerState,
    playbackRate,
    setPlaybackRate,
    onSkipBack,
    onSkipForward,
    loopStart,
    loopEnd,
    onSetLoop,
    onClearLoop,
  } = useAudioPlayer();

  const { isShadowingMode, toggleShadowingMode } = useShadowingMode({
    segments,
    isPlaying: audioPlayerState.isPlaying,
    currentTime: audioPlayerState.currentTime,
    onRequestPause: onPause,
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  // 跟踪 audio 元素最近一次通过 timeupdate 自报的时间。
  // 用于区分 state.currentTime 是来自 audio（不要回写）还是外部 seek（需要回写）。
  const lastReportedAudioTimeRef = useRef(0);
  const [volume, setVolume] = useState(1);
  const subtitleContainerId = useId();

  const sanitizeNumber = useCallback((value: number, fallback: number = 0): number => {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return fallback;
    }
    return value;
  }, []);

  useEffect(() => {
    if (file && audioUrl) {
      setCurrentFile(file);
    }
  }, [file, audioUrl, setCurrentFile]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    audio.pause();
    audio.currentTime = 0;
    audio.load();

    const fallbackDuration = file?.duration ?? 0;
    updatePlayerState({
      isPlaying: false,
      currentTime: 0,
      duration: sanitizeNumber(fallbackDuration, 0),
    });
  }, [audioUrl, file?.duration, updatePlayerState, sanitizeNumber]);

  useEffect(() => {
    if (!audioRef.current) return;

    if (audioPlayerState.isPlaying) {
      audioRef.current.play().catch(() => {
        updatePlayerState({ isPlaying: false });
      });
    } else {
      audioRef.current.pause();
    }
  }, [audioPlayerState.isPlaying, updatePlayerState]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!audioRef.current) return;

    const stateTime = audioPlayerState.currentTime;
    const lastReported = lastReportedAudioTimeRef.current;

    // 如果 state 与 audio 最近自报值一致，说明这次 state 变化由 timeupdate 触发，
    // 不要回写 audio.currentTime（否则会和 audio 内部计时形成反馈循环导致进度卡住）。
    if (Math.abs(stateTime - lastReported) < 0.05) {
      return;
    }

    // 否则是外部 seek（点击进度条 / 跳段 / 段落点击），同步到 audio 元素。
    const audioTime = audioRef.current.currentTime;
    if (Math.abs(audioTime - stateTime) > 0.1) {
      audioRef.current.currentTime = stateTime;
      lastReportedAudioTimeRef.current = stateTime;
    }
  }, [audioPlayerState.currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    // audioUrl gates the conditional <audio> element. Without it as a dep, the
    // effect's first run sees audioRef.current === null, returns, and never
    // re-runs when the audio element finally mounts — so timeupdate/play/pause
    // listeners never attach and currentTime stays at 0.
    if (!audio || !audioUrl) return;

    const handleTimeUpdate = () => {
      const current = sanitizeNumber(audio.currentTime, 0);
      lastReportedAudioTimeRef.current = current;
      updatePlayerState({ currentTime: current });
    };

    const handleLoadedMetadata = () => {
      const fallbackDuration = file?.duration ?? 0;
      const duration = sanitizeNumber(audio.duration, fallbackDuration);
      updatePlayerState({ duration });
    };

    const handleDurationChange = () => {
      const fallbackDuration = file?.duration ?? 0;
      const duration = sanitizeNumber(audio.duration, fallbackDuration);
      updatePlayerState({ duration });
    };

    const handleEnded = () => {
      const duration = sanitizeNumber(audio.duration, file?.duration ?? 0);
      updatePlayerState({ isPlaying: false, currentTime: duration });
      onClearLoop();
    };

    const handlePlay = () => {
      updatePlayerState({ isPlaying: true });
    };

    const handlePause = () => {
      updatePlayerState({ isPlaying: false });
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [audioUrl, updatePlayerState, sanitizeNumber, file?.duration, onClearLoop]);

  const handleSegmentClick = useCallback(
    (segment: Segment) => {
      handleSeek(segment.start);
      if (!audioPlayerState.isPlaying) {
        onPlay();
      }
    },
    [handleSeek, audioPlayerState.isPlaying, onPlay],
  );

  const getCurrentSegment = useCallback(() => {
    return segments.find(
      (s) => audioPlayerState.currentTime >= s.start && audioPlayerState.currentTime <= s.end,
    );
  }, [segments, audioPlayerState.currentTime]);

  const handleSetLoopStart = useCallback(() => {
    const seg = getCurrentSegment();
    if (seg) {
      onSetLoop(seg.start, loopEnd ?? seg.end);
    }
  }, [getCurrentSegment, loopEnd, onSetLoop]);

  const handleSetLoopEnd = useCallback(() => {
    const seg = getCurrentSegment();
    if (seg) {
      onSetLoop(loopStart ?? seg.start, seg.end);
    }
  }, [getCurrentSegment, loopStart, onSetLoop]);

  const handleBack = useCallback(() => {
    clearAudio();
    router.push("/");
  }, [clearAudio, router]);

  const handleTogglePlay = useCallback(() => {
    if (audioPlayerState.isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [audioPlayerState.isPlaying, onPause, onPlay]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const layoutFooter = audioUrl ? (
    <PlayerFooterContainer
      audioPlayerState={audioPlayerState}
      onSeek={handleSeek}
      onTogglePlay={handleTogglePlay}
      onSkipBack={onSkipBack}
      onSkipForward={onSkipForward}
      onClearLoop={onClearLoop}
      loopStart={loopStart}
      loopEnd={loopEnd}
      playbackRate={playbackRate}
      onPlaybackRateChange={setPlaybackRate}
      volume={volume}
      onVolumeChange={handleVolumeChange}
      onSetLoopStart={handleSetLoopStart}
      onSetLoopEnd={handleSetLoopEnd}
      onToggleShadowingMode={toggleShadowingMode}
      isShadowingMode={isShadowingMode}
    />
  ) : null;

  if (loading) {
    return (
      <PlayerPageLayout subtitleContainerId={subtitleContainerId}>
        <PlayerLoadingState />
      </PlayerPageLayout>
    );
  }

  if (error) {
    // Checkis否asAPI密钥Error
    if (isApiKeyError(error)) {
      return <ApiKeyError onRetry={retry} />;
    }

    return (
      <PlayerPageLayout subtitleContainerId={subtitleContainerId}>
        <PlayerErrorState message={error} onRetry={retry} onBack={handleBack} />
      </PlayerPageLayout>
    );
  }

  if (!file) {
    return (
      <PlayerPageLayout subtitleContainerId={subtitleContainerId}>
        <PlayerMissingFileState onBack={handleBack} />
      </PlayerPageLayout>
    );
  }

  return (
    <>
      <PlayerPageLayout
        subtitleContainerId={subtitleContainerId}
        showFooter={Boolean(layoutFooter)}
        footer={layoutFooter ?? undefined}
      >
        {segments.length > 0 ? (
          <ScrollableSubtitleDisplay
            segments={segments}
            currentTime={audioPlayerState.currentTime}
            isPlaying={audioPlayerState.isPlaying}
            onSegmentClick={handleSegmentClick}
          />
        ) : transcript?.status === "processing" || transcript?.status === "pending" ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
            <p>正在转录中，请稍候...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
            <p>暂无字幕内容，请先在主页转录此文件</p>
          </div>
        )}
      </PlayerPageLayout>

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" className="hidden">
        <track kind="captions" />
      </audio>
    </>
  );
}
