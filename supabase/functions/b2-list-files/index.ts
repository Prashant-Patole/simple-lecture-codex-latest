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

    const { prefix = '', delimiter = '/' } = await req.json();
    console.log('List files request:', { prefix, delimiter });

    // Get B2 credentials
    const B2_KEY_ID = Deno.env.get('B2_KEY_ID');
    const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY');
    const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID');

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID) {
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

    // List files from B2
    const listResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_file_names`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: B2_BUCKET_ID,
        prefix,
        delimiter,
        maxFileCount: 1000
      })
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${await listResponse.text()}`);
    }

    const listData = await listResponse.json();
    console.log(`Found ${listData.files.length} files and ${(listData.folders || []).length} folders`);

    // Get metadata from database
    const filePaths = listData.files.map((f: any) => f.fileName);
    let fileMetadata = [];

    if (filePaths.length > 0) {
      const { data: metaData } = await supabase
        .from('storage_files')
        .select('*')
        .in('file_path', filePaths);
      
      fileMetadata = metaData || [];
    }

    // Enrich files with metadata and properly encode download URLs
    const enrichedFiles = listData.files.map((file: any) => {
      const meta = fileMetadata.find((m: any) => m.file_path === file.fileName);
      
      // Encode file path for download URL (encode each segment to preserve folder structure)
      const encodedFileName = file.fileName
        .split('/')
        .map((segment: string) => encodeURIComponent(segment))
        .join('/');
      
      return {
        ...file,
        downloadUrl: `${authData.downloadUrl}/file/${Deno.env.get('B2_BUCKET_NAME')}/${encodedFileName}`,
        metadata: meta || null
      };
    });

    // Folders (prefixes)
    const folders = (listData.folders || []).map((folder: string) => ({
      name: folder,
      isFolder: true
    }));

    return new Response(
      JSON.stringify({
        files: enrichedFiles,
        folders,
        nextFileName: listData.nextFileName || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in b2-list-files:', error);
    const errorMessage = error instanceof Error ? error.message : 'List files failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
