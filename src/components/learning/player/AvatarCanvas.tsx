import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { processChromaKey, erodeGreenEdges } from './utils/chromaKey';

interface AvatarCanvasProps {
  videoSrc?: string;
  isPlaying: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
  onCanPlay?: () => void;
  className?: string;
}

const FRAME_INTERVAL = 1000 / 30;

export const AvatarCanvas = ({
  videoSrc,
  isPlaying,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onCanPlay,
  className,
}: AvatarCanvasProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const processingRef = useRef<boolean>(false);

  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const mainCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [isVideoReady, setIsVideoReady] = useState(false);

  const renderFrame = useCallback((timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    animationRef.current = requestAnimationFrame(renderFrame);

    if (timestamp - lastFrameTimeRef.current < FRAME_INTERVAL) return;
    if (processingRef.current) return;
    processingRef.current = true;
    lastFrameTimeRef.current = timestamp;

    // CPU chroma key at 1/2 resolution
    if (!mainCtxRef.current) {
      mainCtxRef.current = canvas.getContext('2d', { willReadFrequently: true });
    }
    const ctx = mainCtxRef.current;
    if (!ctx) { processingRef.current = false; return; }

    const fullW = video.videoWidth || 640;
    const fullH = video.videoHeight || 480;
    const procW = (fullW / 2 + 0.5) | 0;
    const procH = (fullH / 2 + 0.5) | 0;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offCtxRef.current = null;
    }
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== procW || offscreen.height !== procH) {
      offscreen.width = procW;
      offscreen.height = procH;
      offCtxRef.current = null;
    }
    if (!offCtxRef.current) {
      offCtxRef.current = offscreen.getContext('2d', { willReadFrequently: true });
    }
    const offCtx = offCtxRef.current;
    if (!offCtx) { processingRef.current = false; return; }

    if (canvas.width !== fullW || canvas.height !== fullH) {
      canvas.width = fullW;
      canvas.height = fullH;
      mainCtxRef.current = canvas.getContext('2d', { willReadFrequently: true });
    }

    offCtx.drawImage(video, 0, 0, procW, procH);
    const imageData = offCtx.getImageData(0, 0, procW, procH);
    processChromaKey(imageData.data);
    erodeGreenEdges(imageData.data, procW, procH);
    offCtx.putImageData(imageData, 0, 0);

    const mainCtx = mainCtxRef.current || ctx;
    mainCtx.clearRect(0, 0, fullW, fullH);
    mainCtx.drawImage(offscreen, 0, 0, fullW, fullH);

    processingRef.current = false;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (isPlaying && isVideoReady) {
      video.play().catch(console.error);
      animationRef.current = requestAnimationFrame(renderFrame);
    } else {
      video.pause();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, isVideoReady, videoSrc, renderFrame]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) onDurationChange?.(video.duration);
  }, [onDurationChange]);

  const handleCanPlay = useCallback(() => {
    setIsVideoReady(true);
    onCanPlay?.();
  }, [onCanPlay]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) onTimeUpdate?.(video.currentTime);
  }, [onTimeUpdate]);

  const handleEnded = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    onEnded?.();
  }, [onEnded]);

  useEffect(() => {
    setIsVideoReady(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    processingRef.current = false;
    lastFrameTimeRef.current = 0;
    offscreenCanvasRef.current = null;
    offCtxRef.current = null;
    mainCtxRef.current = null;
  }, [videoSrc]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = time;
  }, []);

  const getCurrentTime = useCallback(() => videoRef.current?.currentTime || 0, []);
  const getDuration = useCallback(() => videoRef.current?.duration || 0, []);

  return (
    <div className={cn("avatar-canvas-container", className)}>
      <video
        ref={videoRef}
        className="avatar-video-source"
        src={videoSrc}
        playsInline
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <canvas ref={canvasRef} className="avatar-canvas" />
    </div>
  );
};

export interface AvatarCanvasHandle {
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}
