import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Languages, LoaderCircle, Play } from 'lucide-react';
import type { V5Language, V5Presentation, V5SubtitleData } from './types';
import {
  buildSectionTimeline,
  getMergedVideoCandidates,
  getPresentationUrl,
  getSubtitlesUrl,
  getTimelinePosition,
  hasMergedVideo,
} from './utils';
import { V5Controls } from './V5Controls';
import { V5KeyPoints } from './V5KeyPoints';
import './v5-player.css';

interface V5PlayerProps {
  jobId: string;
  initialLanguage?: V5Language;
  onExit: () => void;
  onLanguageChange?: (language: V5Language) => void;
}

export function V5Player({
  jobId,
  initialLanguage = 'english',
  onExit,
  onLanguageChange,
}: V5PlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingPositionRef = useRef<{ ratio: number; resume: boolean } | null>(null);
  const [presentation, setPresentation] = useState<V5Presentation | null>(null);
  const [subtitleData, setSubtitleData] = useState<V5SubtitleData | null>(null);
  const [language, setLanguage] = useState<V5Language>(initialLanguage);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [needsTap, setNeedsTap] = useState(false);
  const [keyPointsHidden, setKeyPointsHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setPresentation(null);
    setSubtitleData(null);

    Promise.all([
      fetch(getPresentationUrl(jobId)).then(async (response) => {
        if (!response.ok) throw new Error(`Presentation request failed (${response.status})`);
        return response.json() as Promise<V5Presentation>;
      }),
      fetch(getSubtitlesUrl(jobId))
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ])
      .then(([nextPresentation, nextSubtitles]) => {
        if (cancelled) return;
        if (!Array.isArray(nextPresentation.sections) || nextPresentation.sections.length === 0) {
          throw new Error('This job has no presentation sections.');
        }
        setPresentation(nextPresentation);
        setSubtitleData(nextSubtitles);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load V5 presentation.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const timeline = useMemo(
    () => buildSectionTimeline(presentation?.sections || [], subtitleData),
    [presentation, subtitleData],
  );
  const sources = useMemo(
    () => (presentation ? getMergedVideoCandidates(presentation, jobId, language) : []),
    [presentation, jobId, language],
  );
  const source = sources[sourceIndex] || '';
  const position = useMemo(
    () => getTimelinePosition(timeline, currentTime, duration),
    [timeline, currentTime, duration],
  );

  useEffect(() => {
    setSourceIndex(0);
  }, [language]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setNeedsTap(false);
      }).catch(() => setNeedsTap(true));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const selectLanguage = useCallback((nextLanguage: V5Language) => {
    if (nextLanguage === language) return;
    const video = videoRef.current;
    pendingPositionRef.current = {
      ratio: video?.duration ? video.currentTime / video.duration : 0,
      resume: Boolean(video && !video.paused),
    };
    setIsPlaying(false);
    setLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);
  }, [language, onLanguageChange]);

  const handleMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    video.playbackRate = playbackRate;

    const pending = pendingPositionRef.current;
    if (pending && video.duration) {
      video.currentTime = Math.min(video.duration - 0.05, pending.ratio * video.duration);
      pendingPositionRef.current = null;
      if (pending.resume) {
        video.play().then(() => setIsPlaying(true)).catch(() => setNeedsTap(true));
      }
      return;
    }

    if (video.paused) {
      video.play()
        .then(() => {
          setIsPlaying(true);
          setNeedsTap(false);
        })
        .catch(() => setNeedsTap(true));
    }
  }, [playbackRate]);

  if (isLoading) {
    return (
      <div className="v5-state">
        <LoaderCircle className="v5-state__spinner" size={44} />
        <strong>Preparing the merged presentation</strong>
        <span>Loading timeline and key points...</span>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="v5-state">
        <span className="v5-state__code">V5 / LOAD ERROR</span>
        <strong>{error || 'Presentation unavailable'}</strong>
        <button onClick={onExit} type="button">Choose another job</button>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="v5-state">
        <span className="v5-state__code">V5 / NO MERGED VIDEO</span>
        <strong>No {language} final presentation was found.</strong>
        <button onClick={onExit} type="button">Choose another job</button>
      </div>
    );
  }

  const title = presentation.presentation_title || presentation.title || 'V5 Presentation';
  const canUseKannada = hasMergedVideo(presentation, 'kannada');

  return (
    <div className="v5-player" ref={rootRef}>
      <header className="v5-header">
        <button className="v5-header__back" onClick={onExit} title="Choose another job" type="button">
          <ArrowLeft size={19} />
        </button>
        <div className="v5-header__identity">
          <span className="v5-header__version">V5 / MERGED LEARNING</span>
          <h1>{title}</h1>
        </div>
        <div className="v5-header__status">
          <span>{position.active?.section.title || 'Starting lesson'}</span>
          <span className="v5-header__renderer">
            {position.active?.section.renderer || 'merged'}
          </span>
        </div>
        <label className="v5-language">
          <Languages size={16} />
          <select
            aria-label="Presentation language"
            onChange={(event) => selectLanguage(event.target.value as V5Language)}
            value={language}
          >
            <option value="english">English</option>
            {canUseKannada && <option value="kannada">Kannada</option>}
          </select>
        </label>
      </header>

      <main className="v5-stage">
        <video
          autoPlay
          className="v5-video"
          key={`${language}-${sourceIndex}`}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            if (sourceIndex < sources.length - 1) {
              setSourceIndex((index) => index + 1);
              return;
            }
            setError(`The ${language} merged video could not be played.`);
          }}
          onLoadedMetadata={handleMetadata}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          playsInline
          ref={videoRef}
          src={source}
        />

        <div className="v5-stage__shade" />
        <V5KeyPoints
          active={position.active}
          isHidden={keyPointsHidden}
          onToggle={() => setKeyPointsHidden((hidden) => !hidden)}
          visibleCount={position.visibleCount}
        />

        {needsTap && (
          <button className="v5-tap" onClick={togglePlay} type="button">
            <span><Play size={30} fill="currentColor" /></span>
            Tap to start presentation
          </button>
        )}

        <div className="v5-section-progress" aria-hidden="true">
          {timeline.map((entry) => (
            <span
              className={entry.sectionIndex === position.active?.sectionIndex ? 'is-active' : ''}
              key={entry.section.section_id}
              style={{ flexGrow: entry.duration }}
            />
          ))}
        </div>
      </main>

      <V5Controls
        currentTime={currentTime}
        duration={duration}
        isFullscreen={isFullscreen}
        isMuted={isMuted}
        isPlaying={isPlaying}
        onRateChange={(rate) => {
          setPlaybackRate(rate);
          if (videoRef.current) videoRef.current.playbackRate = rate;
        }}
        onReplay={() => {
          if (!videoRef.current) return;
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => setNeedsTap(true));
        }}
        onSeek={(time) => {
          if (!videoRef.current) return;
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }}
        onToggleFullscreen={() => {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else rootRef.current?.requestFullscreen().catch(() => {});
        }}
        onToggleMute={() => {
          if (!videoRef.current) return;
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
        }}
        onTogglePlay={togglePlay}
        playbackRate={playbackRate}
      />
    </div>
  );
}
