import { useMemo } from "react";
import { cn } from "@/lib/utils/utils";
import type { AudioPlayerState } from "@/types/db/database";

interface PlayerFooterProps {
  audioPlayerState: AudioPlayerState;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  onClearLoop?: () => void;
  loopStart?: number;
  loopEnd?: number;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onSetLoopStart?: () => void;
  onSetLoopEnd?: () => void;
  onToggleShadowingMode?: () => void;
  isShadowingMode?: boolean;
}

export function PlayerFooter({
  audioPlayerState,
  onSeek,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  onClearLoop,
  loopStart,
  loopEnd,
  volume,
  onVolumeChange,
  onSetLoopStart,
  onSetLoopEnd,
  onToggleShadowingMode,
  isShadowingMode,
}: PlayerFooterProps) {
  const progressWidth = useMemo(() => {
    const { currentTime, duration } = audioPlayerState;
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [audioPlayerState]);

  const volumePercentage = Math.round(volume * 100);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--border-primary)] bg-[var(--surface-card)] shadow-[var(--shadow-lg)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
        {/*进度条区域*/}
        <div className="flex items-center gap-3">
          <span className="min-w-[3rem] text-sm font-mono tabular-nums text-[var(--text-secondary)]">
            {formatTime(audioPlayerState.currentTime)}
          </span>

          <div className="group relative flex-1">
            {/*进度条容器 - 增加点击区域*/}
            <div className="relative h-2 w-full cursor-pointer rounded-full bg-[var(--surface-muted)]">
              {/*进度条填充*/}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-[var(--color-primary)] transition-all duration-75"
                style={{ width: `${progressWidth}%` }}
              />
              {/*进度指示器 - 始终显示*/}
              <div
                className="pointer-events-none absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--color-primary)] shadow-[var(--shadow-md)] ring-2 ring-[var(--surface-card)] transition-transform group-hover:scale-110"
                style={{ left: `${progressWidth}%` }}
              />
            </div>
            {/*透明 range input 覆盖在上面*/}
            <input
              type="range"
              min={0}
              max={audioPlayerState.duration || 100}
              step={0.1}
              value={audioPlayerState.currentTime}
              onChange={(event) => onSeek(parseFloat(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
              aria-label="播放进度"
            />
          </div>

          <span className="min-w-[3rem] text-right text-sm font-mono tabular-nums text-[var(--text-secondary)]">
            {formatTime(audioPlayerState.duration || 0)}
          </span>
        </div>

        {/*控制按钮区域*/}
        <div className="flex items-center justify-between">
          {/*左侧：播放控制*/}
          <div className="flex items-center gap-2 sm:gap-3">
            {/*后退按钮*/}
            <button
              type="button"
              onClick={() => onSkipBack?.()}
              disabled={!onSkipBack}
              className="btn-secondary !h-11 !w-11 !rounded-full !p-0"
              aria-label="后退10秒"
            >
              <span className="material-symbols-outlined text-xl">replay_10</span>
            </button>

            {/*播放/暂停按钮 - 使用 btn-primary 样式*/}
            <button
              type="button"
              onClick={onTogglePlay}
              className="btn-primary !h-14 !w-14 !rounded-full !p-0"
              aria-label={audioPlayerState.isPlaying ? "暂停" : "播放"}
            >
              <span className="material-symbols-outlined text-3xl">
                {audioPlayerState.isPlaying ? "pause" : "play_arrow"}
              </span>
            </button>

            {/*前进按钮*/}
            <button
              type="button"
              onClick={() => onSkipForward?.()}
              disabled={!onSkipForward}
              className="btn-secondary !h-11 !w-11 !rounded-full !p-0"
              aria-label="前进10秒"
            >
              <span className="material-symbols-outlined text-xl">forward_10</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSetLoopStart}
              className={cn(
                "btn-secondary !h-9 !w-9 !rounded-full !p-0 text-xs font-bold",
                loopStart !== undefined &&
                  "!border-[var(--color-primary)] !text-[var(--color-primary)]",
              )}
              aria-label="设置循环起点 A"
            >
              A
            </button>
            <button
              type="button"
              onClick={onSetLoopEnd}
              className={cn(
                "btn-secondary !h-9 !w-9 !rounded-full !p-0 text-xs font-bold",
                loopEnd !== undefined &&
                  "!border-[var(--color-primary)] !text-[var(--color-primary)]",
              )}
              aria-label="设置循环终点 B"
            >
              B
            </button>
            {(loopStart !== undefined || loopEnd !== undefined) && (
              <button
                type="button"
                onClick={onClearLoop}
                className="btn-secondary !h-9 !w-9 !rounded-full !p-0"
                aria-label="清除循环"
              >
                <span className="material-symbols-outlined text-lg">clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleShadowingMode}
              className={cn(
                "btn-secondary !h-9 !w-9 !rounded-full !p-0",
                isShadowingMode && "!border-[var(--color-primary)] !text-[var(--color-primary)]",
              )}
              aria-label={isShadowingMode ? "关闭跟读模式" : "开启跟读模式"}
            >
              <span className="material-symbols-outlined text-lg">
                {isShadowingMode ? "record_voice_over" : "voice_selection"}
              </span>
            </button>
          </div>

          {/*右侧：音量控制*/}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              aria-label={volume === 0 ? "取消静音" : "静音"}
            >
              <span className="material-symbols-outlined text-xl">
                {volume === 0 ? "volume_off" : volume < 0.5 ? "volume_down" : "volume_up"}
              </span>
            </button>
            <div className="relative flex items-center">
              <div className="h-1.5 w-20 rounded-full bg-[var(--surface-muted)] sm:w-24">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${volumePercentage}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => onVolumeChange(parseFloat(event.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
                aria-label="音量"
              />
            </div>
            <span className="w-10 text-right text-xs font-mono tabular-nums text-[var(--text-tertiary)]">
              {volumePercentage}%
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
