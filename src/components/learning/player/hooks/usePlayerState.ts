import { useState, useCallback, useRef, useEffect } from 'react';
import { PresentationSection, VisualBeat } from '../types';
import { useTimerFallback } from './useTimerFallback';

// Helper function to get revealed beats (used for initial state)
const getRevealedBeatsForTime = (
  time: number, 
  section: PresentationSection | null,
  timings: { segmentId: string; startTime: number }[],
  totalDuration: number
): number[] => {
  if (!section) return [];
  
  const rawBeats = [
    ...(section.visual_beats || []),
    ...(section.explanation_plan?.visual_beats || []),
  ];
  const beats: VisualBeat[] = [];
  const seenIds = new Set<string>();
  for (const beat of rawBeats) {
    if (!seenIds.has(beat.beat_id)) {
      beats.push(beat);
      seenIds.add(beat.beat_id);
    }
  }

  // Fallback: create beats from narration segments (matches ContentSection)
  if (beats.length === 0 && section.narration?.segments) {
    section.narration.segments.forEach((seg: any, index: number) => {
      if (seg.text && seg.text.trim()) {
        beats.push({
          beat_id: `narration-${index}`,
          visual_type: 'text',
          display_text: seg.text,
          segment_id: seg.segment_id,
        });
      }
    });
  }

  if (beats.length === 0) return [];
  
  const revealed: number[] = [];
  
  for (let beatIndex = 0; beatIndex < beats.length; beatIndex++) {
    const beat = beats[beatIndex];
    let shouldReveal = false;

    // Strategy 1: Use beat.start_time if available
    if (beat.start_time !== undefined && beat.start_time !== null) {
      shouldReveal = time >= beat.start_time;
    }
    // Strategy 2: Match segment_id
    else if (beat.segment_id) {
      const segmentTiming = timings.find(t => t.segmentId === beat.segment_id);
      if (segmentTiming) {
        shouldReveal = time >= segmentTiming.startTime;
      }
    }
    // Strategy 3: Distribute evenly across 70% of duration
    else {
      const teachDuration = totalDuration * 0.7;
      const beatInterval = teachDuration / Math.max(1, beats.length);
      const beatStartTime = beatIndex * beatInterval;
      shouldReveal = time >= beatStartTime;
    }

    if (shouldReveal) {
      revealed.push(beatIndex);
    }
  }
  
  return revealed;
};

interface PlayerState {
  currentSectionIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  revealedBeatIndices: number[];
  currentSegmentIndex: number;
  isVideoLayerVisible: boolean;
  isAvatarReady: boolean;
  useTimerMode: boolean;
}

interface UsePlayerStateOptions {
  section: PresentationSection | null;
  onSectionEnd?: () => void;
  onTimeUpdate?: (time: number) => void;
}

