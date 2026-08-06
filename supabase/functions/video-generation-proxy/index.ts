// Video Generation Proxy - Version 2.0 - Updated with API-first Vimeo discovery
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-client-platform, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

// Default server IP - can be overridden per-request via server_ip parameter
const DEFAULT_SERVER_IP = "69.197.145.4";

// Helper to construct API base URL from server IP
function getExternalApiBase(serverIp?: string): string {
  const ip = serverIp || DEFAULT_SERVER_IP;
  return `http://${ip}:5005`;
}

function getChatterboxApiBase(serverIp?: string): string {
  const ip = serverIp || DEFAULT_SERVER_IP;
  return `http://${ip}:5004`;
}

// Backward compatibility - will be replaced with dynamic calls
const EXTERNAL_API_BASE = getExternalApiBase();

// In-memory idempotency map for generate_avatar to prevent duplicate submissions
// (e.g. double-clicks or client retries) that race and clobber presentation.json.
// Key: `${job_id}::${server_ip}` -> expiry epoch ms.
const GENERATE_AVATAR_DEDUP_MS = 90_000;
const generateAvatarInflight = new Map<string, number>();
function claimGenerateAvatar(key: string): boolean {
  const now = Date.now();
  // Sweep expired
  for (const [k, exp] of generateAvatarInflight) {
    if (exp <= now) generateAvatarInflight.delete(k);
  }
  const existing = generateAvatarInflight.get(key);
  if (existing && existing > now) return false;
  generateAvatarInflight.set(key, now + GENERATE_AVATAR_DEDUP_MS);
  return true;
}


