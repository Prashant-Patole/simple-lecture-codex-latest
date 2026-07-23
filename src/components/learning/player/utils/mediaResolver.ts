// Media URL resolution utilities for the Educational Video Player

import { SUPABASE_URL as PROXY_URL } from '@/lib/supabaseUrl';

// Get Supabase URL - uses hardcoded proxy URL (ISP-safe)
const getSupabaseUrl = (): string => PROXY_URL;

/**
 * Get media URL using Supabase edge function proxy (CORS-safe)
 * This proxies through our edge function to avoid mixed content / CORS issues
 * @param jobId - The job identifier
 * @param path - The file path within the job
 * @param serverIp - Optional server IP to route requests to
 */
export const getAdminMediaUrl = (jobId: string, path: string, serverIp?: string): string => {
  if (!jobId || !path) return '';
  
  // Clean the path - remove leading slashes
  const cleanPath = path.replace(/^\/+/, '');
  
  // Use edge function proxy for CORS-safe media access
  const supabaseUrl = getSupabaseUrl();
  if (supabaseUrl) {
    const params = new URLSearchParams({
      action: 'media',
      job_id: jobId,
      file_path: cleanPath,
    });
    // Add server_ip if provided for dynamic routing
    if (serverIp) {
      params.set('server_ip', serverIp);
    }
    return `${supabaseUrl}/functions/v1/video-generation-proxy?${params}`;
  }
  
  // Fallback to CDN URL (avoids direct IP exposure)
  return `https://server1.simplelecture.com/video/${jobId}/${cleanPath}`;
};

/**
 * Get media URL for student access
 * Uses same proxy as admin for now
 * @param jobId - The job identifier
 * @param path - The file path within the job
 * @param serverIp - Optional server IP to route requests to
 */
export const getStudentMediaUrl = (jobId: string, path: string, serverIp?: string): string => {
  return getAdminMediaUrl(jobId, path, serverIp);
};

/**
 * Get audio file path from section data
 * Audio files are typically stored as audio/{section_id}.mp3
 */
export const getAudioPath = (sectionId: number): string => {
  return `audio/${sectionId}.mp3`;
};

/**
 * Get avatar video path from section data
 * Supports language-specific paths for multi-language avatars
 * 
 * Path patterns:
 * - English (default): avatars/section_{section_id}_avatar.mp4
 * - Multi-language: avatars/{language}/section_{section_id}_avatar.mp4
 * 
 * @param sectionId - The section identifier
 * @param language - Optional language code (e.g., 'hindi', 'tamil')
 */
export const getAvatarVideoPath = (sectionId: number, language?: string | null): string => {
  if (language && language.toLowerCase() !== 'english') {
    return `avatars/${language.toLowerCase()}/section_${sectionId}_avatar.mp4`;
  }
  return `avatars/section_${sectionId}_avatar.mp4`;
};

/**
 * Get image path from image_id
 * If the path already contains a slash, use as-is
 * Otherwise, prepend 'images/'
 */
export const getImagePath = (imageId: string | null | undefined): string => {
  if (!imageId) return '';
  // Normalize extension: server stores images as .png
  let normalized = imageId;
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    normalized = normalized.replace(/\.jpe?g$/, '.png');
  }
  if (normalized.includes('/')) return normalized;
  return `images/${normalized}`;
};

/**
 * Get beat video path
 * Beat videos are stored as videos/{video_name}
 */
export const getBeatVideoPath = (videoName: string): string => {
  if (!videoName) return '';
  if (videoName.includes('/')) return videoName;
  return `videos/${videoName}`;
};

/**
 * Resolve media path with type-aware folder prefixing
 * Handles Windows paths, absolute paths, and simple filenames
 */
export const resolveMediaPath = (path: string, type: 'audio' | 'video' | 'avatar' | 'image' = 'video'): string => {
  if (!path) return '';
  
  // Handle Windows paths with backslashes
  let cleanPath = path;
  if (cleanPath.includes('\\')) {
    cleanPath = cleanPath.replace(/\\/g, '/');
    const parts = cleanPath.split('/');
    cleanPath = parts[parts.length - 1];
  }
  
  // If already has folder prefix, return as-is
  const hasSubfolder = cleanPath.includes('avatars/') || cleanPath.includes('videos/') ||
                       cleanPath.includes('audio/') || cleanPath.includes('images/');
  if (hasSubfolder) return cleanPath;
  
  // If HTTP URL, return as-is
  if (cleanPath.startsWith('http')) return cleanPath;
  
  // Prepend appropriate folder
  let result: string;
  switch (type) {
    case 'avatar': result = `avatars/${cleanPath}`; break;
    case 'video': result = `videos/${cleanPath}`; break;
    case 'audio': result = `audio/${cleanPath}`; break;
    case 'image': result = `images/${cleanPath}`; break;
    default: result = cleanPath;
  }
  
  // Append extension if missing for video/audio types
  const hasExtension = /\.\w{2,5}$/.test(result);
  if (!hasExtension) {
    if (type === 'video' || type === 'avatar') result += '.mp4';
    else if (type === 'audio') result += '.mp3';
  }
  return result;
};

