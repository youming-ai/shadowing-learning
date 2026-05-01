"use client";

import React from "react";
import { PlayerFooter } from "@/components/features/player/page/PlayerFooter";
import type { AudioPlayerState } from "@/types/db/database";

interface PlayerFooterContainerProps {
  audioPlayerState: AudioPlayerState;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onClearLoop: () => void;
  loopStart?: number;
  loopEnd?: number;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onSetLoopStart: () => void;
  onSetLoopEnd: () => void;
  onToggleShadowingMode: () => void;
  isShadowingMode: boolean;
}

const PlayerFooterContainer = React.memo<PlayerFooterContainerProps>((props) => {
  return <PlayerFooter {...props} />;
});

PlayerFooterContainer.displayName = "PlayerFooterContainer";

export default PlayerFooterContainer;
