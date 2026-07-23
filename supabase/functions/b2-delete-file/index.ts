import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { fileName, fileId } = await req.json();
    console.log('Delete request:', { fileName, fileId });

    if (!fileName || !fileId) {
      throw new Error('fileName and fileId are required');
    }

    // Get B2 credentials
    const B2_KEY_ID = Deno.env.get('B2_KEY_ID');
    const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY');

    if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
      throw new Error('B2 credentials not configured');
    }

    // Authorize with B2
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
      }
    });

    if (!authResponse.ok) {
      throw new Error(`B2 authorization failed: ${await authResponse.text()}`);
    }

    const authData = await authResponse.json();

    // Delete file from B2
    const deleteResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_delete_file_version`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        fileId
      })
    });

    if (!deleteResponse.ok) {
      throw new Error(`B2 delete failed: ${await deleteResponse.text()}`);
    }

    console.log('File deleted from B2');

    // Delete metadata from database
    const { error: dbError } = await supabase
      .from('storage_files')
      .delete()
      .eq('b2_file_id', fileId);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      throw new Error(`Failed to delete file metadata: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'File deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in b2-delete-file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Delete failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
