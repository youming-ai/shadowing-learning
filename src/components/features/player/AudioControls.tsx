import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import React from 'react'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'

interface AudioControlsProps {
  isPlaying: boolean
  onPlayPause: () => void
  onSkipBack?: () => void
  onSkipForward?: () => void
  audioUrl?: string
  compact?: boolean
}

const AudioControls = React.memo<AudioControlsProps>(
  ({ isPlaying, onPlayPause, onSkipBack, onSkipForward, audioUrl, compact = false }) => {
    const buttonSize = compact ? 'h-8 w-8' : 'h-10 w-10'
    const playButtonSize = compact ? 'h-10 w-10' : 'h-12 w-12'
    const iconSize = compact ? 'h-4 w-4' : 'h-5 w-5'
    const playIconSize = compact ? 'h-5 w-5' : 'h-6 w-6'

    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-4'}`}>
        {/*Skip back*/}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSkipBack}
                disabled={!onSkipBack}
                className={buttonSize}
              >
                <SkipBack className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>后退 (←)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/*Play/Pause*/}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                onClick={onPlayPause}
                disabled={!audioUrl}
                className={playButtonSize}
              >
                {isPlaying ? <Pause className={playIconSize} /> : <Play className={playIconSize} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPlaying ? '暂停 (空格)' : '播放 (空格)'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/*Skip forward*/}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSkipForward}
                disabled={!onSkipForward}
                className={buttonSize}
              >
                <SkipForward className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>前进 (→)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  },
)

AudioControls.displayName = 'AudioControls'

export default AudioControls
