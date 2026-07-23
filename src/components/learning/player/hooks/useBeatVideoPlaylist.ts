import { useState, useCallback, useRef, useEffect } from 'react';
import { NarrationSegment } from '../types';

interface BeatVideoEntry {
  videoPath: string | null;
  startTime: number;
  endTime: number;
  segmentIndex: number;
  hasVideo: boolean;
}

interface UseBeatVideoPlaylistOptions {
  segments: NarrationSegment[];
  getMediaUrl: (path: string) => string;
  onVideoChange?: (videoPath: string | null) => void;
}

interface UseBeatVideoPlaylistReturn {
  playlist: BeatVideoEntry[];
  currentVideoIndex: number;
  currentVideoPath: string | null;
  hasActiveVideo: boolean;
  checkVideoSwitch: (currentTime: number) => void;
  preloadNextVideo: () => void;
  getVideoForTime: (time: number) => string | null;
}

export const useBeatVideoPlaylist = ({
  segments,
  getMediaUrl,
  onVideoChange,
}: UseBeatVideoPlaylistOptions): UseBeatVideoPlaylistReturn => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(-1);
  const [currentVideoPath, setCurrentVideoPath] = useState<string | null>(null);
  const playlistRef = useRef<BeatVideoEntry[]>([]);
  const preloadedVideos = useRef<Set<string>>(new Set());

  // Build playlist from segments
  useEffect(() => {
    let cumulativeTime = 0;
    const entries: BeatVideoEntry[] = [];

    segments.forEach((segment, index) => {
      const duration = segment.duration_seconds || 5;
      const beatVideos = segment.beat_videos || [];
      const videoPath = beatVideos.length > 0 ? beatVideos[0] : null;

      entries.push({
        videoPath,
        startTime: cumulativeTime,
        endTime: cumulativeTime + duration,
        segmentIndex: index,
        hasVideo: !!videoPath,
      });

      cumulativeTime += duration;
    });

    playlistRef.current = entries;
  }, [segments]);

  // Check if we need to switch videos based on current time
  const checkVideoSwitch = useCallback((currentTime: number) => {
    const playlist = playlistRef.current;
    
    for (let i = 0; i < playlist.length; i++) {
      const entry = playlist[i];
      if (currentTime >= entry.startTime && currentTime < entry.endTime) {
        if (i !== currentVideoIndex) {
          setCurrentVideoIndex(i);
          const newPath = entry.videoPath ? getMediaUrl(entry.videoPath) : null;
          setCurrentVideoPath(newPath);
          onVideoChange?.(newPath);
        }
        break;
      }
    }
  }, [currentVideoIndex, getMediaUrl, onVideoChange]);

  // Preload next video in playlist
  const preloadNextVideo = useCallback(() => {
    const playlist = playlistRef.current;
    const nextIndex = currentVideoIndex + 1;

    if (nextIndex < playlist.length) {
      const nextEntry = playlist[nextIndex];
      if (nextEntry.videoPath && !preloadedVideos.current.has(nextEntry.videoPath)) {
        const video = document.createElement('video');
        video.src = getMediaUrl(nextEntry.videoPath);
        video.preload = 'auto';
        preloadedVideos.current.add(nextEntry.videoPath);
      }
    }
  }, [currentVideoIndex, getMediaUrl]);

  // Get video for specific time
  const getVideoForTime = useCallback((time: number): string | null => {
    const playlist = playlistRef.current;
    
    for (const entry of playlist) {
      if (time >= entry.startTime && time < entry.endTime) {
        return entry.videoPath ? getMediaUrl(entry.videoPath) : null;
      }
    }
    
    return null;
  }, [getMediaUrl]);

  // Check if there's an active video at current index
  const hasActiveVideo = currentVideoPath !== null;

  return {
    playlist: playlistRef.current,
    currentVideoIndex,
    currentVideoPath,
    hasActiveVideo,
    checkVideoSwitch,
    preloadNextVideo,
    getVideoForTime,
  };
};