/**
 * Extract job ID from a player URL
 */
export const extractJobIdFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  // Try to extract from player URL format: /player_v2/?job=<job_id>
  const match = url.match(/[?&]job=([^&]+)/);
  if (match) return match[1];
  // Try to extract from direct path format: /jobs/<job_id>/
  const pathMatch = url.match(/\/jobs\/([^\/]+)/);
  if (pathMatch) return pathMatch[1];
  return null;
};

/**
 * Extract Vimeo video ID from various URL formats
 * Supports: vimeo.com/ID, player.vimeo.com/video/ID
 */
export const extractVimeoId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
};

/**
 * Get Vimeo video URL through proxy for CORS-safe canvas access
 * This enables canvas-based chroma keying on Vimeo videos
 */
export const getVimeoProxyUrl = (vimeoUrl: string): string | null => {
  const vimeoId = extractVimeoId(vimeoUrl);
  if (!vimeoId) return null;
  
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) return null;
  
  const params = new URLSearchParams({
    action: 'vimeo_proxy',
    vimeo_id: vimeoId,
  });
  
  return `${supabaseUrl}/functions/v1/video-generation-proxy?${params}`;
};

/**
 * Get Chatterbox avatar URL through proxy for CORS-safe playback
 * Converts raw Chatterbox URLs (port 5004) to proxied versions
 * Required because the Chatterbox server doesn't set CORS headers
 * 
 * Handles both URL formats:
 * - http://69.197.145.4:5004/outputs/final_task_xxx.mp4
 * - http://69.197.145.4:5004/outputs/task_xxx.mp4 (legacy)
 * 
 * @param rawUrl - The raw Chatterbox URL
 * @param serverIp - Optional server IP to route requests to
 */
export const getChatterboxProxyUrl = (rawUrl: string, serverIp?: string): string | null => {
  if (!rawUrl) return null;
  
  // Extract filename from Chatterbox URL pattern: /outputs/{filename}.mp4
  const match = rawUrl.match(/outputs\/([^.]+)\.mp4$/);
  if (!match) return null;
  
  let taskId = match[1];
  
  // Strip 'final_' prefix if present - the edge function will add it back
  // This ensures we don't end up with 'final_final_task_...'
  if (taskId.startsWith('final_')) {
    taskId = taskId.substring(6);
  }
  
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) return null;
  
  const params = new URLSearchParams({
    action: 'chatterbox_proxy',
    task_id: taskId,
  });
  
  // Add server_ip if provided for dynamic routing
  if (serverIp) {
    params.set('server_ip', serverIp);
  }
  
  return `${supabaseUrl}/functions/v1/video-generation-proxy?${params}`;
};

/**
 * Get Vimeo beat video URL from a section's beat_video path
 * Beat videos on Vimeo follow pattern: segment has vimeo_beat_url field
 * OR we can construct from job folder structure
 * 
 * @param beatVideoPath - The local beat video path (e.g., 'videos/segment_0.mp4')
 * @returns Vimeo proxy URL or null if not available
 */
export const getVimeoBeatVideoUrl = (beatVideoPath: string): string | null => {
  if (!beatVideoPath) return null;
  
  // Check if beatVideoPath is already a Vimeo URL
  if (beatVideoPath.includes('vimeo.com')) {
    return getVimeoProxyUrl(beatVideoPath);
  }
  
  // Currently beat videos from Vimeo would need a separate vimeo_beat_url field
  // For now, return null to fall back to local server
  // This can be enhanced when vimeo_beat_url is added to segment data
  return null;
};

/**
 * Get media URL from CDN server via proxy (CORS-safe)
 * Routes through edge function to add CORS headers since CDN servers
 * typically don't include Access-Control-Allow-Origin headers.
 * 
 * Pattern: Edge function proxy → https://{cdn_base_url}/{jobId}/{path}
 * Example: https://server1.simplelecture.com/video/0d01675f/videos/topic_3_beat_0.mp4
 * 
 * @param jobId - The job identifier
 * @param path - The file path within the job (e.g., 'videos/topic_3_beat_0.mp4')
 * @param cdnBaseUrl - The CDN base URL (e.g., 'https://server1.simplelecture.com/video')
 */
export const getCdnMediaUrl = (jobId: string, path: string, cdnBaseUrl: string): string => {
  if (!jobId || !path || !cdnBaseUrl) return '';
  
  // Clean the path - remove leading slashes
  const cleanPath = path.replace(/^\/+/, '');
  
  // Route through edge function proxy for CORS-safe access
  const supabaseUrl = getSupabaseUrl();
  if (supabaseUrl) {
    const params = new URLSearchParams({
      action: 'cdn_proxy',
      job_id: jobId,
      file_path: cleanPath,
      cdn_base_url: cdnBaseUrl,
    });
    return `${supabaseUrl}/functions/v1/video-generation-proxy?${params}`;
  }
  
  // Fallback to direct URL (will have CORS issues in browser)
  const cleanBaseUrl = cdnBaseUrl.replace(/\/+$/, '');
  return `${cleanBaseUrl}/${jobId}/${cleanPath}`;
};
