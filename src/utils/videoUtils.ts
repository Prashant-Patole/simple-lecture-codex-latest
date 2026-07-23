/**
 * Extracts YouTube video ID from various URL formats
 */
export const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  
  // Handle various YouTube URL formats:
  // - youtube.com/watch?v=VIDEO_ID
  // - youtu.be/VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - youtube.com/live/VIDEO_ID
  // - youtube.com/v/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
};

/**
 * Generates YouTube embed URL from video ID
 */
export const getYouTubeEmbedUrl = (videoId: string, autoplay = true): string => {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: autoplay ? '1' : '0', // Mute when autoplay (required by browsers)
    controls: '1', // Explicitly show controls
    rel: '0', // Don't show related videos
    enablejsapi: '1', // Enable JS API for postMessage commands
    modestbranding: '1', // Minimal YouTube branding
    iv_load_policy: '3', // Hide video annotations
    playsinline: '1', // Play inline on mobile
    fs: '1', // Allow fullscreen
    cc_load_policy: '0', // Don't show captions by default
    showinfo: '0', // Hide video title and uploader (deprecated but still works sometimes)
    vq: 'auto', // Auto quality selection
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

/**
 * Checks if a URL is a YouTube URL
 */
export const isYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/.test(url);
};
