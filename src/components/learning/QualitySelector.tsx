import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Wifi, Signal, SignalLow, SignalMedium, Settings2, Check } from 'lucide-react';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { cn } from '@/lib/utils';

interface QualitySelectorProps {
  currentQuality: string;
  selectedQuality: string;
  availableQualities: string[];
  onQualityChange: (quality: string) => void;
  showNetworkInfo?: boolean;
}

const QUALITY_BITRATES: Record<string, string> = {
  '360p': '~0.5 Mbps',
  '480p': '~1 Mbps',
  '720p': '~2.5 Mbps',
  '1080p': '~5 Mbps',
};

export const QualitySelector = ({
  currentQuality,
  selectedQuality,
  availableQualities,
  onQualityChange,
  showNetworkInfo = true,
}: QualitySelectorProps) => {
  const networkQuality = useNetworkQuality();

  const getNetworkIcon = () => {
    switch (networkQuality.connectionType) {
      case 'wifi':
        return <Wifi className="h-4 w-4" />;
      case '4g':
        return <Signal className="h-4 w-4" />;
      case '3g':
        return <SignalMedium className="h-4 w-4" />;
      case '2g':
        return <SignalLow className="h-4 w-4" />;
      default:
        return <Wifi className="h-4 w-4" />;
    }
  };

  const getConnectionColor = () => {
    if (!networkQuality.isOnline) return 'text-destructive';
    switch (networkQuality.connectionType) {
      case 'wifi':
      case '4g':
        return 'text-green-500';
      case '3g':
        return 'text-yellow-500';
      case '2g':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span>{selectedQuality === 'auto' ? `Auto (${currentQuality})` : selectedQuality}</span>
          {showNetworkInfo && (
            <span className={cn('ml-1', getConnectionColor())}>
              {getNetworkIcon()}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-background">
        {showNetworkInfo && (
          <>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Network Status</span>
              <Badge variant="outline" className={getConnectionColor()}>
                {networkQuality.connectionType.toUpperCase()}
              </Badge>
            </DropdownMenuLabel>
            <div className="px-2 py-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Speed:</span>
                <span>{networkQuality.effectiveBandwidth.toFixed(1)} Mbps</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span>{networkQuality.latency} ms</span>
              </div>
              <div className="flex justify-between">
                <span>Recommended:</span>
                <span className="font-medium">{networkQuality.recommendedQuality}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuLabel>Video Quality</DropdownMenuLabel>
        
        <DropdownMenuItem
          onClick={() => onQualityChange('auto')}
          className="justify-between"
        >
          <span>Auto</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              ({networkQuality.recommendedQuality})
            </span>
            {selectedQuality === 'auto' && <Check className="h-4 w-4" />}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {availableQualities.map((quality) => (
          <DropdownMenuItem
            key={quality}
            onClick={() => onQualityChange(quality)}
            className="justify-between"
          >
            <span>{quality}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {QUALITY_BITRATES[quality]}
              </span>
              {selectedQuality === quality && <Check className="h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
