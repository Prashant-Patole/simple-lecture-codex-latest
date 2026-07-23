import { PresentationSection } from '../types';
import { getAdminMediaUrl, getCdnMediaUrl } from '../utils/mediaResolver';

interface IntroSectionProps {
  section: PresentationSection;
  presentationTitle: string;
  jobId: string;
  serverIp: string;
  cdnBaseUrl?: string | null;
}

export const IntroSection = ({
  section,
  presentationTitle,
  jobId,
  serverIp,
  cdnBaseUrl,
}: IntroSectionProps) => {
  // Get intro background video if available
  const introBackgroundVideo = section.intro_background_video;
  
  // Helper to get media URL - uses CDN if cdnBaseUrl is provided, otherwise uses proxy
  const getMediaUrlWithServer = (path: string) => {
    if (cdnBaseUrl) {
      return getCdnMediaUrl(jobId, path, cdnBaseUrl);
    }
    return getAdminMediaUrl(jobId, path, serverIp);
  };
  
  return (
    <div className="intro-container">
      {/* Background Video (looping, muted) */}
      {introBackgroundVideo && (
        <video
          className="intro-background-video"
          src={getMediaUrlWithServer(`videos/${introBackgroundVideo}`)}
          autoPlay
          loop
          muted
          playsInline
        />
      )}

      {/* Main Title */}
      <h1 className="intro-title">
        {presentationTitle}
      </h1>

      {/* Section Subtitle */}
      <h2 className="intro-subtitle">
        {section.title}
      </h2>

      {/* Narration Preview (if available) */}
      {section.narration?.full_text && (
        <p className="intro-description">
          {section.narration.full_text.slice(0, 300)}
          {section.narration.full_text.length > 300 ? '...' : ''}
        </p>
      )}
    </div>
  );
};
