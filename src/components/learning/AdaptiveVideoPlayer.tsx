import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Wifi,
  WifiOff,
  RotateCcw,
  SkipBack,
  SkipForward,
  Download,
  Loader2,
  ExternalLink,
  Bug,
} from 'lucide-react';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { useRecordingPlaybackUrl, useUpdateWatchProgress, useVideoWatchProgress } from '@/hooks/useClassRecordings';
import { cn } from '@/lib/utils';

interface RecordingData {
  id: string;
  b2_original_path?: string | null;
  b2_hls_360p_path?: string | null;
  b2_hls_480p_path?: string | null;
  b2_hls_720p_path?: string | null;
  b2_hls_1080p_path?: string | null;
  cdn_base_url?: string | null;
  bunny_video_guid?: string | null;
}

interface AdaptiveVideoPlayerProps {
  recordingId: string;
  title: string;
  recordingData?: RecordingData;
  onProgress?: (seconds: number, percent: number) => void;
  onComplete?: () => void;
  onQualityChange?: (quality: string) => void;
  initialPosition?: number;
  autoPlay?: boolean;
  showDownloadButton?: boolean;
  onDownloadRequest?: () => void;
}

// Get error message from video error code
const getVideoErrorMessage = (code: number | undefined): string => {
  switch (code) {
    case 1: return 'Video loading aborted';
    case 2: return 'Network error - check your connection';
    case 3: return 'Video decoding failed - format not supported by browser';
    case 4: return 'Video format not supported or CORS blocked';
    default: return 'Unknown video error';
  }
};

// Build fallback URL from recording data (Replit-style 3-tier fallback)
const buildFallbackUrl = (recording: RecordingData, quality: string): { url: string; type: 'hls' | 'direct' } | null => {
  const cdnBase = recording.cdn_base_url;
  
  // Tier 1: Try HLS paths with CDN
  const qualityPaths: Record<string, string | null | undefined> = {
    '1080p': recording.b2_hls_1080p_path,
    '720p': recording.b2_hls_720p_path,
    '480p': recording.b2_hls_480p_path,
    '360p': recording.b2_hls_360p_path,
  };
  
  // Try requested quality, then fallback to lower qualities
  const fallbackOrder = ['1080p', '720p', '480p', '360p'];
  const startIndex = Math.max(0, fallbackOrder.indexOf(quality));
  
  for (let i = startIndex; i < fallbackOrder.length; i++) {
    const path = qualityPaths[fallbackOrder[i]];
    if (path && cdnBase) {
      return { url: `${cdnBase}/${path}`, type: 'hls' };
    }
  }
  
  // Tier 2: Try original file with CDN
  if (recording.b2_original_path && cdnBase) {
    return { url: `${cdnBase}/${recording.b2_original_path}`, type: 'direct' };
  }
  
  // Tier 3: Bunny CDN if available
  if (recording.bunny_video_guid) {
    return { url: `https://vz-cdn.b-cdn.net/${recording.bunny_video_guid}/playlist.m3u8`, type: 'hls' };
  }
  
  return null;
};

