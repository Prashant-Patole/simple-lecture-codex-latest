import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to authorize with B2 and get download URL
async function getB2DownloadAuth(filePath: string, bucketName: string): Promise<string | null> {
  try {
    const keyId = Deno.env.get('B2_KEY_ID');
    const appKey = Deno.env.get('B2_APPLICATION_KEY');
    
    if (!keyId || !appKey) {
      console.error('B2 credentials not configured');
      return null;
    }

    // Authorize with B2
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: {
        Authorization: 'Basic ' + btoa(`${keyId}:${appKey}`)
      }
    });

    if (!authResponse.ok) {
      console.error('B2 auth failed:', await authResponse.text());
      return null;
    }

    const authData = await authResponse.json();
    const downloadUrl = `${authData.downloadUrl}/file/${bucketName}/${filePath}`;
    
    // Get download authorization token
    const downloadAuthResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        Authorization: authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: Deno.env.get('B2_BUCKET_ID'),
        fileNamePrefix: filePath,
        validDurationInSeconds: 3600 // 1 hour
      })
    });

    if (!downloadAuthResponse.ok) {
      console.error('B2 download auth failed:', await downloadAuthResponse.text());
      // Return unsigned URL as fallback
      return downloadUrl;
    }

    const downloadAuth = await downloadAuthResponse.json();
    return `${downloadUrl}?Authorization=${downloadAuth.authorizationToken}`;
  } catch (err) {
    console.error('B2 auth error:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, ...params } = await req.json();
    console.log('Streaming API action:', action, params);

    switch (action) {
      case 'get-playback-url': {
        const { recording_id, quality = '720p' } = params;
        
        // Get recording details
        const { data: recording, error } = await supabase
          .from('class_recordings')
          .select('*')
          .eq('id', recording_id)
          .single();

        if (error || !recording) {
          throw new Error('Recording not found');
        }

        // Get video settings
        const { data: settings } = await supabase
          .from('ai_settings')
          .select('setting_value')
          .eq('setting_key', 'video_streaming')
          .maybeSingle();

        const videoSettings = settings?.setting_value as Record<string, any> || {};
        const cdnHostname = videoSettings.cdn_hostname || '';
        const bucketName = Deno.env.get('B2_BUCKET_NAME') || videoSettings.b2_recordings_bucket || 'class-recordings';
        
        // Build HLS URL based on quality
        const qualityPaths: Record<string, string | null> = {
          '360p': recording.b2_hls_360p_path,
          '480p': recording.b2_hls_480p_path,
          '720p': recording.b2_hls_720p_path,
          '1080p': recording.b2_hls_1080p_path,
        };

        const selectedPath = qualityPaths[quality] || recording.b2_hls_720p_path;
        
        // Check if HLS is available
        const hasHls = selectedPath || recording.bunny_video_guid;
        
        // Generate CDN URL (Cloudflare + B2)
        let hlsUrl: string | null = null;
        if (cdnHostname && selectedPath) {
          hlsUrl = `https://${cdnHostname}/${selectedPath}`;
        } else if (recording.bunny_video_guid && videoSettings.bunny_cdn_hostname) {
          hlsUrl = `https://${videoSettings.bunny_cdn_hostname}/${recording.bunny_video_guid}/playlist.m3u8`;
        }

        // Direct URL for original file
        let directUrl: string | null = null;
        if (recording.b2_original_path) {
          // If CDN hostname is configured, use CDN for instant playback (like YouTube)
          if (cdnHostname) {
            // CDN URL - served from Cloudflare edge, instant playback
            directUrl = `https://${cdnHostname}/file/${bucketName}/${recording.b2_original_path}`;
            console.log('Using CDN URL for instant playback:', directUrl);
          } else {
            // Fallback to B2 signed URL (slower, direct from origin)
            console.log('No CDN configured, generating direct B2 URL for:', recording.b2_original_path);
            directUrl = await getB2DownloadAuth(recording.b2_original_path, bucketName);
          }
        }

        return new Response(JSON.stringify({
          hlsUrl,
          directUrl,
          quality: hasHls ? quality : 'original',
          availableQualities: hasHls ? (recording.available_qualities || ['360p', '480p', '720p', '1080p']) : ['original'],
          duration: recording.duration_seconds,
          expiresAt: Date.now() + 3600000, // 1 hour
          usingCdn: !!cdnHostname, // Let client know if CDN is active
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list-recordings': {
        const { course_id, limit = 50 } = params;
        
        let query = supabase
          .from('class_recordings')
          .select(`
            id,
            duration_seconds,
            available_qualities,
            default_quality,
            processing_status,
            created_at,
            scheduled_class:scheduled_classes(
              id,
              subject,
              scheduled_at,
              course:courses(id, name)
            )
          `)
          .eq('processing_status', 'ready')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (course_id) {
          query = query.eq('scheduled_class.course_id', course_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ recordings: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'report-quality': {
        const { recording_id, user_id, metrics } = params;
        
        await supabase.from('network_quality_logs').insert({
          recording_id,
          user_id,
          connection_type: metrics.connectionType,
          effective_bandwidth_mbps: metrics.bandwidth,
          latency_ms: metrics.latency,
          initial_quality: metrics.initialQuality,
          adapted_to_quality: metrics.currentQuality,
          buffer_events: metrics.bufferEvents || 0,
        });

        // Recommend quality based on bandwidth
        let recommendedQuality = '720p';
        if (metrics.bandwidth >= 5) recommendedQuality = '1080p';
        else if (metrics.bandwidth >= 2.5) recommendedQuality = '720p';
        else if (metrics.bandwidth >= 1) recommendedQuality = '480p';
        else recommendedQuality = '360p';

        return new Response(JSON.stringify({ recommendedQuality }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'test-cloudflare': {
        // Test Cloudflare connection (placeholder)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    console.error('Streaming API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
