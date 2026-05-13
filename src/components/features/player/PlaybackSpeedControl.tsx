import { Gauge } from "lucide-react";
import React from "react";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

interface PlaybackSpeedControlProps {
  playbackRate: number[];
  onPlaybackRateChange: (value: number[]) => void;
  compact?: boolean;
}

const PlaybackSpeedControl = React.memo<PlaybackSpeedControlProps>(
  ({ playbackRate, onPlaybackRateChange, compact = false }) => {
    const buttonSize = compact ? "h-6 w-6" : "h-8 w-8";
    const iconSize = compact ? "h-3 w-3" : "h-4 w-4";
    const sliderWidth = compact ? "w-12" : "w-20";

    return (
      <div className={`flex items-center ${compact ? "space-x-1" : "space-x-3"}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={buttonSize}>
                <Gauge className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>播放速度: {playbackRate[0]}x (1-5)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Slider
          value={playbackRate}
          max={2}
          min={0.25}
          step={0.25}
          onValueChange={onPlaybackRateChange}
          className={sliderWidth}
        />
        {!compact && <span className="w-8 text-muted-foreground text-xs">{playbackRate[0]}x</span>}
      </div>
    );
  },
);

PlaybackSpeedControl.displayName = "PlaybackSpeedControl";

export default PlaybackSpeedControl;
