import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SHA-1 hash for BBB checksum
async function sha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate BBB API checksum
async function generateChecksum(apiCall: string, queryString: string, secret: string): Promise<string> {
  const data = apiCall + queryString + secret;
  return await sha1(data);
}

// Build URL with checksum
async function buildBBBUrl(serverUrl: string, apiCall: string, params: Record<string, string>, secret: string): Promise<string> {
  const queryString = new URLSearchParams(params).toString();
  const checksum = await generateChecksum(apiCall, queryString, secret);
  return `${serverUrl}/${apiCall}?${queryString}&checksum=${checksum}`;
}

// Parse XML response from BBB
function parseXMLValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function parseXMLBoolean(xml: string, tag: string): boolean {
  const value = parseXMLValue(xml, tag);
  return value?.toLowerCase() === 'true';
}

// Get BBB settings from database
async function getBBBSettings(supabase: any, overrideUrl?: string, overrideSecret?: string) {
  if (overrideUrl && overrideSecret) {
    return { server_url: overrideUrl, shared_secret: overrideSecret };
  }

  const { data, error } = await supabase
    .from('ai_settings')
    .select('setting_value')
    .eq('setting_key', 'bigbluebutton')
    .maybeSingle();

  if (error || !data) {
    throw new Error('BigBlueButton is not configured. Please configure it in Admin Settings.');
  }

  const settings = data.setting_value;
  if (!settings.enabled || !settings.server_url || !settings.shared_secret) {
    throw new Error('BigBlueButton is not enabled or missing configuration.');
  }

  return {
    server_url: settings.server_url.replace(/\/$/, ''), // Remove trailing slash
    shared_secret: settings.shared_secret,
    ...settings,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, scheduled_class_id, server_url, shared_secret, ...params } = body;

    console.log(`BBB API action: ${action}`, { scheduled_class_id });

    // Handle test connection separately
    if (action === 'test-connection') {
      if (!server_url || !shared_secret) {
        throw new Error('Server URL and shared secret are required for testing connection');
      }

      const testUrl = await buildBBBUrl(server_url, 'getMeetings', {}, shared_secret);
      console.log('Testing connection to:', testUrl);
      
      const response = await fetch(testUrl);
      const xml = await response.text();
      
      const returncode = parseXMLValue(xml, 'returncode');
      if (returncode !== 'SUCCESS') {
        throw new Error('Failed to connect to BigBlueButton server. Please check your credentials.');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get settings from database
    const settings = await getBBBSettings(supabase, server_url, shared_secret);
    const baseUrl = settings.server_url;
    const secret = settings.shared_secret;

    switch (action) {
      case 'create': {
        // Get scheduled class info
        const { data: classData, error: classError } = await supabase
          .from('scheduled_classes')
          .select('*, popular_subjects(name), courses(name)')
          .eq('id', scheduled_class_id)
          .single();

        if (classError) throw new Error('Scheduled class not found');

        const meetingId = `class-${scheduled_class_id}`;
        const attendeePW = crypto.randomUUID().slice(0, 8);
        const moderatorPW = crypto.randomUUID().slice(0, 8);
        const meetingName = params.meeting_name || classData.popular_subjects?.name || 'Class Session';

        const createParams: Record<string, string> = {
          meetingID: meetingId,
          name: meetingName,
          attendeePW: attendeePW,
          moderatorPW: moderatorPW,
          welcome: params.welcome_message || settings.default_welcome_message || 'Welcome to the class!',
          record: String(params.record ?? settings.allow_recording ?? true),
          autoStartRecording: String(params.auto_start_recording ?? settings.auto_start_recording ?? false),
          muteOnStart: String(settings.mute_on_start ?? true),
          allowModsToUnmuteUsers: String(settings.allow_mods_to_unmute_users ?? true),
        };

        if (settings.default_logout_url) {
          createParams.logoutURL = settings.default_logout_url;
        }

        const createUrl = await buildBBBUrl(baseUrl, 'create', createParams, secret);
        console.log('Creating meeting:', meetingId);

        const response = await fetch(createUrl);
        const xml = await response.text();
        console.log('Create response:', xml);

        const returncode = parseXMLValue(xml, 'returncode');
        if (returncode !== 'SUCCESS') {
          const message = parseXMLValue(xml, 'message') || 'Failed to create meeting';
          throw new Error(message);
        }

        const internalMeetingId = parseXMLValue(xml, 'internalMeetingID');

        // Update scheduled class with BBB info and set is_live
        await supabase
          .from('scheduled_classes')
          .update({
            bbb_meeting_id: meetingId,
            bbb_internal_meeting_id: internalMeetingId,
            bbb_attendee_pw: attendeePW,
            bbb_moderator_pw: moderatorPW,
            is_live: true,
            live_started_at: new Date().toISOString(),
          })
          .eq('id', scheduled_class_id);

        return new Response(JSON.stringify({
          success: true,
          meetingId,
          internalMeetingId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'join': {
        const { data: classData, error: classError } = await supabase
          .from('scheduled_classes')
          .select('bbb_meeting_id, bbb_attendee_pw, bbb_moderator_pw')
          .eq('id', scheduled_class_id)
          .single();

        if (classError || !classData?.bbb_meeting_id) {
          throw new Error('Meeting not found. Please ask the instructor to start the meeting.');
        }

        const password = params.role === 'moderator' ? classData.bbb_moderator_pw : classData.bbb_attendee_pw;
        
        const joinParams: Record<string, string> = {
          meetingID: classData.bbb_meeting_id,
          fullName: params.full_name || 'Guest',
          password: password,
          redirect: 'true',
        };

        const joinUrl = await buildBBBUrl(baseUrl, 'join', joinParams, secret);

        return new Response(JSON.stringify({ joinUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'end': {
        const { data: classData } = await supabase
          .from('scheduled_classes')
          .select('bbb_meeting_id, bbb_moderator_pw')
          .eq('id', scheduled_class_id)
          .single();

        if (!classData?.bbb_meeting_id) {
          throw new Error('Meeting not found');
        }

        const endParams: Record<string, string> = {
          meetingID: classData.bbb_meeting_id,
          password: classData.bbb_moderator_pw,
        };

        const endUrl = await buildBBBUrl(baseUrl, 'end', endParams, secret);
        const response = await fetch(endUrl);
        const xml = await response.text();
        console.log('End meeting response:', xml);

        // Update scheduled class
        await supabase
          .from('scheduled_classes')
          .update({
            is_live: false,
            live_ended_at: new Date().toISOString(),
          })
          .eq('id', scheduled_class_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'info': {
        const { data: classData } = await supabase
          .from('scheduled_classes')
          .select('bbb_meeting_id')
          .eq('id', scheduled_class_id)
          .single();

        if (!classData?.bbb_meeting_id) {
          return new Response(JSON.stringify({ running: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const infoParams: Record<string, string> = {
          meetingID: classData.bbb_meeting_id,
        };

        const infoUrl = await buildBBBUrl(baseUrl, 'getMeetingInfo', infoParams, secret);
        const response = await fetch(infoUrl);
        const xml = await response.text();

        const running = parseXMLBoolean(xml, 'running');
        const participantCount = parseInt(parseXMLValue(xml, 'participantCount') || '0');
        const moderatorCount = parseInt(parseXMLValue(xml, 'moderatorCount') || '0');
        const startTime = parseXMLValue(xml, 'startTime');
        const recording = parseXMLBoolean(xml, 'recording');

        return new Response(JSON.stringify({
          running,
          participantCount,
          moderatorCount,
          attendeeCount: participantCount - moderatorCount,
          startTime,
          recording,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'recordings': {
        const { data: classData } = await supabase
          .from('scheduled_classes')
          .select('bbb_meeting_id')
          .eq('id', scheduled_class_id)
          .single();

        if (!classData?.bbb_meeting_id) {
          return new Response(JSON.stringify({ recordings: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const recordingsParams: Record<string, string> = {
          meetingID: classData.bbb_meeting_id,
        };

        const recordingsUrl = await buildBBBUrl(baseUrl, 'getRecordings', recordingsParams, secret);
        const response = await fetch(recordingsUrl);
        const xml = await response.text();

        // Parse recordings from XML (simplified)
        const recordings: any[] = [];
        const recordingMatches = xml.match(/<recording>([\s\S]*?)<\/recording>/g) || [];
        
        for (const recordingXml of recordingMatches) {
          recordings.push({
            recordID: parseXMLValue(recordingXml, 'recordID'),
            meetingID: parseXMLValue(recordingXml, 'meetingID'),
            name: parseXMLValue(recordingXml, 'name'),
            startTime: parseXMLValue(recordingXml, 'startTime'),
            endTime: parseXMLValue(recordingXml, 'endTime'),
            playbackUrl: recordingXml.match(/<url>([^<]*)<\/url>/)?.[1] || null,
          });
        }

        return new Response(JSON.stringify({ recordings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error('BBB API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
