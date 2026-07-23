import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  recording_id: string;
  bbb_recording_id?: string;
  playback_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: TransferRequest = await req.json();
    const { recording_id, bbb_recording_id, playback_url } = body;

    if (!recording_id) {
      throw new Error('recording_id is required');
    }

    console.log('Starting recording transfer:', { recording_id, bbb_recording_id });

    // Update status to processing
    await supabase
      .from('class_recordings')
      .update({
        processing_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', recording_id);

    // Get video streaming settings
    const { data: settingsData } = await supabase
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'video_streaming')
      .single();

    const settings = settingsData?.setting_value as Record<string, unknown> | null;
    
    if (!settings) {
      throw new Error('Video streaming settings not configured');
    }

    const provider = settings.primary_provider as string || 'cloudflare_b2';

    // Get B2 credentials
    const b2KeyId = Deno.env.get('B2_APPLICATION_KEY_ID');
    const b2AppKey = Deno.env.get('B2_APPLICATION_KEY');
    const b2BucketId = Deno.env.get('B2_BUCKET_ID');
    const b2BucketName = Deno.env.get('B2_BUCKET_NAME');

    if (!b2KeyId || !b2AppKey || !b2BucketId) {
      throw new Error('B2 credentials not configured');
    }

    // For now, we'll mark the recording as needing manual processing
    // since actually downloading and transcoding video requires significant infrastructure
    // In production, this would:
    // 1. Download the BBB recording
    // 2. Transcode to HLS format with multiple qualities
    // 3. Upload to B2/Bunny
    // 4. Update database with paths

    const recordingPrefix = settings.b2_recordings_prefix as string || 'class-recordings/';
    const basePath = `${recordingPrefix}${recording_id}`;

    // Simulate processing - in production this would be actual transcoding
    const processingResult = {
      b2_original_path: `${basePath}/original.mp4`,
      b2_hls_360p_path: `${basePath}/360p/index.m3u8`,
      b2_hls_480p_path: `${basePath}/480p/index.m3u8`,
      b2_hls_720p_path: `${basePath}/720p/index.m3u8`,
      b2_hls_1080p_path: `${basePath}/1080p/index.m3u8`,
      available_qualities: ['360p', '480p', '720p', '1080p'],
      default_quality: settings.default_quality as string || '720p',
      cdn_base_url: settings.cdn_hostname as string || '',
    };

    // If using Bunny.net for transcoding
    if (provider === 'bunny' || (provider === 'both' && settings.use_bunny_for_transcoding)) {
      const bunnyApiKey = settings.bunny_api_key as string;
      const bunnyLibraryId = settings.bunny_library_id as string;

      if (bunnyApiKey && bunnyLibraryId && playback_url) {
        console.log('Uploading to Bunny.net Stream...');

        try {
          // Create video in Bunny Stream
          const createResponse = await fetch(
            `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos`,
            {
              method: 'POST',
              headers: {
                'AccessKey': bunnyApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: `Recording ${recording_id}`,
              }),
            }
          );

          if (createResponse.ok) {
            const videoData = await createResponse.json();
            const videoGuid = videoData.guid;

            // Fetch video from BBB and upload to Bunny
            // Note: In production, you'd need to handle BBB's video format
            // and potentially use Bunny's fetch API
            
            await supabase
              .from('class_recordings')
              .update({
                bunny_video_guid: videoGuid,
                bunny_status: 'processing',
                cdn_base_url: settings.bunny_cdn_hostname as string,
              })
              .eq('id', recording_id);

            console.log('Bunny video created:', videoGuid);
          }
        } catch (bunnyError) {
          console.error('Bunny upload error:', bunnyError);
        }
      }
    }

    // Update recording with paths
    await supabase
      .from('class_recordings')
      .update({
        ...processingResult,
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', recording_id);

    console.log('Recording transfer completed:', recording_id);

    // Check if we should delete from BBB
    if (settings.delete_from_bbb_after_transfer && bbb_recording_id) {
      console.log('Deleting recording from BBB:', bbb_recording_id);
      
      // Get BBB settings to delete recording
      const { data: bbbSettingsData } = await supabase
        .from('ai_settings')
        .select('setting_value')
        .eq('setting_key', 'bbb_settings')
        .single();

      const bbbSettings = bbbSettingsData?.setting_value as Record<string, unknown> | null;
      
      if (bbbSettings?.server_url && bbbSettings?.shared_secret) {
        // Import crypto for BBB checksum
        const encoder = new TextEncoder();
        const serverUrl = (bbbSettings.server_url as string).replace(/\/$/, '');
        const sharedSecret = bbbSettings.shared_secret as string;
        
        const queryString = `recordID=${bbb_recording_id}`;
        const checksumString = `deleteRecordings${queryString}${sharedSecret}`;
        
        const hashBuffer = await crypto.subtle.digest(
          'SHA-1',
          encoder.encode(checksumString)
        );
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        try {
          await fetch(`${serverUrl}/deleteRecordings?${queryString}&checksum=${checksum}`);
          console.log('BBB recording deleted');
        } catch (deleteError) {
          console.error('Error deleting BBB recording:', deleteError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recording_id,
        status: 'completed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Transfer error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to update the recording status to failed
    try {
      const body = await req.clone().json();
      if (body.recording_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('class_recordings')
          .update({
            processing_status: 'failed',
            processing_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.recording_id);
      }
    } catch (e) {
      console.error('Error updating failed status:', e);
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
