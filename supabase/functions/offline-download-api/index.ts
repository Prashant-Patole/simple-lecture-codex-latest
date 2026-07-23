import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    const { action, ...params } = await req.json();
    console.log('Offline download API:', action, params);

    switch (action) {
      case 'request': {
        const { recording_id, quality, device_id } = params;

        // Check max downloads
        const { data: settings } = await supabase
          .from('ai_settings')
          .select('setting_value')
          .eq('setting_key', 'video_streaming')
          .maybeSingle();

        const videoSettings = settings?.setting_value as Record<string, any> || {};
        const maxDownloads = videoSettings.max_downloads_per_user || 10;
        const expiryDays = videoSettings.offline_download_expiry_days || 30;

        // Count existing downloads
        const { count } = await supabase
          .from('offline_downloads')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_revoked', false);

        if ((count || 0) >= maxDownloads) {
          throw new Error(`Maximum ${maxDownloads} offline downloads reached`);
        }

        // Get recording
        const { data: recording, error: recError } = await supabase
          .from('class_recordings')
          .select('*')
          .eq('id', recording_id)
          .single();

        if (recError || !recording) {
          throw new Error('Recording not found');
        }

        // Generate encryption key
        const encryptionKey = crypto.randomUUID() + crypto.randomUUID();
        const iv = crypto.randomUUID().replace(/-/g, '').substring(0, 32);

        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        // Create download record
        const { data: download, error: insertError } = await supabase
          .from('offline_downloads')
          .upsert({
            recording_id,
            user_id: user.id,
            device_id,
            quality,
            encryption_key_encrypted: encryptionKey, // In production, encrypt with device public key
            encryption_iv: iv,
            file_size_bytes: recording.file_size_bytes,
            download_status: 'ready',
            expires_at: expiresAt.toISOString(),
          }, {
            onConflict: 'recording_id,user_id,device_id',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Generate download URL (B2 encrypted path)
        const downloadUrl = recording.b2_encrypted_path 
          ? `https://f005.backblazeb2.com/file/${videoSettings.b2_recordings_bucket || 'recordings'}/${recording.b2_encrypted_path}`
          : null;

        return new Response(JSON.stringify({
          downloadId: download.id,
          downloadUrl,
          encryptedKey: encryptionKey,
          iv,
          fileSize: recording.file_size_bytes,
          expiresAt: expiresAt.getTime(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list': {
        const { device_id } = params;

        const { data, error } = await supabase
          .from('offline_downloads')
          .select(`
            *,
            recording:class_recordings(
              id,
              original_filename,
              duration_seconds,
              scheduled_class:scheduled_classes(subject, course:courses(name))
            )
          `)
          .eq('user_id', user.id)
          .eq('is_revoked', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ downloads: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'complete': {
        const { download_id } = params;

        await supabase
          .from('offline_downloads')
          .update({
            download_status: 'completed',
            downloaded_at: new Date().toISOString(),
          })
          .eq('id', download_id)
          .eq('user_id', user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'revoke': {
        const { download_id, reason } = params;

        await supabase
          .from('offline_downloads')
          .update({
            is_revoked: true,
            revoked_at: new Date().toISOString(),
            revoked_reason: reason || 'User requested',
          })
          .eq('id', download_id)
          .eq('user_id', user.id);

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
    console.error('Offline download API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