interface SegmentTiming {
  segmentId: string;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export const usePlayerState = ({ section, onSectionEnd, onTimeUpdate }: UsePlayerStateOptions) => {
  // === ALL REFS FIRST (stable order) ===
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const useTimerModeRef = useRef(true); // Tracks useTimerMode without stale closures
  const activeTimeSourceRef = useRef<'avatar' | 'timer'>('timer'); // Single authority for time
  const segmentTimingsRef = useRef<SegmentTiming[]>([]);
  const totalDurationRef = useRef(0);
  const avatarActualDurationRef = useRef(0); // Real MP4 duration for normalization
  
  // === ALL STATE NEXT ===
  const [state, setState] = useState<PlayerState>({
    currentSectionIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    revealedBeatIndices: [],
    currentSegmentIndex: 0,
    isVideoLayerVisible: false,
    isAvatarReady: false,
    useTimerMode: true,
  });

  const [durationState, setDurationState] = useState(0);

  // === EFFECTS AFTER STATE ===
  // Keep refs in sync with state to avoid stale closures in event handlers
  useEffect(() => {
    useTimerModeRef.current = state.useTimerMode;
    activeTimeSourceRef.current = state.useTimerMode ? 'timer' : 'avatar';
  }, [state.useTimerMode]);

  // Build timing map when section changes
  useEffect(() => {
    // Check for narration object first
    if (!section?.narration) {
      console.log('[TIMING] No narration data');
      segmentTimingsRef.current = [];
      totalDurationRef.current = 0;
      setDurationState(0);
      return;
    }

    // Fallback if segments missing but total_duration_seconds exists
    if (!section.narration.segments || section.narration.segments.length === 0) {
      console.log('[TIMING] No segments, checking for total_duration_seconds fallback');
      
      const fallbackDuration = section.narration.total_duration_seconds || 30;
      console.log('[TIMING] Using fallback duration:', fallbackDuration);
      
      segmentTimingsRef.current = [{
        segmentId: 'fallback',
        index: 0,
        startTime: 0,
        endTime: fallbackDuration,
        duration: fallbackDuration,
      }];
      totalDurationRef.current = fallbackDuration;
      setDurationState(fallbackDuration);
      
      setState(prev => ({
        ...prev,
        duration: fallbackDuration,
      }));
      return;
    }

    // Normal segment processing
    let cumulativeTime = 0;
    const timings: SegmentTiming[] = [];

    section.narration.segments.forEach((segment, index) => {
      const duration = segment.duration_seconds || 5;
      console.log(`[TIMING] Segment ${index}: ${duration}s`);
      timings.push({
        segmentId: segment.segment_id,
        index,
        startTime: cumulativeTime,
        endTime: cumulativeTime + duration,
        duration,
      });
      cumulativeTime += duration;
    });

    console.log(`[TIMING] Total duration calculated: ${cumulativeTime}s`);

    segmentTimingsRef.current = timings;
    totalDurationRef.current = cumulativeTime;

    // Calculate initial revealed beats at time=0
    const initialRevealed = getRevealedBeatsForTime(0, section, timings, cumulativeTime);

    // Update reactive duration state for timer fallback FIRST
    setDurationState(cumulativeTime);

    setState(prev => ({
      ...prev,
      duration: cumulativeTime,
      revealedBeatIndices: initialRevealed,
    }));
  }, [section]);

  // Timer fallback for when no avatar video
  // CRITICAL: Gate by ref (activeTimeSourceRef) not state to avoid race conditions
  const timerFallback = useTimerFallback({
    duration: durationState,
    onTimeUpdate: (time) => {
      // Only update if timer is the active time source
      if (activeTimeSourceRef.current === 'timer') {
        updateState(time);
      }
    },
    onEnded: () => {
      // Only trigger section end if timer is the active time source
      if (activeTimeSourceRef.current === 'timer') {
        console.log('[TIMER] Section ended via timer fallback');
        setState(prev => ({ ...prev, isPlaying: false }));
        onSectionEnd?.();
      }
    },
  });

  // Force timer sync when duration changes - only runs once when duration becomes valid
  useEffect(() => {
    if (durationState > 0) {
      console.log('[SYNC] Duration updated to:', durationState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationState]);

  // Get all beats from section
  const getAllBeats = useCallback((): VisualBeat[] => {
    if (!section) return [];
    const rawBeats = [
      ...(section.visual_beats || []),
      ...(section.explanation_plan?.visual_beats || []),
    ];
    const beats: VisualBeat[] = [];
    const seenIds = new Set<string>();
    for (const beat of rawBeats) {
      if (!seenIds.has(beat.beat_id)) {
        beats.push(beat);
        seenIds.add(beat.beat_id);
      }
    }

    // Fallback: create beats from narration segments (matches ContentSection)
    if (beats.length === 0 && section.narration?.segments) {
      section.narration.segments.forEach((seg: any, index: number) => {
        if (seg.text && seg.text.trim()) {
          beats.push({
            beat_id: `narration-${index}`,
            visual_type: 'text',
            display_text: seg.text,
            segment_id: seg.segment_id,
          });
        }
      });
    }

    return beats;
  }, [section]);

  // Get current segment index from time
  const getCurrentSegmentIndex = useCallback((time: number): number => {
    const timings = segmentTimingsRef.current;
    for (let i = 0; i < timings.length; i++) {
      if (time >= timings[i].startTime && time < timings[i].endTime) {
        return i;
      }
    }
    return Math.max(0, timings.length - 1);
  }, []);

  // Get display directives from current segment
  const getDisplayDirectives = useCallback((time: number) => {
    const segmentIndex = getCurrentSegmentIndex(time);
    const segments = section?.narration?.segments || [];
    const segment = segments[segmentIndex];
    
    const directives = segment?.display_directives || {};
    const rawVisualLayer = directives.visual_layer as 'show' | 'hide' | 'teach' | string | undefined;
    const hasBeatVideo = !!segment?.beat_videos?.[0];
    const visualLayer = rawVisualLayer === 'teach'
      ? 'hide'
      : (rawVisualLayer === 'show' || hasBeatVideo ? 'show' : 'hide');
    
    return {
      textLayer: (directives.text_layer as 'show' | 'hide') || 'show',
      visualLayer,
      rawVisualLayer: rawVisualLayer || 'hide',
      hasBeatVideo,
    };
  }, [section, getCurrentSegmentIndex]);

  // Get revealed beat indices based on time
  const getRevealedBeats = useCallback((time: number): number[] => {
    const beats = getAllBeats();
    const timings = segmentTimingsRef.current;
    const revealed: number[] = [];

    if (beats.length === 0 || timings.length === 0) return [];

    for (let beatIndex = 0; beatIndex < beats.length; beatIndex++) {
      const beat = beats[beatIndex];
      let shouldReveal = false;

      // Strategy 1: Use beat.start_time if available
      if (beat.start_time !== undefined && beat.start_time !== null) {
        shouldReveal = time >= beat.start_time;
      }
      // Strategy 2: Match segment_id
      else if (beat.segment_id) {
        const segmentTiming = timings.find(t => t.segmentId === beat.segment_id);
        if (segmentTiming) {
          shouldReveal = time >= segmentTiming.startTime;
        }
      }
      // Strategy 3: Distribute evenly across 70% of duration
      else {
        const teachDuration = totalDurationRef.current * 0.7;
        const beatInterval = teachDuration / Math.max(1, beats.length);
        const beatStartTime = beatIndex * beatInterval;
        shouldReveal = time >= beatStartTime;
      }

      if (shouldReveal) {
        revealed.push(beatIndex);
      }
    }

    return revealed;
  }, [getAllBeats]);

  // Update state based on current time
  const updateState = useCallback((time: number) => {
    const segmentIndex = getCurrentSegmentIndex(time);
    const directives = getDisplayDirectives(time);
    const revealed = getRevealedBeats(time);

    if (Math.floor(time) !== Math.floor(time - 0.1)) {
      console.log('[UPDATE]', {
        time: time.toFixed(2),
        segmentIndex,
        revealedBeats: revealed.length,
        videoVisible: directives.visualLayer === 'show'
      });
      if (directives.hasBeatVideo && directives.rawVisualLayer !== 'show') {
        console.warn('[BEAT STATE]', {
          time: time.toFixed(2),
          segmentIndex,
          rawVisualLayer: directives.rawVisualLayer,
          correctedVideoVisible: directives.visualLayer === 'show',
          reason: directives.rawVisualLayer === 'teach' ? 'explicit-teach-hide' : 'beat-video-overrides-visual-layer',
        });
      }
    }

    setState(prev => ({
      ...prev,
      currentTime: time,
      currentSegmentIndex: segmentIndex,
      revealedBeatIndices: revealed,
      isVideoLayerVisible: directives.visualLayer === 'show',
    }));

    onTimeUpdate?.(time);
  }, [getCurrentSegmentIndex, getDisplayDirectives, getRevealedBeats, onTimeUpdate]);

  // Handle avatar video time update
  // CRITICAL FIX: Use refs instead of state to avoid stale closure problems
  // Event listeners capture this callback, but refs always have current value
  const handleAvatarTimeUpdate = useCallback(() => {
    const video = avatarVideoRef.current;
    if (!video || video.paused) return;
    
    // Ensure we're using avatar as time source when it's actively playing
    if (activeTimeSourceRef.current !== 'avatar') {
      console.log('[AVATAR] Switching to avatar as active time source');
      activeTimeSourceRef.current = 'avatar';
      setState(prev => ({ ...prev, useTimerMode: false, isAvatarReady: true }));
    }
    
    // Normalize avatar time to JSON timeline to keep beats in sync
    const avatarDuration = avatarActualDurationRef.current;
    const jsonDuration = totalDurationRef.current;
    
    if (avatarDuration > 0 && jsonDuration > 0 && avatarDuration !== jsonDuration) {
      const ratio = video.currentTime / avatarDuration;
      const normalizedTime = ratio * jsonDuration;
      updateState(normalizedTime);
    } else {
      updateState(video.currentTime);
    }
  }, [updateState]);

  // Handle avatar video ended — snap to full JSON duration so all beats are revealed
  // NOTE: Inlined state update to avoid depending on updateState (prevents callback identity cascade)
  const handleAvatarEnded = useCallback(() => {
    const jsonDuration = totalDurationRef.current;
    console.warn('[BEAT-STRICT][PLAYER_STATE_FALSE] source=avatar-ended', {
      currentTime: state.currentTime,
      jsonDuration,
      avatarTime: avatarVideoRef.current?.currentTime,
      avatarDuration: avatarVideoRef.current?.duration,
      useTimerMode: state.useTimerMode,
    });
    setState(prev => ({
      ...prev,
      isPlaying: false,
      currentTime: jsonDuration > 0 ? jsonDuration : prev.currentTime,
    }));
    onSectionEnd?.();
  }, [onSectionEnd, state.currentTime, state.useTimerMode]);

  // Handle avatar can play
  const handleAvatarCanPlay = useCallback(() => {
    const video = avatarVideoRef.current;
    const videoDuration = video?.duration;
    const hasValidDuration = videoDuration && videoDuration > 0 && isFinite(videoDuration);
    
    console.log('[SWITCH-HOOK] canplay handler fired, video duration:', videoDuration, 'JSON duration:', totalDurationRef.current);
    
    // Store actual MP4 duration for normalization, but keep state.duration as JSON total
    if (hasValidDuration) {
      avatarActualDurationRef.current = videoDuration;
    }
    
    setState(prev => ({
      ...prev,
      isAvatarReady: true,
      useTimerMode: false,
      // Keep JSON duration as the canonical timeline — do NOT override with video duration
      duration: totalDurationRef.current > 0 ? totalDurationRef.current : (hasValidDuration ? videoDuration : prev.duration),
    }));
  }, []);

  // Handle avatar error - switch to timer mode
  const handleAvatarError = useCallback(() => {
    console.log('[AVATAR] Error detected, switching to timer mode');
    activeTimeSourceRef.current = 'timer';
    setState(prev => ({
      ...prev,
      useTimerMode: true,
      isAvatarReady: false,
    }));
  }, []);

  // Play control
  const play = useCallback(() => {
    console.log('[SWITCH-HOOK] play() called', {
      useTimerMode: state.useTimerMode,
      activeTimeSource: activeTimeSourceRef.current,
      durationState,
      currentTime: state.currentTime,
      avatarReadyState: avatarVideoRef.current?.readyState,
      avatarHasError: !!avatarVideoRef.current?.error,
    });
    console.log('[BEAT-STRICT][PLAYER_PLAY_CALL]', {
      currentTime: state.currentTime,
      useTimerMode: state.useTimerMode,
      activeTimeSource: activeTimeSourceRef.current,
      avatarPaused: avatarVideoRef.current?.paused,
      avatarReadyState: avatarVideoRef.current?.readyState,
    });
    
    // If avatar video exists, check its state
    if (avatarVideoRef.current) {
      const video = avatarVideoRef.current;
      
      // If avatar has an error, fall back to timer immediately
      if (video.error) {
        console.log('[PLAY] Avatar has error, using timer fallback');
        activeTimeSourceRef.current = 'timer';
        timerFallback.play();
      } else if (video.readyState >= 2) {
        console.log('[PLAY] Using avatar video (readyState:', video.readyState, ')');
        
        // CRITICAL: Stop timer fallback before starting avatar
        timerFallback.pause();
        activeTimeSourceRef.current = 'avatar';
        setState(prev => ({ ...prev, useTimerMode: false, isAvatarReady: true }));
        
        video.play().catch(err => {
          console.warn('[PLAY] Avatar play failed:', err);
          // Fall back to timer on play error
          activeTimeSourceRef.current = 'timer';
          setState(prev => ({ ...prev, useTimerMode: true }));
          timerFallback.play();
        });
      } else {
        console.log('[PLAY] Avatar not ready yet, waiting... (readyState:', video.readyState, ')');
        // Just set isPlaying true - the canplay event will trigger actual playback
      }
    } else if (durationState > 0) {
      // No avatar video - use timer fallback
      console.log('[PLAY] Using timer fallback (no avatar)');
      activeTimeSourceRef.current = 'timer';
      timerFallback.play();
    }
    
    setState(prev => ({ ...prev, isPlaying: true }));
  }, [state.useTimerMode, state.currentTime, durationState, timerFallback]);

  // Pause control
  const pause = useCallback(() => {
    console.warn('[BEAT-STRICT][PLAYER_PAUSE_CALL]', {
      currentTime: state.currentTime,
      stateIsPlaying: state.isPlaying,
      useTimerMode: state.useTimerMode,
      activeTimeSource: activeTimeSourceRef.current,
      avatarPaused: avatarVideoRef.current?.paused,
      avatarReadyState: avatarVideoRef.current?.readyState,
      stack: new Error().stack?.split('\n').slice(1, 7).join('\n'),
    });
    if (state.useTimerMode) {
      timerFallback.pause();
    } else if (avatarVideoRef.current) {
      avatarVideoRef.current.pause();
    }
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [state.currentTime, state.isPlaying, state.useTimerMode, timerFallback]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  // Seek to specific time (clampedTime is in JSON-time space)
  const seek = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, state.duration));
    console.log('[BEAT-STRICT][PLAYER_SEEK]', {
      from: state.currentTime,
      to: clampedTime,
      stateIsPlaying: state.isPlaying,
      useTimerMode: state.useTimerMode,
      activeTimeSource: activeTimeSourceRef.current,
      avatarPausedBefore: avatarVideoRef.current?.paused,
      avatarTimeBefore: avatarVideoRef.current?.currentTime,
    });
    
    if (state.useTimerMode) {
      timerFallback.seek(clampedTime);
    } else if (avatarVideoRef.current) {
      // Reverse-map from JSON time to avatar time
      const avatarDuration = avatarActualDurationRef.current;
      const jsonDuration = totalDurationRef.current;
      if (avatarDuration > 0 && jsonDuration > 0 && avatarDuration !== jsonDuration) {
        avatarVideoRef.current.currentTime = (clampedTime / jsonDuration) * avatarDuration;
      } else {
        avatarVideoRef.current.currentTime = clampedTime;
      }
    }
    
    updateState(clampedTime);
    console.log('[BEAT-STRICT][PLAYER_SEEK_DONE]', {
      to: clampedTime,
      stateIsPlaying: state.isPlaying,
      avatarPausedAfter: avatarVideoRef.current?.paused,
      avatarTimeAfter: avatarVideoRef.current?.currentTime,
    });
  }, [state.currentTime, state.duration, state.isPlaying, state.useTimerMode, timerFallback, updateState]);

  // Reset player state
  const reset = useCallback(() => {
    console.log('[SWITCH-HOOK] reset() called');
    if (avatarVideoRef.current) {
      avatarVideoRef.current.pause();
      avatarVideoRef.current.currentTime = 0;
    }
    timerFallback.reset(totalDurationRef.current);
    activeTimeSourceRef.current = 'timer'; // Reset to timer mode
    
    setState({
      currentSectionIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: totalDurationRef.current,
      revealedBeatIndices: [],
      currentSegmentIndex: 0,
      isVideoLayerVisible: false,
      isAvatarReady: false,
      useTimerMode: true,
    });
  }, [timerFallback]);

  // Set avatar video ref
  const setAvatarVideoRef = useCallback((element: HTMLVideoElement | null) => {
    if (avatarVideoRef.current) {
      avatarVideoRef.current.removeEventListener('timeupdate', handleAvatarTimeUpdate);
      avatarVideoRef.current.removeEventListener('ended', handleAvatarEnded);
      avatarVideoRef.current.removeEventListener('canplay', handleAvatarCanPlay);
      avatarVideoRef.current.removeEventListener('error', handleAvatarError);
    }
    
    avatarVideoRef.current = element;
    
    if (element) {
      element.addEventListener('timeupdate', handleAvatarTimeUpdate);
      element.addEventListener('ended', handleAvatarEnded);
      element.addEventListener('canplay', handleAvatarCanPlay);
      element.addEventListener('error', handleAvatarError);
    }
  }, [handleAvatarTimeUpdate, handleAvatarEnded, handleAvatarCanPlay, handleAvatarError]);

  // SAFETY: Rebind listeners when handler identities change (e.g., section changes)
  const rebindCountRef = useRef(0);
  useEffect(() => {
    const video = avatarVideoRef.current;
    if (!video) return;
    
    rebindCountRef.current++;
    // Only log every 5th rebind to reduce noise
    if (rebindCountRef.current <= 2 || rebindCountRef.current % 5 === 0) {
      console.log(`[REBIND] Re-attached avatar event listeners (count: ${rebindCountRef.current})`);
    }
    
    video.addEventListener('timeupdate', handleAvatarTimeUpdate);
    video.addEventListener('ended', handleAvatarEnded);
    video.addEventListener('canplay', handleAvatarCanPlay);
    video.addEventListener('error', handleAvatarError);
    
    return () => {
      video.removeEventListener('timeupdate', handleAvatarTimeUpdate);
      video.removeEventListener('ended', handleAvatarEnded);
      video.removeEventListener('canplay', handleAvatarCanPlay);
      video.removeEventListener('error', handleAvatarError);
    };
  }, [handleAvatarTimeUpdate, handleAvatarEnded, handleAvatarCanPlay, handleAvatarError]);

  // Force timer mode when no avatar is available (detected externally via avatarLoadFailed)
  const forceTimerMode = useCallback(() => {
    console.log('[PLAYER] Forcing timer mode - no avatar available');
    activeTimeSourceRef.current = 'timer';
    setState(prev => ({
      ...prev,
      useTimerMode: true,
      isAvatarReady: false,
    }));
  }, []);

  return {
    state,
    segmentTimings: segmentTimingsRef.current,
    totalDuration: totalDurationRef.current,
    setAvatarVideoRef,
    play,
    pause,
    togglePlayPause,
    seek,
    reset,
    getCurrentSegmentIndex,
    getDisplayDirectives: () => getDisplayDirectives(state.currentTime),
    getAllBeats,
    forceTimerMode,
  };
};