// Helper to verify JWT for non-media actions
async function verifyAuth(req: Request): Promise<{ authorized: boolean; userId?: string; error?: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  // Extract token from Bearer header
  const token = authHeader.replace('Bearer ', '');

  // Allow service role key for server-to-server calls (e.g. auto-pipeline-worker)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey && token === serviceRoleKey) {
    console.log('[AUTH] Service role key authenticated');
    return { authorized: true, userId: 'service_role' };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  // Use getClaims for ES256 tokens in Lovable Cloud (verify_jwt=false)
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims?.sub) {
    console.error(`[AUTH] Token validation failed: ${JSON.stringify(error)}`);
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { authorized: true, userId: data.claims.sub as string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const requestedHeaders = req.headers.get('Access-Control-Request-Headers');
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}),
      }
    });
  }

  try {
    // Handle GET requests for media proxying
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      const job_id = url.searchParams.get('job_id');
      const file_path = url.searchParams.get('file_path');

      if (action === 'media') {
        if (!job_id || !file_path) {
          return new Response(
            JSON.stringify({ error: 'job_id and file_path are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Support dynamic server IP from query params
        const server_ip = url.searchParams.get('server_ip');
        const dynamicApiBase = getExternalApiBase(server_ip || undefined);
        const mediaUrl = `${dynamicApiBase}/player/jobs/${job_id}/${file_path}`;
        const reqId = crypto.randomUUID().slice(0, 8);
        const startedAt = Date.now();
        console.log(`[PROXY-MEDIA][START] req=${reqId} job=${job_id} server_ip=${server_ip || 'default'} file=${file_path} upstream=${mediaUrl}`);
        
        // Forward Range header for video streaming support
        const headers: Record<string, string> = {};
        const rangeHeader = req.headers.get('Range');
        if (rangeHeader) {
          headers['Range'] = rangeHeader;
        }
        
        let response: Response;
        try {
          response = await fetch(mediaUrl, { headers });
        } catch (err) {
          console.error(`[PROXY-MEDIA][FETCH-ERR] req=${reqId} upstream=${mediaUrl} elapsedMs=${Date.now() - startedAt} err=`, err);
          return new Response(
            JSON.stringify({ error: 'Upstream fetch failed', detail: String(err) }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const upstreamElapsed = Date.now() - startedAt;
        console.log(`[PROXY-MEDIA][HTTP] req=${reqId} status=${response.status} ct=${response.headers.get('content-type')} cl=${response.headers.get('content-length')} elapsedMs=${upstreamElapsed}`);
        
        if (!response.ok && response.status !== 206) {
          console.error(`[PROXY-MEDIA][FAIL] req=${reqId} status=${response.status} ${response.statusText} upstream=${mediaUrl}`);
          return new Response(
            JSON.stringify({ error: 'Media not found', status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const ext = file_path.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav',
          'ogg': 'audio/ogg',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
        };
        
        const contentType = contentTypes[ext || ''] || 'application/octet-stream';
        
        // Build response headers
        const responseHeaders: Record<string, string> = {
          ...corsHeaders,
          'Content-Type': contentType,
'Cache-Control': 'public, max-age=86400',
          'Accept-Ranges': 'bytes',
        };
        
        // Forward content-length and content-range for range requests
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          responseHeaders['Content-Length'] = contentLength;
        }
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          responseHeaders['Content-Range'] = contentRange;
        }
        
        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }

      // Handle CDN proxy for CORS-safe access to external CDN servers
      if (action === 'cdn_proxy') {
        const cdn_base_url = url.searchParams.get('cdn_base_url');
        
        if (!job_id || !file_path || !cdn_base_url) {
          return new Response(
            JSON.stringify({ error: 'job_id, file_path, and cdn_base_url are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Construct CDN URL
        const cleanPath = file_path.replace(/^\/+/, '');
        const cleanBaseUrl = cdn_base_url.replace(/\/+$/, '');
        const cdnUrl = `${cleanBaseUrl}/${job_id}/${cleanPath}`;
        const reqId = crypto.randomUUID().slice(0, 8);
        const startedAt = Date.now();
        console.log(`[CDN_PROXY][START] req=${reqId} job=${job_id} file=${file_path} upstream=${cdnUrl}`);
        
        // Forward Range header for video streaming
        const headers: Record<string, string> = {};
        const rangeHeader = req.headers.get('Range');
        if (rangeHeader) {
          headers['Range'] = rangeHeader;
        }
        
        let response: Response;
        try {
          response = await fetch(cdnUrl, { headers });
        } catch (err) {
          console.error(`[CDN_PROXY][FETCH-ERR] req=${reqId} upstream=${cdnUrl} elapsedMs=${Date.now() - startedAt} err=`, err);
          return new Response(
            JSON.stringify({ error: 'CDN fetch failed', detail: String(err) }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const upstreamElapsed = Date.now() - startedAt;
        console.log(`[CDN_PROXY][HTTP] req=${reqId} status=${response.status} ct=${response.headers.get('content-type')} cl=${response.headers.get('content-length')} elapsedMs=${upstreamElapsed}`);
        
        if (!response.ok && response.status !== 206) {
          console.error(`[CDN_PROXY][FAIL] req=${reqId} status=${response.status} ${response.statusText} upstream=${cdnUrl}`);
          return new Response(
            JSON.stringify({ error: 'CDN resource not found', status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const ext = file_path.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav',
          'ogg': 'audio/ogg',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
        };
        
        const contentType = contentTypes[ext || ''] || response.headers.get('content-type') || 'application/octet-stream';
        
        // Build response headers with CORS
        const responseHeaders: Record<string, string> = {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Accept-Ranges': 'bytes',
        };
        
        // Forward streaming headers
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          responseHeaders['Content-Length'] = contentLength;
        }
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          responseHeaders['Content-Range'] = contentRange;
        }
        
        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }

      // Vimeo proxy for CORS-safe avatar video streaming (enables canvas chroma key)
      if (action === 'vimeo_proxy') {
        const vimeo_id = url.searchParams.get('vimeo_id');
        
        if (!vimeo_id) {
          return new Response(
            JSON.stringify({ error: 'vimeo_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[VIMEO v2] Fetching video for ID: ${vimeo_id}`);

        let mp4Link: string | null = null;
        let quality: string = 'unknown';
        
        // Debug object to track method statuses
        const debug: Record<string, string | number> = {};

        // Helper for browser-like headers
        const getBrowserHeaders = (referer: string = 'https://vimeo.com/') => ({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Referer': referer,
          'Origin': 'https://vimeo.com',
          'Cookie': `vuid=pl${Date.now()}.${Math.random().toString(36).substring(2)}`,
        });

        // Helper to extract MP4 from progressive array
        const extractProgressiveMp4 = (progressive: Array<{ url?: string; height?: number; quality?: string }>) => {
          const sorted = progressive
            .filter((f) => f.url)
            .sort((a, b) => (b.height || 0) - (a.height || 0));
          
          if (sorted.length > 0) {
            return { url: sorted[0].url!, quality: sorted[0].quality || `${sorted[0].height}p` };
          }
          return null;
        };

        // ========== METHOD 0: Vimeo API (most reliable for server-to-server) ==========
        const VIMEO_TOKEN = Deno.env.get('VIMEO_ACCESS_TOKEN');
        if (VIMEO_TOKEN && !mp4Link) {
          try {
            console.log('[VIMEO] Method 0: Trying Vimeo API with download/files fields');
            
            const vimeoApiUrl = `https://api.vimeo.com/videos/${vimeo_id}?fields=download,files,privacy,embed,name`;
            const vimeoResponse = await fetch(vimeoApiUrl, {
              headers: {
                'Authorization': `Bearer ${VIMEO_TOKEN}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
              }
            });

            debug.api_status = vimeoResponse.status;

            if (vimeoResponse.ok) {
              const vimeoData = await vimeoResponse.json();
              console.log(`[VIMEO] API response keys: ${Object.keys(vimeoData).join(', ')}`);
              
              // Priority 1: Try download[] array (when "Allow downloads" is enabled)
              const downloads = vimeoData.download || [];
              if (downloads.length > 0) {
                console.log(`[VIMEO] Found ${downloads.length} download entries`);
                const mp4Downloads = downloads
                  .filter((d: { type?: string; link?: string; quality?: string }) => 
                    d.link && (d.type === 'video/mp4' || d.link.includes('.mp4'))
                  )
                  .sort((a: { height?: number }, b: { height?: number }) => 
                    (b.height || 0) - (a.height || 0)
                  );
                
                if (mp4Downloads.length > 0) {
                  mp4Link = mp4Downloads[0].link;
                  quality = mp4Downloads[0].quality || `${mp4Downloads[0].height}p`;
                  console.log(`[VIMEO] Found MP4 via API download: ${quality}`);
                }
              }
              
              // Priority 2: Try files[] array (requires Pro+ account)
              if (!mp4Link) {
                const files = vimeoData.files || [];
                if (files.length > 0) {
                  console.log(`[VIMEO] Found ${files.length} files entries`);
                  const progressiveFile = files
                    .filter((f: { quality?: string; type?: string }) => 
                      f.quality && f.type === 'video/mp4'
                    )
                    .sort((a: { height?: number }, b: { height?: number }) => 
                      (b.height || 0) - (a.height || 0)
                    )[0];

                  if (progressiveFile?.link) {
                    mp4Link = progressiveFile.link;
                    quality = progressiveFile.quality || `${progressiveFile.height}p`;
                    console.log(`[VIMEO] Found MP4 via API files: ${quality}`);
                  }
                }
              }
              
              // Log if no MP4 found via API
              if (!mp4Link) {
                console.log(`[VIMEO] API returned video but no MP4 links. Downloads enabled: ${downloads.length > 0}, Files available: ${(vimeoData.files || []).length > 0}`);
                debug.api_downloads = downloads.length;
                debug.api_files = (vimeoData.files || []).length;
              }
            } else {
              const errorText = await vimeoResponse.text();
              console.log(`[VIMEO] API returned ${vimeoResponse.status}: ${errorText.substring(0, 200)}`);
            }
          } catch (e) {
            console.log(`[VIMEO] API method failed: ${e}`);
            debug.api_error = String(e);
          }
        }

        // ========== METHOD 1: oEmbed → Player HTML → extract progressive/config_url ==========
        if (!mp4Link) {
          try {
            const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeo_id}`;
            console.log(`[VIMEO] Method 1: Trying oEmbed API: ${oembedUrl}`);
            
            const oembedResponse = await fetch(oembedUrl, {
              headers: getBrowserHeaders()
            });

            debug.oembed_status = oembedResponse.status;

            if (oembedResponse.ok) {
              const oembedData = await oembedResponse.json();
              const htmlMatch = oembedData.html?.match(/src="([^"]+)"/);
              
              if (htmlMatch) {
                const iframeSrc = htmlMatch[1].replace(/&amp;/g, '&');
                console.log(`[VIMEO] Got iframe src from oEmbed: ${iframeSrc}`);
                
                const playerResponse = await fetch(iframeSrc, {
                  headers: getBrowserHeaders('https://vimeo.com/')
                });

                debug.player_status = playerResponse.status;

                if (playerResponse.ok) {
                  const html = await playerResponse.text();
                  
                  // Try to extract config_url first (more reliable than regex on progressive)
                  const configUrlMatch = html.match(/"config_url"\s*:\s*"([^"]+)"/);
                  if (configUrlMatch) {
                    const configUrl = configUrlMatch[1]
                      .replace(/\\u002F/g, '/')
                      .replace(/\\u0026/g, '&')
                      .replace(/\\/g, '');
                    console.log(`[VIMEO] Found config_url in player HTML, fetching...`);
                    
                    const configResponse = await fetch(configUrl, {
                      headers: {
                        ...getBrowserHeaders('https://player.vimeo.com/'),
                        'Accept': 'application/json',
                      }
                    });

                    debug.config_status = configResponse.status;

                    if (configResponse.ok) {
                      const configData = await configResponse.json();
                      const progressive = configData?.request?.files?.progressive || [];
                      const result = extractProgressiveMp4(progressive);
                      
                      if (result) {
                        mp4Link = result.url;
                        quality = result.quality;
                        console.log(`[VIMEO] Found MP4 via oEmbed→config_url: ${quality}`);
                      }
                    }
                  }
                  
                  // Fallback: Try progressive array directly in HTML
                  if (!mp4Link) {
                    const progressiveMatch = html.match(/"progressive"\s*:\s*\[([\s\S]*?)\]/);
                    if (progressiveMatch) {
                      try {
                        const progressiveJson = JSON.parse(`[${progressiveMatch[1]}]`);
                        const result = extractProgressiveMp4(progressiveJson);
                        
                        if (result) {
                          mp4Link = result.url;
                          quality = result.quality;
                          console.log(`[VIMEO] Found MP4 via oEmbed→HTML progressive: ${quality}`);
                        }
                      } catch (parseErr) {
                        console.log(`[VIMEO] Failed to parse progressive array: ${parseErr}`);
                      }
                    }
                  }
                } else {
                  console.log(`[VIMEO] oEmbed player page returned ${playerResponse.status}`);
                }
              } else {
                console.log('[VIMEO] oEmbed response has no iframe src');
              }
            } else {
              console.log(`[VIMEO] oEmbed API returned ${oembedResponse.status}`);
            }
          } catch (e) {
            console.log(`[VIMEO] oEmbed method failed: ${e}`);
          }
        }

        // ========== METHOD 2: Direct embed page scraping ==========
        if (!mp4Link) {
          try {
            const embedUrl = `https://player.vimeo.com/video/${vimeo_id}`;
            console.log(`[VIMEO] Method 2: Trying direct embed page: ${embedUrl}`);
            
            const embedResponse = await fetch(embedUrl, {
              headers: getBrowserHeaders('https://vimeo.com/')
            });

            debug.embed_status = embedResponse.status;

            if (embedResponse.ok) {
              const html = await embedResponse.text();
              
              // Priority 1: Extract and fetch config_url
              const configUrlMatch = html.match(/"config_url"\s*:\s*"([^"]+)"/);
              if (configUrlMatch) {
                const configUrl = configUrlMatch[1]
                  .replace(/\\u002F/g, '/')
                  .replace(/\\u0026/g, '&')
                  .replace(/\\/g, '');
                console.log(`[VIMEO] Found config_url in embed HTML, fetching...`);
                
                const configResponse = await fetch(configUrl, {
                  headers: {
                    ...getBrowserHeaders('https://player.vimeo.com/'),
                    'Accept': 'application/json',
                  }
                });

                if (!debug.config_status) debug.config_status = configResponse.status;

                if (configResponse.ok) {
                  const configData = await configResponse.json();
                  const progressive = configData?.request?.files?.progressive || [];
                  const result = extractProgressiveMp4(progressive);
                  
                  if (result) {
                    mp4Link = result.url;
                    quality = result.quality;
                    console.log(`[VIMEO] Found MP4 via embed→config_url: ${quality}`);
                  }
                }
              }
              
              // Priority 2: Progressive array in HTML
              if (!mp4Link) {
                const progressiveMatch = html.match(/"progressive"\s*:\s*\[([\s\S]*?)\]/);
                if (progressiveMatch) {
                  try {
                    const progressiveJson = JSON.parse(`[${progressiveMatch[1]}]`);
                    const result = extractProgressiveMp4(progressiveJson);
                    
                    if (result) {
                      mp4Link = result.url;
                      quality = result.quality;
                      console.log(`[VIMEO] Found MP4 via embed HTML progressive: ${quality}`);
                    }
                  } catch (parseErr) {
                    console.log(`[VIMEO] Failed to parse progressive array: ${parseErr}`);
                  }
                }
              }
            } else {
              console.log(`[VIMEO] Direct embed page returned ${embedResponse.status}`);
            }
          } catch (e) {
            console.log(`[VIMEO] Direct embed scraping failed: ${e}`);
          }
        }

        // ========== METHOD 3: Direct config endpoint ==========
        if (!mp4Link) {
          try {
            const playerConfigUrl = `https://player.vimeo.com/video/${vimeo_id}/config`;
            console.log(`[VIMEO] Method 3: Trying config endpoint: ${playerConfigUrl}`);
            
            const configResponse = await fetch(playerConfigUrl, {
              headers: getBrowserHeaders('https://player.vimeo.com/')
            });

            if (!debug.config_status) debug.config_status = configResponse.status;

            if (configResponse.ok) {
              const configData = await configResponse.json();
              const progressive = configData?.request?.files?.progressive || [];
              const result = extractProgressiveMp4(progressive);
              
              if (result) {
                mp4Link = result.url;
                quality = result.quality;
                console.log(`[VIMEO] Found MP4 via config endpoint: ${quality}`);
              }
            } else {
              console.log(`[VIMEO] Config endpoint returned ${configResponse.status}`);
            }
          } catch (e) {
            console.log(`[VIMEO] Config endpoint failed: ${e}`);
          }
        }

        // ========== FINAL: Return error with debug info if no MP4 found ==========
        if (!mp4Link) {
          console.error('[VIMEO] No progressive MP4 file found after all methods');
          console.log('[VIMEO] Debug info:', JSON.stringify(debug));
          
          // Build actionable error message
          let errorMessage = 'No MP4 file found.';
          const suggestions: string[] = [];
          
          if (debug.embed_status === 401 || debug.player_status === 401) {
            suggestions.push('Video embedding may be restricted. In Vimeo settings, set "Where can this be embedded?" to "Anywhere".');
          }
          if (debug.config_status === 403) {
            suggestions.push('Vimeo blocked config access. This often happens with embedding restrictions.');
          }
          if (debug.api_status === 200 && debug.api_downloads === 0) {
            suggestions.push('Enable "Allow downloads" in Vimeo video settings to allow server-side access.');
          }
          if (!VIMEO_TOKEN) {
            suggestions.push('No VIMEO_ACCESS_TOKEN configured. Add it in edge function secrets for API access.');
          }
          
          if (suggestions.length > 0) {
            errorMessage += ' ' + suggestions.join(' ');
          }
          
          return new Response(
            JSON.stringify({ 
              error: errorMessage,
              debug,
              suggestions: suggestions.length > 0 ? suggestions : undefined,
            }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ========== SUCCESS: Proxy the MP4 stream with Range support ==========
        console.log(`[VIMEO] Streaming MP4 (${quality}): ${mp4Link.substring(0, 80)}...`);
        
        const rangeHeader = req.headers.get('Range');
        const mp4Headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
        if (rangeHeader) {
          mp4Headers['Range'] = rangeHeader;
        }

        const mp4Response = await fetch(mp4Link, { headers: mp4Headers });

        const responseHeaders: Record<string, string> = {
          ...corsHeaders,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        };

        const contentLength = mp4Response.headers.get('content-length');
        if (contentLength) {
          responseHeaders['Content-Length'] = contentLength;
        }
        const contentRange = mp4Response.headers.get('content-range');
        if (contentRange) {
          responseHeaders['Content-Range'] = contentRange;
        }

        return new Response(mp4Response.body, {
          status: mp4Response.status,
          headers: responseHeaders,
        });
      }

      // Chatterbox avatar proxy for CORS-safe language avatar playback (port 5004)
      if (action === 'chatterbox_proxy') {
        let task_id = url.searchParams.get('task_id');
        
        if (!task_id) {
          return new Response(
            JSON.stringify({ error: 'task_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Sanitize: strip 'final_' prefix if client accidentally sends it
        // This prevents 'final_final_task_...' URLs
        if (task_id.startsWith('final_')) {
          task_id = task_id.substring(6);
          console.log(`[CHATTERBOX] Stripped 'final_' prefix from task_id: ${task_id}`);
        }
        
        // Support dynamic server IP from query params
        const server_ip = url.searchParams.get('server_ip');
        const chatterboxIp = server_ip || DEFAULT_SERVER_IP;
        
        // Port 5004 is the Chatterbox/HeyGem server for language avatars
        // Output files have 'final_' prefix (e.g., final_task_xxx.mp4)
        const chatterboxUrl = `http://${chatterboxIp}:5004/outputs/final_${task_id}.mp4`;
        console.log(`[CHATTERBOX] Proxying: ${chatterboxUrl}`);
        
        // Forward Range header for streaming support
        const headers: Record<string, string> = {};
        const rangeHeader = req.headers.get('Range');
        if (rangeHeader) {
          headers['Range'] = rangeHeader;
        }
        
        const response = await fetch(chatterboxUrl, { headers });
        
        if (!response.ok && response.status !== 206) {
          console.error(`[CHATTERBOX] Fetch failed: ${response.status} ${response.statusText}`);
          return new Response(
            JSON.stringify({ error: 'Language avatar not found', status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const responseHeaders: Record<string, string> = {
          ...corsHeaders,
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=86400',
          'Accept-Ranges': 'bytes',
        };
        
        // Forward content-length and content-range for range requests
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          responseHeaders['Content-Length'] = contentLength;
        }
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          responseHeaders['Content-Range'] = contentRange;
        }
        
        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }

      // For non-media GET actions, verify auth
      const auth = await verifyAuth(req);
      if (!auth.authorized) return auth.error!;

      return new Response(
        JSON.stringify({ error: 'Invalid GET action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body first to check action type
    const body = await req.json();
    const {
      action, job_id, markdown, subject, grade, tts_provider, pipeline_version,
      server_ip, document_url, file_name, source_type, job_prefix,
      // Reel-mode optional fields
      audio_only, reel_with_avatar, reel_variant, ocr_provider, skip_threejs, llm_routing,
      avatar_language, video_provider, skip_wan, skip_avatar, dry_run, generation_scope,
      target_port,
      // Story-mode fields
      story_hint, avatar_speaker,
      // Marketing / advanced overrides
      no_quiz, image_provider, image_model, avatar_id,
    } = body;

    // Get dynamic API base URLs from server_ip parameter
    const dynamicApiBase = getExternalApiBase(server_ip);
    const dynamicChatterboxBase = getChatterboxApiBase(server_ip);
    // Reels are submitted to a separate port (e.g. 5006). Used by the submit action only.
    const submitApiBase = target_port
      ? `http://${server_ip || DEFAULT_SERVER_IP}:${target_port}`
      : dynamicApiBase;

    // Public actions that don't require authentication
    const publicActions = ['review'];

    // Only require auth for non-public actions
    if (!publicActions.includes(action)) {
      const auth = await verifyAuth(req);
      if (!auth.authorized) return auth.error!;
    }

    if (action === 'submit') {
      // ---- Story mode: form-only payload, no document/markdown required ----
      if (reel_variant === 'story') {
        if (!story_hint || typeof story_hint !== 'string' || story_hint.trim().length < 10) {
          return new Response(
            JSON.stringify({ error: 'story_hint is required (30-100 words recommended)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const storyForm = new FormData();
        // Attach a generated markdown file so the server's "file or markdown" validator passes
        const storyMarkdown = `# Story Mode\n\n${story_hint}\n`;
        const storyFileBlob = new Blob([storyMarkdown], { type: 'text/markdown' });
        storyForm.append('file', storyFileBlob, 'story.md');

        storyForm.append('subject', subject || 'General Science');
        storyForm.append('grade', String(grade || '12'));
        storyForm.append('dry_run', String(dry_run ?? false));
        storyForm.append('skip_wan', String(skip_wan ?? false));
        storyForm.append('skip_avatar', String(skip_avatar ?? false));
        storyForm.append('audio_only', String(body.audio_only ?? false));
        storyForm.append('reel_with_avatar', String(body.reel_with_avatar ?? true));
        storyForm.append('tts_provider', tts_provider || 'our_tts');
        storyForm.append('pipeline_version', pipeline_version || 'v3');
        storyForm.append('generation_scope', generation_scope || 'full');
        storyForm.append('video_provider', video_provider || 'kie');
        storyForm.append('ocr_provider', ocr_provider || 'local');
        storyForm.append('skip_threejs', String(skip_threejs ?? false));
        const defaultRouting = {
          chunker: 'openrouter', director: 'openrouter',
          manim_renderer: 'openrouter', remotion_renderer: 'openrouter',
          video_renderer: 'openrouter', prompt_enhancer: 'openrouter',
        };
        const routing = llm_routing ?? defaultRouting;
        storyForm.append('llm_routing', typeof routing === 'string' ? routing : JSON.stringify(routing));
        storyForm.append('avatar_language', avatar_language || 'english');
        if (avatar_speaker) storyForm.append('avatar_speaker', String(avatar_speaker));
        storyForm.append('reel_variant', 'story');
        storyForm.append('story_hint', story_hint);
        storyForm.append('image_provider', 'gpu');
        storyForm.append('image_model', 'flux_dev');

        console.log(`[submit:story] Posting to ${submitApiBase}/submit_job`);
        try {
          const response = await fetch(`${submitApiBase}/submit_job`, {
            method: 'POST',
            body: storyForm,
          });
          const data = await response.json();
          console.log('[submit:story] Server response:', JSON.stringify(data));
          return new Response(
            JSON.stringify(data),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (err) {
          console.error('[submit:story] fetch error:', err);
          return new Response(
            JSON.stringify({ status: 'error', error: `Story server unreachable: ${err instanceof Error ? err.message : err}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Helper: map file extension to MIME type
      const getMimeType = (name: string): string => {
        const ext = (name || '').split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          doc: 'application/msword',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ppt: 'application/vnd.ms-powerpoint',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          xls: 'application/vnd.ms-excel',
          md: 'text/markdown',
          html: 'text/html',
          txt: 'text/plain',
        };
        return mimeMap[ext || ''] || 'application/octet-stream';
      };

      console.log(`[submit] Received: document_url=${document_url || 'NONE'}, file_name=${file_name || 'NONE'}, source_type=${source_type || 'NONE'}, markdown_length=${markdown ? markdown.length : 0}`);

      let fileBlob: Blob;
      let uploadFileName: string;

      if (document_url) {
        // --- Download original document from storage ---
        console.log(`[submit] Using DOCUMENT URL path`);

        try {
          let downloadUrl = document_url;

          // If it's a B2 relative path (not a full URL), get an authorized URL
          if (!document_url.startsWith('http://') && !document_url.startsWith('https://')) {
            // TEMP: B2 account suspended — try Supabase Storage first
            const supabaseAdmin = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );
            const { data: signed } = await supabaseAdmin.storage
              .from('uploaded-question-documents')
              .createSignedUrl(document_url, 3600);

            if (signed?.signedUrl) {
              console.log(`[submit] Supabase Storage path detected, using signed URL`);
              const fileResp = await fetch(signed.signedUrl);
              if (!fileResp.ok) throw new Error(`Failed to download from Supabase Storage: ${fileResp.status}`);
              const arrayBuf = await fileResp.arrayBuffer();
              const mime = getMimeType(file_name || document_url);
              fileBlob = new Blob([arrayBuf], { type: mime });
              console.log(`[submit] File downloaded from Supabase: ${arrayBuf.byteLength} bytes, MIME: ${mime}`);
            } else {
              console.log(`[submit] B2 path detected, authorizing...`);
              const B2_KEY_ID = Deno.env.get('B2_KEY_ID');
              const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY');
              const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME');

              if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
                return new Response(
                  JSON.stringify({ error: 'B2 credentials not configured for document download' }),
                  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }

              const authResp = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
                headers: { 'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`) }
              });
              if (!authResp.ok) throw new Error('B2 authorization failed');
              const b2Auth = await authResp.json();
              console.log(`[submit] B2 authorized, download URL: ${b2Auth.downloadUrl}/file/${B2_BUCKET_NAME}/${document_url}`);

              downloadUrl = `${b2Auth.downloadUrl}/file/${B2_BUCKET_NAME}/${document_url}`;
              const fileResp = await fetch(downloadUrl, {
                headers: { 'Authorization': b2Auth.authorizationToken }
              });
              if (!fileResp.ok) throw new Error(`Failed to download document from B2: ${fileResp.status}`);
              const arrayBuf = await fileResp.arrayBuffer();
              const mime = getMimeType(file_name || document_url);
              fileBlob = new Blob([arrayBuf], { type: mime });
              console.log(`[submit] File downloaded: ${arrayBuf.byteLength} bytes, MIME: ${mime}`);
            }
          } else {
            console.log(`[submit] Full URL path, downloading directly...`);
            // Full URL (Supabase Storage or other)
            const fileResp = await fetch(downloadUrl);
            if (!fileResp.ok) throw new Error(`Failed to download document: ${fileResp.status}`);
            const arrayBuf = await fileResp.arrayBuffer();
            const mime = getMimeType(file_name || document_url);
            fileBlob = new Blob([arrayBuf], { type: mime });
            console.log(`[submit] File downloaded: ${arrayBuf.byteLength} bytes, MIME: ${mime}`);
          }

          uploadFileName = file_name || 'document';
        } catch (dlErr) {
          console.error('[submit] Document download error:', dlErr);
          return new Response(
            JSON.stringify({ error: `Failed to download original document: ${dlErr instanceof Error ? dlErr.message : dlErr}. Try re-uploading the document.` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (markdown) {
        // --- Fallback: send markdown as before ---
        console.log(`[submit] Using MARKDOWN fallback path (${markdown.length} chars)`);
        fileBlob = new Blob([markdown], { type: 'text/markdown' });
        uploadFileName = 'document.md';
      } else {
        return new Response(
          JSON.stringify({ error: 'Either document_url or markdown content is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build multipart form-data
      const formData = new FormData();
      formData.append('file', fileBlob, uploadFileName);
      formData.append('subject', subject || 'General Science');
      
      if (grade) {
        formData.append('grade', String(grade));
      }
      
      formData.append('tts_provider', tts_provider || 'our_tts');
      formData.append('pipeline_version', pipeline_version || 'v15_v2_director');
      formData.append('video_provider', video_provider || 'kie');
      formData.append('skip_wan', String(skip_wan ?? false));
      formData.append('skip_avatar', String(skip_avatar ?? false));
      formData.append('dry_run', String(dry_run ?? false));
      formData.append('generation_scope', generation_scope || 'full');
      formData.append('image_provider', image_provider || 'gpu');
      formData.append('image_model', image_model || 'flux_dev');
      if (no_quiz !== undefined) formData.append('no_quiz', String(no_quiz));
      if (avatar_speaker) formData.append('avatar_speaker', String(avatar_speaker));

      let resolvedAvatarId = avatar_id ? String(avatar_id) : '';
      if (!resolvedAvatarId && subject) {
        try {
          const admin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { persistSession: false } },
          );
          const { data: subRow } = await admin
            .from('popular_subjects')
            .select('avatar_id')
            .ilike('name', String(subject).trim())
            .maybeSingle();
          if (subRow?.avatar_id) resolvedAvatarId = String(subRow.avatar_id);
        } catch (err) {
          console.warn('[video-generation-proxy] Failed to resolve avatar_id from popular_subjects:', err);
        }
      }

      if (!resolvedAvatarId) {
        resolvedAvatarId = 'avatar_5ab07dea'; // Global fallback default avatar ID
      }

      formData.append('avatar_id', resolvedAvatarId);
      console.log(`[video-generation-proxy:submit] Structured Audit: subject="${subject}", raw_avatar_id="${avatar_id}", resolved_avatar_id="${resolvedAvatarId}", port=${target_port}`);

      // Reel-mode optional fields (only appended when explicitly provided)
      if (audio_only !== undefined) formData.append('audio_only', String(audio_only));
      if (reel_with_avatar !== undefined) formData.append('reel_with_avatar', String(reel_with_avatar));
      if (reel_variant !== undefined) formData.append('reel_variant', String(reel_variant));
      if (ocr_provider !== undefined) formData.append('ocr_provider', String(ocr_provider));
      if (skip_threejs !== undefined) formData.append('skip_threejs', String(skip_threejs));
      if (avatar_language !== undefined) formData.append('avatar_language', String(avatar_language));
      if (llm_routing !== undefined) {
        formData.append('llm_routing', typeof llm_routing === 'string' ? llm_routing : JSON.stringify(llm_routing));
      }

      if (job_prefix) {
        formData.append('job_prefix', job_prefix);
        console.log(`[submit] job_prefix: ${job_prefix}`);
      }

      console.log(`[submit] FormData built: file=${uploadFileName}, subject=${subject || 'General Science'}, tts_provider=${tts_provider || 'our_tts'}, pipeline=${pipeline_version || 'v15_v2_director'}`);
      console.log(`[submit] Posting to: ${submitApiBase}/submit_job`);
      
      try {
        const response = await fetch(`${submitApiBase}/submit_job`, {
          method: 'POST',
          body: formData
        });

        console.log(`[submit] Server response status: ${response.status}`);
        const data = await response.json();
        console.log('[submit] Server response body:', JSON.stringify(data));
        
        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchErr) {
        console.error('Submit fetch error:', fetchErr);
        return new Response(
          JSON.stringify({ status: 'error', error: `Server unreachable. The video generation server may be down. Details: ${fetchErr instanceof Error ? fetchErr.message : fetchErr}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'status') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusBase = target_port
        ? `http://${server_ip || DEFAULT_SERVER_IP}:${target_port}`
        : dynamicApiBase;
      const response = await fetch(`${statusBase}/job/${job_id}/status`);
      const data = await response.json();

      // Add player URL to response - use dynamic IP
      const playerUrl = `${statusBase}/player_v2/?job=${job_id}`;

      return new Response(
        JSON.stringify({ ...data, player_url: playerUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate_avatar') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dedupKey = `${job_id}::${server_ip || DEFAULT_SERVER_IP}`;
      if (!claimGenerateAvatar(dedupKey)) {
        console.warn(`[generate_avatar] Duplicate submission blocked for ${dedupKey} (within ${GENERATE_AVATAR_DEDUP_MS}ms)`);
        return new Response(
          JSON.stringify({
            status: 'duplicate_ignored',
            message: `A generate_avatar request for ${job_id} was already submitted within the last ${GENERATE_AVATAR_DEDUP_MS / 1000}s. Ignoring duplicate to prevent parallel runs that corrupt presentation.json.`,
            job_id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[generate_avatar] Starting avatar generation for job: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);
      
      // Use dynamic API base for correct server routing
      const response = await fetch(`${dynamicApiBase}/job/${job_id}/generate_avatar`, {
        method: 'POST'
      });
      const data = await response.json();
      console.log('Avatar generation response:', data);
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    if (action === 'avatar_status') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[avatar_status] Checking status for job: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);
      
      // Use dynamic API base for correct server routing
      const response = await fetch(`${dynamicApiBase}/job/${job_id}/avatar_status`);
      const data = await response.json();
      
      // Include HTTP status code so frontend can detect errors
      return new Response(
        JSON.stringify({ ...data, http_status: response.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retry specific phase for regeneration of missing components
    if (action === 'retry_phase') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { phase, section_ids, user_feedback } = body;
      
      if (!phase) {
        return new Response(
          JSON.stringify({ error: 'phase is required. Valid phases: manim_codegen, manim_render, avatar_generation, wan_render, tts_generation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validPhases = ['manim_codegen', 'manim_render', 'avatar_generation', 'wan_render', 'video_render', 'tts_generation'];
      if (!validPhases.includes(phase)) {
        return new Response(
          JSON.stringify({ error: `Invalid phase: ${phase}. Valid phases: ${validPhases.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[RETRY_PHASE] Retrying phase '${phase}' for job: ${job_id}`, section_ids ? `sections: ${JSON.stringify(section_ids)}` : 'all sections', user_feedback ? `feedback: ${user_feedback}` : '');
      
      const requestBody: { phase: string; section_ids?: number[]; user_feedback?: string } = { phase };
      if (section_ids && Array.isArray(section_ids) && section_ids.length > 0) {
        requestBody.section_ids = section_ids;
      }
      if (user_feedback && typeof user_feedback === 'string' && user_feedback.trim()) {
        requestBody.user_feedback = user_feedback.trim();
      }

      // Make a synchronous call with a timeout to get real success/failure
      const RETRY_TIMEOUT_MS = 15000; // 15 seconds timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RETRY_TIMEOUT_MS);

      try {
        console.log(`[RETRY_PHASE] Calling ${dynamicApiBase}/job/${job_id}/retry_phase with body:`, JSON.stringify(requestBody));
        
        const response = await fetch(`${dynamicApiBase}/job/${job_id}/retry_phase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Try to parse response as JSON, fallback to text for debugging
        let responseData: unknown;
        let responseText = '';
        try {
          responseText = await response.text();
          responseData = JSON.parse(responseText);
        } catch {
          console.log(`[RETRY_PHASE] Response is not JSON: ${responseText.substring(0, 500)}`);
          responseData = { raw_response: responseText.substring(0, 500) };
        }
        
        console.log(`[RETRY_PHASE] Response for ${job_id}/${phase}: status=${response.status}`, responseData);
        
        // If upstream returns error, propagate it clearly
        if (!response.ok) {
          console.error(`[RETRY_PHASE] Upstream error: ${response.status}`, responseData);
          return new Response(
            JSON.stringify({ 
              status: 'error',
              error: `Upstream returned ${response.status}`,
              upstream_status: response.status,
              upstream_body: responseData,
              phase,
              job_id,
              section_ids: section_ids || 'all'
            }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Success - upstream accepted the request
        return new Response(
          JSON.stringify({ 
            status: 'accepted',
            message: `Phase '${phase}' regeneration confirmed by upstream`,
            upstream_response: responseData,
            phase,
            job_id,
            section_ids: section_ids || 'all'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        // Check if it was a timeout
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.log(`[RETRY_PHASE] Request timed out after ${RETRY_TIMEOUT_MS}ms, falling back to background processing`);
          
          // Fallback to background processing for slow upstream with enhanced logging
          // @ts-ignore - EdgeRuntime is available in Supabase edge functions
          EdgeRuntime.waitUntil(
            (async () => {
              console.log(`[RETRY_PHASE] Background: Starting delayed request for ${job_id}/${phase}`);
              try {
                const bgResponse = await fetch(`${dynamicApiBase}/job/${job_id}/retry_phase`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                });
                
                // Parse response safely - handle non-JSON responses
                const bgText = await bgResponse.text();
                let bgData;
                try {
                  bgData = JSON.parse(bgText);
                } catch {
                  bgData = { raw: bgText.substring(0, 500) };
                }
                
                console.log(`[RETRY_PHASE] Background: Completed ${job_id}/${phase} - status=${bgResponse.status}`, JSON.stringify(bgData));
                
                if (!bgResponse.ok) {
                  console.error(`[RETRY_PHASE] Background: FAILED ${job_id}/${phase} - HTTP ${bgResponse.status}`, bgData);
                } else {
                  console.log(`[RETRY_PHASE] Background: SUCCESS ${job_id}/${phase} - upstream accepted request`);
                }
              } catch (bgError) {
                console.error(`[RETRY_PHASE] Background: Network error for ${job_id}/${phase}:`, bgError);
              }
            })()
          );
          
          return new Response(
            JSON.stringify({ 
              status: 'accepted',
              message: `Phase '${phase}' regeneration started (upstream slow, processing in background)`,
              phase,
              job_id,
              section_ids: section_ids || 'all',
              timeout: true
            }),
            { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Other fetch errors (network issues, etc.)
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        console.error(`[RETRY_PHASE] Fetch error for ${job_id}/${phase}:`, errorMessage);
        
        return new Response(
          JSON.stringify({ 
            status: 'error',
            error: `Failed to reach upstream: ${errorMessage}`,
            phase,
            job_id,
            section_ids: section_ids || 'all'
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== RERENDER (Quick WAN re-render, no LLM) ==========
    if (action === 'rerender') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { section_ids } = body;
      
      if (!section_ids || !Array.isArray(section_ids) || section_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'section_ids is required and must be a non-empty array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[RERENDER] Job: ${job_id}, sections: ${JSON.stringify(section_ids)}`);
      
      const requestBody = { section_ids };
      const RERENDER_TIMEOUT_MS = 15000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RERENDER_TIMEOUT_MS);

      try {
        const apiUrl = `${dynamicApiBase}/jobs/${job_id}/rerender`;
        console.log(`[RERENDER] Calling ${apiUrl} with body:`, JSON.stringify(requestBody));
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        let responseData: unknown;
        let responseText = '';
        try {
          responseText = await response.text();
          responseData = JSON.parse(responseText);
        } catch {
          console.log(`[RERENDER] Response is not JSON: ${responseText.substring(0, 500)}`);
          responseData = { raw_response: responseText.substring(0, 500) };
        }
        
        console.log(`[RERENDER] Response: status=${response.status}`, responseData);
        
        if (!response.ok) {
          console.error(`[RERENDER] Upstream error: ${response.status}`, responseData);
          const upstreamError = responseData?.error || responseData?.message || `Upstream returned ${response.status}`;
          return new Response(
            JSON.stringify({ 
              status: 'error',
              error: upstreamError,
              upstream_status: response.status,
              job_id,
              section_ids
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            status: 'accepted',
            message: `Rerender started for ${section_ids.length} section(s)`,
            upstream_response: responseData,
            job_id,
            section_ids
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.log(`[RERENDER] Request timed out after ${RERENDER_TIMEOUT_MS}ms, falling back to background processing`);
          
          // @ts-ignore - EdgeRuntime is available in Supabase edge functions
          EdgeRuntime.waitUntil(
            (async () => {
              console.log(`[RERENDER] Background: Starting delayed request for ${job_id}`);
              try {
                const bgResponse = await fetch(`${dynamicApiBase}/jobs/${job_id}/rerender`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                });
                
                const bgText = await bgResponse.text();
                let bgData;
                try { bgData = JSON.parse(bgText); } catch { bgData = { raw: bgText.substring(0, 500) }; }
                
                console.log(`[RERENDER] Background: Completed ${job_id} - status=${bgResponse.status}`, JSON.stringify(bgData));
                
                if (!bgResponse.ok) {
                  console.error(`[RERENDER] Background: FAILED ${job_id} - HTTP ${bgResponse.status}`, bgData);
                }
              } catch (bgError) {
                console.error(`[RERENDER] Background: Network error for ${job_id}:`, bgError);
              }
            })()
          );
          
          return new Response(
            JSON.stringify({ 
              status: 'accepted',
              message: `Rerender started (upstream slow, processing in background)`,
              job_id,
              section_ids,
              timeout: true
            }),
            { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        console.error(`[RERENDER] Fetch error for ${job_id}:`, errorMessage);
        
        return new Response(
          JSON.stringify({ 
            status: 'error',
            error: `Failed to reach upstream: ${errorMessage}`,
            job_id,
            section_ids
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== REGENERATE AND RENDER (Visual content - Manim/WAN) ==========
    if (action === 'regenerate_and_render') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { section_ids, renderers, execute, skip_wan, dry_run } = body;
      
      if (!section_ids || !Array.isArray(section_ids) || section_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'section_ids is required and must be a non-empty array of integers' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[REGEN_AND_RENDER] Job: ${job_id}, sections: ${JSON.stringify(section_ids)}, renderers: ${JSON.stringify(renderers || ['all'])}, execute: ${execute !== false}, dry_run: ${dry_run || false}`);
      
      const requestBody: Record<string, unknown> = { section_ids };
      if (renderers && Array.isArray(renderers)) requestBody.renderers = renderers;
      if (execute !== undefined) requestBody.execute = execute;
      if (skip_wan !== undefined) requestBody.skip_wan = skip_wan;
      if (dry_run !== undefined) requestBody.dry_run = dry_run;

      const REGEN_TIMEOUT_MS = 15000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REGEN_TIMEOUT_MS);

      try {
        const apiUrl = `${dynamicApiBase}/jobs/${job_id}/regenerate_and_render`;
        console.log(`[REGEN_AND_RENDER] Calling ${apiUrl} with body:`, JSON.stringify(requestBody));
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        let responseData: unknown;
        let responseText = '';
        try {
          responseText = await response.text();
          responseData = JSON.parse(responseText);
        } catch {
          console.log(`[REGEN_AND_RENDER] Response is not JSON: ${responseText.substring(0, 500)}`);
          responseData = { raw_response: responseText.substring(0, 500) };
        }
        
        console.log(`[REGEN_AND_RENDER] Response: status=${response.status}`, responseData);
        
        if (!response.ok) {
          console.error(`[REGEN_AND_RENDER] Upstream error: ${response.status}`, responseData);
          const upstreamError = responseData?.error || responseData?.message || `Upstream returned ${response.status}`;
          return new Response(
            JSON.stringify({ 
              status: 'error',
              error: upstreamError,
              upstream_status: response.status,
              job_id,
              section_ids
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            status: 'accepted',
            message: `Regenerate and render started for ${section_ids.length} section(s)`,
            upstream_response: responseData,
            job_id,
            section_ids
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.log(`[REGEN_AND_RENDER] Request timed out after ${REGEN_TIMEOUT_MS}ms, falling back to background processing`);
          
          // @ts-ignore - EdgeRuntime is available in Supabase edge functions
          EdgeRuntime.waitUntil(
            (async () => {
              console.log(`[REGEN_AND_RENDER] Background: Starting delayed request for ${job_id}`);
              try {
                const bgResponse = await fetch(`${dynamicApiBase}/jobs/${job_id}/regenerate_and_render`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                });
                
                const bgText = await bgResponse.text();
                let bgData;
                try { bgData = JSON.parse(bgText); } catch { bgData = { raw: bgText.substring(0, 500) }; }
                
                console.log(`[REGEN_AND_RENDER] Background: Completed ${job_id} - status=${bgResponse.status}`, JSON.stringify(bgData));
                
                if (!bgResponse.ok) {
                  console.error(`[REGEN_AND_RENDER] Background: FAILED ${job_id} - HTTP ${bgResponse.status}`, bgData);
                }
              } catch (bgError) {
                console.error(`[REGEN_AND_RENDER] Background: Network error for ${job_id}:`, bgError);
              }
            })()
          );
          
          return new Response(
            JSON.stringify({ 
              status: 'accepted',
              message: `Regenerate and render started (upstream slow, processing in background)`,
              job_id,
              section_ids,
              timeout: true
            }),
            { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        console.error(`[REGEN_AND_RENDER] Fetch error for ${job_id}:`, errorMessage);
        
        return new Response(
          JSON.stringify({ 
            status: 'error',
            error: `Failed to reach upstream: ${errorMessage}`,
            job_id,
            section_ids
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'review') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching presentation.json for job: ${job_id} from server: ${server_ip || DEFAULT_SERVER_IP}`);
      
      // Use dynamic API base URL based on server_ip parameter
      const url = `${dynamicApiBase}/player/jobs/${job_id}/presentation.json`;
      
      let response;
      try {
        response = await fetch(url);
      } catch (fetchErr) {
        console.error(`Connection error fetching presentation.json for job ${job_id}:`, fetchErr);
        return new Response(
          JSON.stringify({ error: `Server unreachable at ${server_ip || DEFAULT_SERVER_IP}:5005. The video generation server may be down or restarting.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Upstream error for job ${job_id}: ${response.status} - ${errorText}`);

        // CDN fallback: some jobs are missing on the port-5005 upstream
        // (server restarted / registry lost) but the presentation.json is
        // still available on the public CDN. Try that before failing.
        try {
          const cdnUrl = `https://server1.simplelecture.com/video/${job_id}/presentation.json`;
          const cdnResp = await fetch(cdnUrl);
          if (cdnResp.ok) {
            const cdnData = await cdnResp.json();
            console.log(`[review] Served ${job_id} from CDN fallback`);
            return new Response(
              JSON.stringify(cdnData),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (cdnErr) {
          console.error(`[review] CDN fallback failed for ${job_id}:`, cdnErr);
        }

        return new Response(
          JSON.stringify({ error: `Upstream error: ${errorText}`, status: response.status }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      
      const data = await response.json();
      
      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Submit section-specific review notes
    if (action === 'submit_review') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { sections } = body;
      if (!sections || !Array.isArray(sections)) {
        return new Response(
          JSON.stringify({ error: 'sections array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform sections to edits format expected by external API.
      // The upstream has historically varied field naming, so we include several common keys.
      const edits = (sections as Array<{ section_id?: number; notes?: string }> )
        .filter((s) => typeof s?.section_id === 'number' && !!s?.notes?.trim())
        .map((s) => ({
          section_id: s.section_id as number,
          notes: s.notes as string,
          feedback: s.notes as string,
          edit: s.notes as string,
          text: s.notes as string,
        }));

      if (!edits.length) {
        return new Response(
          JSON.stringify({ error: 'No edits to submit' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const requestBody = { job_id, edits };
      console.log(`[SUBMIT_REVIEW] Upstream payload for ${job_id}:`, JSON.stringify(requestBody));

      // Prefer job-scoped endpoint, but fall back to global endpoint if needed.
      const primaryUrl = `${dynamicApiBase}/job/${job_id}/submit_review`;
      let response = await fetch(primaryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      // Fallback when the upstream expects /submit_review instead of the job-scoped route.
      if (!response.ok) {
        const cloneText = await response.clone().text().catch(() => '');
        if (response.status === 404 || cloneText.includes('No edits provided')) {
          const fallbackUrl = `${dynamicApiBase}/submit_review`;
          console.log(`[SUBMIT_REVIEW] Primary rejected (${response.status}). Retrying via ${fallbackUrl}`);
          response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
        }
      }

      const data = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
      
      // LOG THE RESPONSE so we can see if it actually saved
      console.log(`[SUBMIT_REVIEW] Response status: ${response.status}, body:`, JSON.stringify(data));
      
      return new Response(
        JSON.stringify(data),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== REGENERATE WITH FEEDBACK (Section-level fallback) ==========
    // This uses the proven retry_phase endpoint that accepts user_feedback inline
    if (action === 'regenerate_with_feedback') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { section_id, feedback, phase = 'avatar_generation' } = body;
      
      if (section_id === undefined || section_id === null) {
        return new Response(
          JSON.stringify({ error: 'section_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[REGEN_FEEDBACK] Regenerating section ${section_id} for job ${job_id} with phase=${phase}, feedback: ${feedback || '(none)'}`);
      
      try {
        // Use the existing retry_phase endpoint with section_ids and user_feedback
        const response = await fetch(`${dynamicApiBase}/job/${job_id}/retry_phase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phase, 
            section_ids: [section_id],
            user_feedback: feedback || ''
          })
        });

        const data = await response.json().catch(async () => ({ 
          raw: await response.text().catch(() => '') 
        }));
        
        console.log(`[REGEN_FEEDBACK] Response status: ${response.status}, body:`, JSON.stringify(data));
        
        return new Response(
          JSON.stringify({ success: response.ok, section_id, phase, ...data }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[REGEN_FEEDBACK] Error:', e);
        return new Response(
          JSON.stringify({ error: `Regenerate with feedback error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Trigger regeneration based on submitted reviews
    if (action === 'recreate_from_review') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { section_ids, edits } = body;
      
      console.log(`[RECREATE_FROM_REVIEW] Triggering regeneration for job ${job_id}`, 
        section_ids ? `sections: ${JSON.stringify(section_ids)}` : 'all sections',
        edits ? `with ${edits.length} edits` : 'no inline edits');
      
      // Build request body - include edits if provided for APIs that expect inline edits
      const requestBody: { job_id: string; section_ids?: number[]; edits?: unknown[] } = { job_id };
      if (section_ids && Array.isArray(section_ids)) {
        requestBody.section_ids = section_ids;
      }
      if (edits && Array.isArray(edits)) {
        requestBody.edits = edits;
      }

      const response = await fetch(`${dynamicApiBase}/recreate_job_from_review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
      return new Response(
        JSON.stringify(data),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sanity_check') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Running deep sanity check for job: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);
      
      // Fetch presentation.json first
      const presentationUrl = `${dynamicApiBase}/player/jobs/${job_id}/presentation.json`;
      const presentationResponse = await fetch(presentationUrl);
      
      if (!presentationResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch presentation data' }),
          { status: presentationResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const presentation = await presentationResponse.json();
      const sections = presentation.sections || [];
      const presentationTitle = presentation.presentation_title || 'Unknown';
      
      // Helper to check file existence
      const checkFile = async (path: string): Promise<number> => {
        try {
          const response = await fetch(`${dynamicApiBase}/player/jobs/${job_id}/${path}`, { method: 'HEAD' });
          return response.status;
        } catch {
          return 0;
        }
      };
      
      // URL Health check helper
      const checkUrlHealth = (section: { 
        visual_beats?: Array<{ image_id?: string | null }>; 
        explanation_plan?: { visual_beats?: Array<{ image_id?: string | null }> };
      }): { clean: boolean; issues: string[] } => {
        const issues: string[] = [];
        const visualBeats = section.visual_beats || section.explanation_plan?.visual_beats || [];
        
        for (const beat of visualBeats) {
          const imageId = beat.image_id;
          if (imageId) {
            // Check for Docker path leaks
            if (imageId.includes('/app/player/')) {
              issues.push('Docker path leak: /app/player/');
            }
            // Check for double slashes
            if (imageId.includes('//') && !imageId.startsWith('http')) {
              issues.push('Malformed URL: double slashes');
            }
          }
        }
        
        return { clean: issues.length === 0, issues };
      };
      
      // V2.5 Logic Check helper
      const checkV25Logic = (section: { 
        section_type: string; 
        renderer?: string;
        narration?: { segments?: Array<unknown> };
        visual_beats?: Array<{ image_id?: string | null }>;
        explanation_plan?: { visual_beats?: Array<{ image_id?: string | null }> };
        bullet_points?: Array<unknown>;
        flashcards?: Array<unknown>;
        manim_specs?: Array<unknown>;
        quiz_flow?: { steps?: Array<unknown> };
      }): { status: 'PASS' | 'FAIL' | 'N/A'; type: string | null; details: Record<string, number> | null } => {
        const sectionType = section.section_type;
        const renderer = section.renderer;
        
        // Skip intro only
        if (sectionType === 'intro') {
          return { status: 'N/A', type: null, details: null };
        }
        
        const segments = section.narration?.segments?.length || 0;
        const visualBeats = section.visual_beats || section.explanation_plan?.visual_beats || [];
        
        // Recap section: Cinematic 5 check
        if (sectionType === 'recap') {
          const pass = segments >= 5;
          return {
            status: pass ? 'PASS' : 'FAIL',
            type: 'Cinematic 5',
            details: { segs: segments }
          };
        }
        
        // Quiz section: Check 3-step flow
        if (sectionType === 'quiz') {
          const steps = section.quiz_flow?.steps?.length || 0;
          const pass = steps >= 3 && segments >= 6;
          return {
            status: pass ? 'PASS' : 'FAIL',
            type: 'Quiz Flow',
            details: { steps, segs: segments }
          };
        }
        
        // Summary section: segs >= bullets
        if (sectionType === 'summary') {
          const bullets = section.bullet_points?.length || visualBeats.length || 0;
          const pass = segments >= bullets;
          return {
            status: pass ? 'PASS' : 'FAIL',
            type: 'Deep Sync',
            details: { bullets, segs: segments }
          };
        }
        
        // Memory section: 5 flashcards + 6 segments
        if (sectionType === 'memory') {
          const flashcards = section.flashcards?.length || 0;
          const expectedSegs = 6;
          const pass = flashcards >= 5 && segments >= expectedSegs;
          return {
            status: pass ? 'PASS' : 'FAIL',
            type: 'Memory Check',
            details: { flashcards, segs: segments }
          };
        }
        
        // Manim content
        if (renderer === 'MANIM') {
          const specs = section.manim_specs?.length || 0;
          const linkedBeats = visualBeats.filter(b => b.image_id).length;
          return {
            status: specs > 0 ? 'PASS' : 'FAIL',
            type: 'Manim V2.6',
            details: { specs, disk: linkedBeats, linked: linkedBeats }
          };
        }
        
        // Content section with Deep Sync
        if (sectionType === 'content') {
          const bullets = visualBeats.length;
          const pass = segments >= 1;
          return {
            status: pass ? 'PASS' : 'FAIL',
            type: 'Deep Sync',
            details: { bullets, segs: segments }
          };
        }
        
        return { status: 'N/A', type: null, details: null };
      };
      
      // Process each section
      interface SectionData {
        section_id: number; 
        section_type: string; 
        title: string; 
        renderer?: string;
        avatar_video?: string;
        video_path?: string;
        beat_videos?: string[];
        visual_beats?: Array<{ image_id?: string | null; beat_id?: string }>;
        explanation_plan?: { visual_beats?: Array<{ image_id?: string | null; beat_id?: string }> };
        video_prompts?: Array<unknown>;
        narration?: { segments?: Array<{ beat_videos?: string[]; [key: string]: unknown }> };
        bullet_points?: Array<unknown>;
        flashcards?: Array<unknown>;
        manim_specs?: Array<unknown>;
        quiz_flow?: { steps?: Array<unknown> };
      }
      
      const sectionHealthPromises = sections.map(async (section: SectionData) => {
        const sectionId = section.section_id;
        
        // Check avatar video - use actual path from JSON
        const avatarPath = section.avatar_video || `avatars/section_${sectionId}_avatar.mp4`;
        const avatarStatus = await checkFile(avatarPath);
        
        // Collect beat_videos from section level OR from narration segments
        const allBeatVideos: string[] = section.beat_videos ? [...section.beat_videos] : [];
        if (allBeatVideos.length === 0 && section.narration?.segments) {
          for (const seg of section.narration.segments) {
            if (seg.beat_videos) {
              allBeatVideos.push(...seg.beat_videos);
            }
          }
        }
        
        // Check topic video - use actual path from JSON
        let topicPath = '';
        let topicStatus: number | null = null;
        let orphanTopicVideo: { path: string; status: number } | null = null;
        
        if (section.video_path) {
          topicPath = section.video_path;
          topicStatus = await checkFile(topicPath);
        } else if (allBeatVideos.length > 0) {
          topicPath = allBeatVideos[0];
          // Ensure .mp4 extension
          if (!/\.\w{2,5}$/.test(topicPath)) topicPath += '.mp4';
          // Add videos/ prefix if missing
          if (!topicPath.includes('/')) topicPath = `videos/${topicPath}`;
          topicStatus = await checkFile(topicPath);
        }
        // REMOVED: No more guessing paths for MANIM/content sections
        // Instead, check for orphan files (exist on disk but not in JSON)
        if (!topicPath && (section.renderer === 'MANIM' || section.section_type === 'content' || section.section_type === 'recap')) {
          const expectedPattern = `videos/topic_${sectionId}_beat_0.mp4`;
          const orphanStatus = await checkFile(expectedPattern);
          // Only report if file ACTUALLY EXISTS (2xx status)
          if (orphanStatus >= 200 && orphanStatus < 300) {
            orphanTopicVideo = { path: expectedPattern, status: orphanStatus };
          }
        }
        
        // Collect images from visual_beats
        const visualBeats = section.visual_beats || section.explanation_plan?.visual_beats || [];
        const imageIds = visualBeats
          .filter((beat) => beat.image_id)
          .map((beat) => beat.image_id as string);
        
        // Check each image - handle both relative and prefixed paths
        // Normalize .jpg/.jpeg → .png since server stores images as PNG
        const imageHealthPromises = imageIds.map(async (imageId: string) => {
          let normalizedId = imageId;
          if (normalizedId.endsWith('.jpg') || normalizedId.endsWith('.jpeg')) {
            normalizedId = normalizedId.replace(/\.jpe?g$/, '.png');
          }
          const imagePath = normalizedId.includes('/') ? normalizedId : `images/${normalizedId}`;
          const status = await checkFile(imagePath);
          return { image_id: imageId, beat_id: visualBeats.find(b => b.image_id === imageId)?.beat_id || '', status };
        });
        
        const images = await Promise.all(imageHealthPromises);
        
        // Prompts vs Disk check - count actual beat videos
        const videoPrompts = section.video_prompts || [];
        const promptCount = videoPrompts.length;
        const beatVideos = allBeatVideos;
        
        let diskCount = 0;
        if (beatVideos.length > 0) {
          const resolvedPaths = beatVideos.map(p => {
            let resolved = p;
            if (!/\.\w{2,5}$/.test(resolved)) resolved += '.mp4';
            if (!resolved.includes('/')) resolved = `videos/${resolved}`;
            return resolved;
          });
          const beatStatuses = await Promise.all(resolvedPaths.map(p => checkFile(p)));
          diskCount = beatStatuses.filter(s => s >= 200 && s < 300).length;
        } else if (topicStatus !== null && topicStatus >= 200 && topicStatus < 300) {
          diskCount = 1;
        }
        
        let promptsVsDisk: { status: 'N/A' | 'MATCH' | 'MISMATCH'; prompts?: number; disk?: number; files?: Array<{ path: string; status: number }> };
        if (promptCount === 0) {
          promptsVsDisk = { status: 'N/A' };
        } else {
          // Build files array from resolved beat video paths
          const resolvedPaths2 = beatVideos.map(p => {
            let resolved = p;
            if (!/\.\w{2,5}$/.test(resolved)) resolved += '.mp4';
            if (!resolved.includes('/')) resolved = `videos/${resolved}`;
            return resolved;
          });
          const beatStatuses2 = beatVideos.length > 0 
            ? await Promise.all(resolvedPaths2.map(p => checkFile(p)))
            : [];
          
          promptsVsDisk = {
            status: diskCount >= promptCount ? 'MATCH' : 'MISMATCH',
            prompts: promptCount,
            disk: diskCount,
            files: resolvedPaths2.map((p, i) => ({ path: p, status: beatStatuses2[i] }))
          };
        }
        
        // URL Health check
        const urlHealth = checkUrlHealth(section);
        
        // V2.5 Logic check
        const v25Logic = checkV25Logic(section);
        
        return {
          section_id: sectionId,
          section_type: section.section_type,
          title: section.title,
          renderer: section.renderer || null,
          avatar_video: { path: avatarPath, status: avatarStatus },
          topic_video: { 
            path: topicPath || null, 
            status: topicStatus,
            orphan: orphanTopicVideo
          },
          prompts_vs_disk: promptsVsDisk,
          images,
          url_health: urlHealth,
          v25_logic_check: v25Logic
        };
      });
      
      const sectionHealth = await Promise.all(sectionHealthPromises);
      
      // Calculate summary
      let avatarHealthy = 0, avatarTotal = 0;
      let topicHealthy = 0, topicTotal = 0;
      let imagesHealthy = 0, imagesTotal = 0;
      let urlIssuesCount = 0;
      let v25PassCount = 0, v25FailCount = 0;
      const orphanFiles: string[] = [];
      
      for (const section of sectionHealth) {
        // Avatar
        avatarTotal++;
        if (section.avatar_video.status >= 200 && section.avatar_video.status < 300) {
          avatarHealthy++;
        }
        
        // Topic video
        // Only count if there's a path in JSON (not orphan-guessed ones)
        if (section.topic_video.path) {
          topicTotal++;
          if (section.topic_video.status !== null && section.topic_video.status >= 200 && section.topic_video.status < 300) {
            topicHealthy++;
          }
        }
        // Track orphan files separately
        if (section.topic_video.orphan) {
          orphanFiles.push((section.topic_video.orphan as { path: string; status: number }).path);
        }
        
        // Images
        for (const img of section.images) {
          imagesTotal++;
          if (img.status >= 200 && img.status < 300) {
            imagesHealthy++;
          }
        }
        
        // URL issues
        if (!section.url_health.clean) {
          urlIssuesCount++;
        }
        
        // V2.5 logic
        if (section.v25_logic_check.status === 'PASS') v25PassCount++;
        if (section.v25_logic_check.status === 'FAIL') v25FailCount++;
      }
      
      // Detect orphan files - found during section analysis
      const orphansFound = orphanFiles.length > 0;
      
      const result = {
        job_id,
        presentation_title: presentationTitle,
        check_status: 'complete',
        orphans_found: orphansFound,
        orphan_files: orphanFiles,
        sections: sectionHealth,
        summary: {
          total_sections: sections.length,
          avatar_healthy: avatarHealthy,
          avatar_total: avatarTotal,
          topic_healthy: topicHealthy,
          topic_total: topicTotal,
          images_healthy: imagesHealthy,
          images_total: imagesTotal,
          url_issues: urlIssuesCount,
          v25_pass: v25PassCount,
          v25_fail: v25FailCount
        }
      };
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list_jobs') {
      const base = target_port ? submitApiBase : dynamicApiBase;
      console.log(`[list_jobs] Fetching jobs from: ${base}`);

      const response = await fetch(`${base}/jobs`);
      const data = await response.json();

      if (job_id && data && Array.isArray(data.jobs)) {
        const match = data.jobs.find((j: any) => j.job_id === job_id);
        return new Response(
          JSON.stringify({ job: match || null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    if (action === 'repair_urls') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Repairing malformed URLs for job: ${job_id}`);
      
      const response = await fetch(`${dynamicApiBase}/api/repair-urls/${job_id}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`URL repair failed for job ${job_id}: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ 
            error: `URL repair failed: ${errorText}`, 
            status: response.status 
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const data = await response.json();
      console.log('URL repair response:', data);
      
      return new Response(
        JSON.stringify({ success: true, ...data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== REPAIR MISSING ASSETS ==========
    if (action === 'repair_missing_assets') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dynamicApiBase = getExternalApiBase(server_ip);
      console.log(`Repairing missing assets for job: ${job_id} on ${dynamicApiBase}`);
      
      const response = await fetch(`${dynamicApiBase}/api/repair-missing-assets/${job_id}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Repair missing assets failed for job ${job_id}: ${response.status} - ${errorText}`);
        let errorMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorText;
        } catch (_) { /* use raw text */ }
        return new Response(
          JSON.stringify({ 
            status: 'error',
            error: errorMessage, 
            upstream_status: response.status 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const data = await response.json();
      console.log('Repair missing assets response:', data);
      
      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STITCH ASSETS ==========
    if (action === 'stitch_assets') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Stitching missing assets for job: ${job_id}`);
      
      const response = await fetch(`${dynamicApiBase}/api/repair-metadata/${job_id}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Asset stitch failed for job ${job_id}: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ 
            error: `Asset stitch failed: ${errorText}`, 
            status: response.status 
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const data = await response.json();
      console.log('Asset stitch response:', data);
      
      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CHATTERBOX API - Multi-Language Avatar Generation (Port 5004) ==========
    // Use dynamic Chatterbox base from server_ip parameter

    // Helper: Fetch with retry and exponential backoff for Chatterbox API
    async function fetchWithRetry(
      url: string, 
      options: RequestInit, 
      maxRetries = 3
    ): Promise<Response> {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`[CHATTERBOX RETRY] Attempt ${attempt + 1}/${maxRetries} for ${url}`);
          const response = await fetch(url, options);
          return response;
        } catch (error) {
          lastError = error as Error;
          console.log(`[CHATTERBOX RETRY] Attempt ${attempt + 1} failed: ${error}`);
          
          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.log(`[CHATTERBOX RETRY] Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError;
    }

    if (action === 'chatterbox_generate') {
      const { text, language, speaker, avatar_id } = body;
      
      // STRICT VALIDATION - all required fields must be present, no fallbacks
      if (!text || !language || !speaker) {
        const missing = [];
        if (!text) missing.push('text');
        if (!language) missing.push('language');
        if (!speaker) missing.push('speaker');
        
        console.error(`[CHATTERBOX] Missing required fields: ${missing.join(', ')}. Received: text=${!!text}, language="${language}", speaker="${speaker}"`);
        return new Response(
          JSON.stringify({ 
            error: `Missing required fields: ${missing.join(', ')}`,
            received: { text: !!text, language, speaker }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log EXACT payload being sent - no fallbacks, use exactly what was passed
      console.log(`[CHATTERBOX] Generating avatar with EXACT payload - text: "${text.slice(0, 50)}...", language: "${language}", speaker: "${speaker}"`);
      
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', language);   // NO FALLBACK - use exactly what was passed
      formData.append('speaker', speaker);     // NO FALLBACK - use exactly what was passed
      if (avatar_id) formData.append('avatar_id', avatar_id);
      
      try {
        // Use retry wrapper for resilience against connection errors
        const response = await fetchWithRetry(
          `${dynamicChatterboxBase}/api/generate`,
          { method: 'POST', body: formData },
          3 // 3 retries with exponential backoff
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[CHATTERBOX] Generate failed: ${response.status} - ${errorText}`);
          return new Response(
            JSON.stringify({ error: `Chatterbox generate failed: ${errorText}`, status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const data = await response.json();
        console.log('[CHATTERBOX] Generate response:', data);
        
        return new Response(
          JSON.stringify({ success: true, task_id: data.task_id, ...data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[CHATTERBOX] Generate error after retries:', e);
        return new Response(
          JSON.stringify({ 
            error: `Chatterbox server unavailable after 3 retries: ${e}`,
            retryable: true 
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'chatterbox_status') {
      const { task_id } = body;
      
      if (!task_id) {
        return new Response(
          JSON.stringify({ error: 'task_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[CHATTERBOX] Checking status for task: ${task_id}`);
      
      try {
        // Use retry wrapper with fewer retries for status (faster feedback)
        const response = await fetchWithRetry(
          `${dynamicChatterboxBase}/api/status/${task_id}`,
          { method: 'GET' },
          2 // 2 retries for status checks
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[CHATTERBOX] Status check failed: ${response.status} - ${errorText}`);
          
          // Handle 404 as "task not found" - terminal failure
          if (response.status === 404) {
            return new Response(
              JSON.stringify({ 
                status: 'failed',
                error: 'Task not found - generation may have failed',
                terminal: true 
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ error: `Status check failed: ${errorText}`, status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const data = await response.json();
        console.log('[CHATTERBOX] Status response:', data);
        
        // Explicitly handle "not_found" as a terminal state (even in 200 response body)
        if (data.status === 'not_found' || data.error?.includes('not found')) {
          console.log('[CHATTERBOX] Task not found, marking as terminal failure');
          return new Response(
            JSON.stringify({ 
              status: 'failed',
              error: data.error || 'Task not found - generation may have failed',
              terminal: true 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[CHATTERBOX] Status error after retries:', e);
        // Return 503 for connection errors (client should retry later)
        return new Response(
          JSON.stringify({ 
            error: `Chatterbox server unavailable: ${e}`,
            retryable: true,
            status: 'error'
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'chatterbox_library') {
      console.log('[CHATTERBOX] Fetching avatar library');
      
      try {
        const response = await fetch(`${dynamicChatterboxBase}/api/library/list`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[CHATTERBOX] Library fetch failed: ${response.status} - ${errorText}`);
          return new Response(
            JSON.stringify({ error: `Library fetch failed: ${errorText}`, status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const data = await response.json();
        console.log('[CHATTERBOX] Library response:', data);
        
        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[CHATTERBOX] Library error:', e);
        return new Response(
          JSON.stringify({ error: `Chatterbox library error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== REGENERATION STATUS ENDPOINTS ==========
    
    // Get avatar generation status for a job
    if (action === 'avatar_regen_status') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[REGEN STATUS] Fetching avatar generation status for job: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);
      
      try {
        // Use dynamic API base for correct server routing
        const response = await fetch(`${dynamicApiBase}/job/${job_id}/avatar_status`);
        
        // Handle 404 as "idle" - no active avatar regeneration task
        if (response.status === 404) {
          console.log(`[REGEN STATUS] No active avatar regeneration task for job: ${job_id}`);
          return new Response(
            JSON.stringify({ 
              state: 'idle', 
              message: 'No active avatar regeneration task',
              details: null
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[REGEN STATUS] Avatar status fetch failed: ${response.status} - ${errorText}`);
          return new Response(
            JSON.stringify({ 
              state: 'error', 
              message: `Failed to fetch status: ${errorText}`,
              error: errorText 
            }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const data = await response.json();
        console.log('[REGEN STATUS] Avatar status response:', JSON.stringify(data));
        
        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[REGEN STATUS] Avatar status error:', e);
        return new Response(
          JSON.stringify({ state: 'error', message: `Status fetch error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get general job/regeneration status
    if (action === 'regen_job_status') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[REGEN STATUS] Fetching job regeneration status for: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);
      
      try {
        // Use dynamic API base for correct server routing
        const response = await fetch(`${dynamicApiBase}/job/${job_id}/status`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[REGEN STATUS] Job status fetch failed: ${response.status} - ${errorText}`);
          return new Response(
            JSON.stringify({ 
              status: 'error', 
              status_message: `Failed to fetch status: ${errorText}` 
            }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const data = await response.json();
        console.log('[REGEN STATUS] Job status response:', JSON.stringify(data));
        
        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[REGEN STATUS] Job status error:', e);
        return new Response(
          JSON.stringify({ status: 'error', status_message: `Status fetch error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== JOB DETAILS (Aggregated analytics) ==========
    if (action === 'job_details') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[JOB_DETAILS] Fetching aggregated details for job: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);

      try {
        // Fetch job status, analytics.json, and avatar_status.json in parallel using dynamic base
        const [statusResp, analyticsResp, avatarStatusResp] = await Promise.all([
          fetch(`${dynamicApiBase}/job/${job_id}/status`).catch(() => null),
          fetch(`${dynamicApiBase}/jobs/${job_id}/analytics.json`).catch(() => null),
          fetch(`${dynamicApiBase}/jobs/${job_id}/avatar_status.json`).catch(() => null),
        ]);

        // Parse job status
        let jobStatus = null;
        if (statusResp?.ok) {
          jobStatus = await statusResp.json().catch(() => null);
        }

        // Parse analytics.json (Manim/WAN counts)
        let analytics = null;
        if (analyticsResp?.ok) {
          analytics = await analyticsResp.json().catch(() => null);
        }

        // Parse avatar_status.json
        let avatarStatus = null;
        if (avatarStatusResp?.ok) {
          avatarStatus = await avatarStatusResp.json().catch(() => null);
        }

        console.log(`[JOB_DETAILS] Status: ${jobStatus?.status}, Analytics: ${analytics ? 'found' : 'null'}, Avatar: ${avatarStatus ? 'found' : 'null'}`);

        return new Response(
          JSON.stringify({ jobStatus, analytics, avatarStatus }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[JOB_DETAILS] Error:', e);
        return new Response(
          JSON.stringify({ error: `Job details fetch error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== ANALYTICS (Manim/WAN counts) ==========
    if (action === 'analytics') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[ANALYTICS] Fetching analytics for job: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);

      try {
        // Use dynamic API base for correct server routing
        const response = await fetch(`${dynamicApiBase}/jobs/${job_id}/analytics.json`);
        
        if (!response.ok) {
          console.log(`[ANALYTICS] analytics.json not found or failed: ${response.status}`);
          return new Response(
            JSON.stringify({ error: 'Analytics not available', status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log('[ANALYTICS] Response:', JSON.stringify(data));

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[ANALYTICS] Error:', e);
        return new Response(
          JSON.stringify({ error: `Analytics fetch error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== AVATAR BULK STATUS ==========
    if (action === 'avatar_bulk_status') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[AVATAR_BULK_STATUS] Fetching avatar_status.json for job: ${job_id} on server: ${server_ip || DEFAULT_SERVER_IP}`);

      try {
        // Use dynamic API base for correct server routing
        const response = await fetch(`${dynamicApiBase}/jobs/${job_id}/avatar_status.json`);
        
        if (!response.ok) {
          console.log(`[AVATAR_BULK_STATUS] avatar_status.json not found: ${response.status}`);
          return new Response(
            JSON.stringify({ error: 'Avatar status not available', status: response.status }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log('[AVATAR_BULK_STATUS] Response:', JSON.stringify(data));

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[AVATAR_BULK_STATUS] Error:', e);
        return new Response(
          JSON.stringify({ error: `Avatar bulk status fetch error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // NOTE: Deprecated handlers removed (regenerate_failed_avatars, regenerate_avatar, regenerate_manim)
    // All regeneration now uses unified retry_phase endpoint

    // ========== V2.5 MULTI-LANGUAGE AVATAR GENERATION ==========
    // Uses the V2.5 Director Pipeline /job/{job_id}/generate_avatar endpoint
    // Generates avatars for all sections in specified languages - no text extraction needed
    if (action === 'multilang_generate_avatar') {
      const { job_id: avatarJobId, languages, speaker, target_sections, force_regenerate, server_ip } = body;
      
      if (!avatarJobId) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const serverIpToUse = server_ip || DEFAULT_SERVER_IP;
      const dynamicV25Base = `http://${serverIpToUse}:5005`;
      
      // Build payload matching V2.5 API spec
      const payload: Record<string, unknown> = {
        languages: languages || ['hi'],
        speaker: speaker || 'Sagar',
      };
      
      // Only include target_sections if provided (for specific section regeneration)
      if (target_sections && target_sections.length > 0) {
        payload.target_sections = target_sections;
      }
      
      // Only include force_regenerate if explicitly set to true
      if (force_regenerate === true) {
        payload.force_regenerate = true;
      }

      const fullUrl = `${dynamicV25Base}/job/${avatarJobId}/generate_avatar`;
      console.log(`[BULK_LANG] [EDGE_GENERATE] timestamp=${new Date().toISOString()}, jobId=${avatarJobId}, server=${serverIpToUse}, url=${fullUrl}`);
      console.log(`[BULK_LANG] [EDGE_GENERATE] payload=${JSON.stringify(payload)}`);
      
      try {
        // Cloud FTP check on the GPU side can take 10-25s on cold starts.
        // 60s prevents false-positive failures while the server verifies the job.
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(60000),
        });

        
        const responseText = await response.text();
        const responseHeaders = Object.fromEntries(response.headers.entries());
        console.log(`[BULK_LANG] [EDGE_GENERATE_RESPONSE] jobId=${avatarJobId}, httpStatus=${response.status}, headers=${JSON.stringify(responseHeaders)}`);
        console.log(`[BULK_LANG] [EDGE_GENERATE_BODY] jobId=${avatarJobId}, body=${responseText.slice(0, 1000)}`);
        
        if (!response.ok) {
          console.error(`[BULK_LANG] [EDGE_GENERATE_FAIL] jobId=${avatarJobId}, status=${response.status}, body=${responseText.slice(0, 500)}`);
          return new Response(
            JSON.stringify({ 
              error: `V2.5 API error: ${responseText}`, 
              status: response.status 
            }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { message: responseText };
        }
        
        console.log(`[BULK_LANG] [EDGE_GENERATE_OK] jobId=${avatarJobId}, parsedData=${JSON.stringify(data)}`);
        
        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (e) {
        console.error(`[BULK_LANG] [EDGE_GENERATE_EXCEPTION] jobId=${avatarJobId}, error=${e}`);
        return new Response(
          JSON.stringify({ error: `Multi-language avatar generation error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== V2.5 MULTI-LANGUAGE AVATAR STATUS ==========
    // Polls GET /job/{job_id}/status on port 5005 for avatar generation progress
    // Returns progress_details.avatar_generation for tracking completion
    if (action === 'multilang_avatar_status') {
      const { job_id: statusJobId, server_ip } = body;
      
      if (!statusJobId) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const serverIpToUse = server_ip || DEFAULT_SERVER_IP;
      const dynamicV25Base = `http://${serverIpToUse}:5005`;
      
      // Cloud Job API: dedicated endpoint that reports processing / completed /
      // interrupted / failed and persists across GPU container restarts.
      const statusUrl = `${dynamicV25Base}/job/${statusJobId}/avatar_status`;
      console.log(`[BULK_LANG] [EDGE_STATUS] timestamp=${new Date().toISOString()}, jobId=${statusJobId}, server=${serverIpToUse}, url=${statusUrl}`);
      
      try {
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        
        const responseText = await response.text();
        console.log(`[BULK_LANG] [EDGE_STATUS_RESPONSE] jobId=${statusJobId}, httpStatus=${response.status}, bodyLength=${responseText.length}`);
        console.log(`[BULK_LANG] [EDGE_STATUS_BODY] jobId=${statusJobId}, body=${responseText.slice(0, 1000)}`);
        
        if (!response.ok) {
          const isCloud = serverIpToUse === '204.12.237.78';
          const label = isCloud ? 'Cloud' : 'Normal';
          console.error(`[BULK_LANG] [EDGE_STATUS_FAIL] jobId=${statusJobId}, server=${serverIpToUse}, path=${isCloud ? 'cloud' : 'normal'}, status=${response.status}`);
          return new Response(
            JSON.stringify({
              error: `${label} avatar_status API error: ${responseText}`,
              status: response.status,
              state: response.status === 404 ? 'not_found' : 'unknown',
              // 404 is terminal only for cloud (FTP job truly gone). On normal
              // .4 it may be transient (job spinning up) — worker decides.
              terminal: isCloud && response.status === 404,
              server_path: isCloud ? 'cloud' : 'normal',
            }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { state: 'unknown', message: responseText };
        }
        
        // New Cloud Job schema: { state, source, progress, sections_done, sections_total, error }
        const state = String(data?.state ?? data?.status ?? 'processing').toLowerCase();
        const sectionsTotal = Number(data?.sections_total ?? 0) || 0;
        const sectionsDone = Number(data?.sections_done ?? 0) || 0;
        const errorMsg = data?.error ?? null;
        
        const result = {
          state,
          status: state, // legacy alias so existing callers keep working
          source: data?.source ?? null,
          total: sectionsTotal,
          completed: sectionsDone,
          progress: data?.progress ?? (sectionsTotal > 0 ? `${sectionsDone}/${sectionsTotal}` : null),
          message: errorMsg || '',
          error: errorMsg,
          raw: data,
        };
        
        const isTerminal =
          state === 'completed' ||
          state === 'failed' ||
          (sectionsTotal > 0 && sectionsDone >= sectionsTotal);
        console.log(`[BULK_LANG] [EDGE_STATUS_PARSED] jobId=${statusJobId}, state=${state}, progress=${sectionsDone}/${sectionsTotal}, isTerminal=${isTerminal}, error=${errorMsg ?? ''}`);
        
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

        
      } catch (e) {
        console.error(`[BULK_LANG] [EDGE_STATUS_EXCEPTION] jobId=${statusJobId}, error=${e}`);
        return new Response(
          JSON.stringify({ error: `Multi-language avatar status error: ${e}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== SAVE LANGUAGE AVATAR TO CDN ==========
    // Downloads completed avatar from Chatterbox and saves directly to local filesystem
    // Uses Deno file operations to write to /video/{jobId}/avatars/{language}/
    if (action === 'save_language_avatar_to_cdn') {
      const { task_id, external_job_id, section_id, language, server_ip } = body;
      
      if (!task_id || !external_job_id || section_id === undefined || !language) {
        return new Response(
          JSON.stringify({ error: 'task_id, external_job_id, section_id, and language are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[save_language_avatar_to_cdn] Saving: job=${external_job_id}, section=${section_id}, lang=${language}, task=${task_id}`);
      
      try {
        // 1. Download video from Chatterbox
        const chatterboxIp = server_ip || DEFAULT_SERVER_IP;
        const chatterboxUrl = `http://${chatterboxIp}:5004/outputs/final_${task_id}.mp4`;
        console.log(`[save_language_avatar_to_cdn] Fetching from Chatterbox: ${chatterboxUrl}`);
        
        const downloadResponse = await fetch(chatterboxUrl);
        if (!downloadResponse.ok) {
          throw new Error(`Chatterbox responded with ${downloadResponse.status}`);
        }
        
        const videoData = await downloadResponse.arrayBuffer();
        console.log(`[save_language_avatar_to_cdn] Downloaded ${videoData.byteLength} bytes`);
        
        // 2. Determine save path - unified under /avatars/ folder
        // English: /video/{jobId}/avatars/section_{n}_avatar.mp4
        // Other: /video/{jobId}/avatars/{language}/section_{n}_avatar.mp4
        const langLower = language.toLowerCase();
        const dirPath = langLower !== 'english' 
          ? `/video/${external_job_id}/avatars/${langLower}`
          : `/video/${external_job_id}/avatars`;
        
        const fileName = `section_${section_id}_avatar.mp4`;
        const fullPath = `${dirPath}/${fileName}`;
        
        console.log(`[save_language_avatar_to_cdn] Creating directory: ${dirPath}`);
        // 3. Create directory structure
        await Deno.mkdir(dirPath, { recursive: true });
        
        console.log(`[save_language_avatar_to_cdn] Writing file: ${fullPath}`);
        // 4. Write file to disk
        await Deno.writeFile(fullPath, new Uint8Array(videoData));
        
        console.log(`[save_language_avatar_to_cdn] Avatar saved successfully: ${fullPath}`);
        
        // 5. Return success with file details
        return new Response(
          JSON.stringify({
            success: true,
            file_path: fullPath,
            size_bytes: videoData.byteLength,
            saved_at: new Date().toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (e) {
        console.error(`[save_language_avatar_to_cdn] Error saving avatar:`, e);
        return new Response(
          JSON.stringify({
            success: false,
            error: e instanceof Error ? e.message : 'Unknown error',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "submit", "status", "list_jobs", "generate_avatar", "avatar_status", "review", "sanity_check", "repair_urls", "stitch_assets", "repair_missing_assets", "retry_phase", "rerender", "regenerate_and_render", "avatar_regen_status", "regen_job_status", "regenerate_with_feedback", "submit_review", "recreate_from_review", "chatterbox_generate", "chatterbox_status", "chatterbox_library", "job_details", "analytics", "avatar_bulk_status", "multilang_generate_avatar", "multilang_avatar_status", or "save_language_avatar_to_cdn"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
