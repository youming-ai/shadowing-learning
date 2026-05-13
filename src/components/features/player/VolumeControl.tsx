import { Volume2, VolumeX } from "lucide-react";
import React from "react";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

interface VolumeControlProps {
  isMuted: boolean;
  volume: number[];
  onToggleMute: () => void;
  onVolumeChange: (value: number[]) => void;
  compact?: boolean;
}

const VolumeControl = React.memo<VolumeControlProps>(
  ({ isMuted, volume, onToggleMute, onVolumeChange, compact = false }) => {
    const buttonSize = compact ? "h-6 w-6" : "h-8 w-8";
    const iconSize = compact ? "h-3 w-3" : "h-4 w-4";
    const sliderWidth = compact ? "w-12" : "w-20";

    return (
      <div className={`flex items-center ${compact ? "space-x-1" : "space-x-3"}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleMute} className={buttonSize}>
                {isMuted ? <VolumeX className={iconSize} /> : <Volume2 className={iconSize} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMuted ? "取消静音 (M)" : "静音 (M)"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Slider
          value={volume}
          max={1}
          step={0.1}
          onValueChange={onVolumeChange}
          className={sliderWidth}
        />
      </div>
    );
  },
);

VolumeControl.displayName = "VolumeControl";

export default VolumeControl;