export const AdaptiveVideoPlayer = ({
  recordingId,
  title,
  recordingData,
  onProgress,
  onComplete,
  onQualityChange,
  initialPosition = 0,
  autoPlay = false,
  showDownloadButton = false,
  onDownloadRequest,
}: AdaptiveVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [currentQuality, setCurrentQuality] = useState<string>('720p');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [videoState, setVideoState] = useState({ networkState: 0, readyState: 0 });
  const [retryCount, setRetryCount] = useState(0);
  
  const networkQuality = useNetworkQuality();
  const getPlaybackUrl = useRecordingPlaybackUrl();
  const updateProgress = useUpdateWatchProgress();
  const { data: savedProgress } = useVideoWatchProgress(recordingId);
  
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const progressUpdateRef = useRef<ReturnType<typeof setTimeout>>();

  // Check for debug mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      setShowDebug(true);
    }
  }, []);

  // Update video state for debug
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        setVideoState({
          networkState: videoRef.current.networkState,
          readyState: videoRef.current.readyState,
        });
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Load video with 3-tier fallback (Edge Function → CDN → B2 Direct)
  useEffect(() => {
    const loadVideo = async () => {
      let playbackUrl: string | null = null;
      let isHls = false;
      let qualities: string[] = ['original'];
      let quality = 'original';
      
      setError(null);
      setErrorCode(null);
      setIsBuffering(true);
      
      try {
        // Tier 1: Try Edge Function (primary method)
        console.log('Tier 1: Trying edge function...');
        const playbackData = await getPlaybackUrl.mutateAsync({
          recordingId,
          quality: networkQuality.recommendedQuality,
        });
        
        if (playbackData.hlsUrl) {
          playbackUrl = playbackData.hlsUrl;
          isHls = true;
          qualities = playbackData.availableQualities || ['360p', '480p', '720p', '1080p'];
          quality = playbackData.quality;
          console.log('Tier 1 success: Got HLS URL from edge function');
        } else if (playbackData.directUrl) {
          playbackUrl = playbackData.directUrl;
          isHls = false;
          console.log('Tier 1 success: Got direct URL from edge function');
        }
      } catch (err) {
        console.warn('Tier 1 failed (edge function):', err);
        
        // Tier 2: Try building URL from recording data
        if (recordingData) {
          console.log('Tier 2: Trying fallback from recording data...');
          const fallback = buildFallbackUrl(recordingData, networkQuality.recommendedQuality);
          if (fallback) {
            playbackUrl = fallback.url;
            isHls = fallback.type === 'hls';
            console.log(`Tier 2 success: Built ${fallback.type} URL from recording data`);
          }
        }
      }
      
      // If no URL found, show error
      if (!playbackUrl) {
        console.error('All tiers failed - no playback URL available');
        setError('Video not available. Please try again later.');
        setIsBuffering(false);
        return;
      }
      
      // Setup playback based on URL type
      if (isHls) {
        try {
          const { default: Hls } = await import('hls.js');
          
          setHlsUrl(playbackUrl);
          setAvailableQualities(qualities);
          setCurrentQuality(quality);
          
          if (videoRef.current && Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 30,
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
              startLevel: -1,
            });
            
            hls.loadSource(playbackUrl);
            hls.attachMedia(videoRef.current);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setIsBuffering(false);
              if (autoPlay) {
                videoRef.current?.play();
              }
              const startPosition = savedProgress?.progress_seconds || initialPosition;
              if (startPosition > 0 && videoRef.current) {
                videoRef.current.currentTime = startPosition;
              }
            });
            
            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
              const qualityLevels = ['360p', '480p', '720p', '1080p'];
              const newQuality = qualityLevels[data.level] || 'auto';
              setCurrentQuality(newQuality);
              onQualityChange?.(newQuality);
            });
            
            hls.on(Hls.Events.ERROR, (_, data) => {
              if (data.fatal) {
                console.error('HLS error:', data);
                if (recordingData) {
                  const directFallback = buildFallbackUrl(recordingData, 'original');
                  if (directFallback && directFallback.type === 'direct') {
                    console.log('HLS failed, falling back to direct URL');
                    hls.destroy();
                    setDirectUrl(directFallback.url);
                    setHlsUrl(null);
                    if (videoRef.current) {
                      videoRef.current.src = directFallback.url;
                      videoRef.current.load();
                    }
                    return;
                  }
                }
                setError('Failed to load video. Please try again.');
                setIsBuffering(false);
              }
            });
            
            hlsRef.current = hls;
          } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS
            videoRef.current.src = playbackUrl;
            videoRef.current.load();
          }
        } catch (hlsErr) {
          console.error('HLS.js failed to load:', hlsErr);
          setError('Video player not supported. Please try a different browser.');
          setIsBuffering(false);
        }
      } else {
        // Direct MP4 playback - React will handle src via props
        console.log('Setting direct URL for playback:', playbackUrl);
        setDirectUrl(playbackUrl);
        setAvailableQualities(['original']);
        setCurrentQuality('original');
        // No imperative src assignment - React prop handles it
      }
    };
    
    loadVideo();
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [recordingId, recordingData, retryCount]);

  // Ensure video loads when directUrl changes (React prop triggers this)
  useEffect(() => {
    if (directUrl && videoRef.current) {
      console.log('Direct URL set, calling load()...');
      videoRef.current.load();
    }
  }, [directUrl]);

  // Handle video events via React props
  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    if (video?.error) {
      const code = video.error.code;
      console.error('Video error:', code, video.error.message);
      setErrorCode(code);
      setError(getVideoErrorMessage(code));
      setIsBuffering(false);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      const startPosition = savedProgress?.progress_seconds || initialPosition;
      if (startPosition > 0) {
        video.currentTime = startPosition;
      }
      if (autoPlay) {
        video.play().catch(console.error);
      }
    }
  }, [savedProgress, initialPosition, autoPlay]);

  const handleRetry = useCallback(() => {
    setRetryCount(c => c + 1);
    setError(null);
    setErrorCode(null);
    setHlsUrl(null);
    setDirectUrl(null);
  }, []);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };
    
    const container = containerRef.current;
    container?.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Save progress periodically
  useEffect(() => {
    if (isPlaying && duration > 0) {
      progressUpdateRef.current = setInterval(() => {
        const percent = (currentTime / duration) * 100;
        updateProgress.mutate({
          recordingId,
          progressSeconds: Math.floor(currentTime),
          progressPercent: percent,
          completed: percent >= 95,
        });
        onProgress?.(currentTime, percent);
      }, 10000);
    }
    
    return () => {
      if (progressUpdateRef.current) {
        clearInterval(progressUpdateRef.current);
      }
    };
  }, [isPlaying, currentTime, duration, recordingId]);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  }, []);

  const handleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  const handleQualityChange = useCallback((quality: string) => {
    setSelectedQuality(quality);
    
    if (hlsRef.current) {
      if (quality === 'auto') {
        hlsRef.current.currentLevel = -1;
      } else {
        const qualityIndex = availableQualities.indexOf(quality);
        if (qualityIndex !== -1) {
          hlsRef.current.currentLevel = qualityIndex;
        }
      }
    }
  }, [availableQualities]);

  const skipForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  }, [duration]);

  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeUrl = hlsUrl || directUrl;
  const urlDomain = activeUrl ? new URL(activeUrl).hostname : null;

  // Debug Panel Component
  const DebugPanel = () => (
    <div className="absolute top-2 left-2 bg-black/90 text-white text-xs p-3 rounded-lg max-w-xs z-50 font-mono">
      <div className="flex items-center gap-2 mb-2 font-bold">
        <Bug className="h-3 w-3" /> Debug Info
      </div>
      <div className="space-y-1">
        <div>ID: {recordingId.slice(0, 8)}...</div>
        <div>Type: {hlsUrl ? 'HLS' : directUrl ? 'Direct MP4' : 'None'}</div>
        <div>Domain: {urlDomain || 'N/A'}</div>
        <div>Network: {videoState.networkState} | Ready: {videoState.readyState}</div>
        <div>Error: {errorCode ? `Code ${errorCode}` : 'None'}</div>
        <div>MP4 Support: {videoRef.current?.canPlayType('video/mp4') || 'unknown'}</div>
        <div>Buffer: {loadProgress.toFixed(0)}%</div>
      </div>
      {activeUrl && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full text-xs h-7"
          onClick={() => window.open(activeUrl, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in new tab
        </Button>
      )}
    </div>
  );

  if (error) {
    return (
      <Card className="aspect-video bg-black flex items-center justify-center relative">
        {showDebug && <DebugPanel />}
        <div className="text-center text-white p-4">
          <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2 font-medium">{error}</p>
          {errorCode && (
            <p className="text-sm opacity-70 mb-4">Error code: {errorCode}</p>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={handleRetry} variant="secondary">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            {activeUrl && (
              <Button variant="outline" onClick={() => window.open(activeUrl, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Direct
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 text-xs opacity-50"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </Button>
        </div>
      </Card>
    );
  }

  if (getPlaybackUrl.isPending || (!hlsUrl && !directUrl)) {
    return (
      <Card className="aspect-video bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" />
          <p className="text-sm opacity-70">Preparing video...</p>
        </div>
      </Card>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-video bg-black rounded-lg overflow-hidden group",
        isFullscreen && "fixed inset-0 z-50 rounded-none"
      )}
    >
      {/* Debug Panel */}
      {showDebug && <DebugPanel />}
      
      {/* Toggle Debug Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-40 h-6 w-6 opacity-30 hover:opacity-100"
        onClick={() => setShowDebug(!showDebug)}
      >
        <Bug className="h-3 w-3 text-white" />
      </Button>

      <video
        key={directUrl || hlsUrl || recordingId}
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        preload="auto"
        src={directUrl || undefined}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleVideoError}
        onWaiting={() => setIsBuffering(true)}
        onLoadStart={() => setIsBuffering(true)}
        onCanPlay={() => {
          setIsReady(true);
          setIsBuffering(false);
        }}
        onCanPlayThrough={() => setIsBuffering(false)}
        onPlaying={() => setIsBuffering(false)}
        onProgress={(e) => {
          const video = e.currentTarget;
          if (video.buffered.length > 0 && video.duration > 0) {
            const buffered = video.buffered.end(video.buffered.length - 1);
            setLoadProgress((buffered / video.duration) * 100);
          }
        }}
        onEnded={() => {
          onComplete?.();
          updateProgress.mutate({
            recordingId,
            progressSeconds: Math.floor(duration),
            progressPercent: 100,
            completed: true,
          });
        }}
      />
      
      {/* Buffering indicator with detailed progress */}
      {isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
          <Loader2 className="h-16 w-16 text-white animate-spin" />
          <span className="text-white text-base mt-3 font-medium">
            {loadProgress > 0 ? `Buffering... ${Math.round(loadProgress)}%` : 'Loading video...'}
          </span>
          {loadProgress > 0 && (
            <div className="w-48 h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          )}
          <span className="text-white/60 text-xs mt-2">
            {directUrl ? 'Direct playback' : 'Adaptive streaming'}
          </span>
        </div>
      )}
      
      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <h3 className="text-white font-medium truncate">{title}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-black/50 text-white">
              <Wifi className="h-3 w-3 mr-1" />
              {networkQuality.connectionType}
            </Badge>
            <Badge variant="secondary" className="bg-black/50 text-white">
              {currentQuality}
            </Badge>
          </div>
        </div>
        
        {/* Center play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-16 w-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>
        </div>
        
        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress bar */}
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          
          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handlePlayPause}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={skipBackward}
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={skipForward}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center gap-2 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => {
                    setIsMuted(!isMuted);
                    if (videoRef.current) {
                      videoRef.current.muted = !isMuted;
                    }
                  }}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>
              
              <span className="text-white text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {showDownloadButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={onDownloadRequest}
                >
                  <Download className="h-5 w-5" />
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background">
                  <DropdownMenuItem
                    onClick={() => handleQualityChange('auto')}
                    className={selectedQuality === 'auto' ? 'bg-accent' : ''}
                  >
                    Auto ({networkQuality.recommendedQuality})
                  </DropdownMenuItem>
                  {availableQualities.map((q) => (
                    <DropdownMenuItem
                      key={q}
                      onClick={() => handleQualityChange(q)}
                      className={selectedQuality === q ? 'bg-accent' : ''}
                    >
                      {q}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleFullscreen}
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
