import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DatalabResponse {
  request_id: string;
  status: string;
  markdown?: string;
  json?: any;
  images?: Record<string, string>;
  page_count?: number;
  metadata?: {
    pages?: number;
    ocr_stats?: any;
  };
}

// Helper function to get B2 signed download URL
async function getB2DownloadUrl(filePath: string): Promise<string> {
  const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
  const B2_APP_KEY = Deno.env.get("B2_APPLICATION_KEY");
  const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME") || "Simplelecture";
  
  if (!B2_KEY_ID || !B2_APP_KEY) {
    throw new Error("B2 credentials not configured");
  }
  
  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    method: "GET",
    headers: {
      Authorization: "Basic " + btoa(`${B2_KEY_ID}:${B2_APP_KEY}`),
    },
  });
  
  if (!authResponse.ok) {
    throw new Error("Failed to authorize with B2");
  }
  
  const authData = await authResponse.json();
  const { authorizationToken, apiUrl, downloadUrl } = authData;
  
  const downloadAuthResponse = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: Deno.env.get("B2_BUCKET_ID"),
      fileNamePrefix: filePath,
      validDurationInSeconds: 3600,
    }),
  });
  
  if (!downloadAuthResponse.ok) {
    throw new Error("Failed to get B2 download authorization");
  }
  
  const downloadAuthData = await downloadAuthResponse.json();
  const signedUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${filePath}?Authorization=${downloadAuthData.authorizationToken}`;
  
  return signedUrl;
}

// Upload base64 image directly to Backblaze B2
async function uploadImageToB2(
  base64Data: string,
  imageName: string,
  requestId: string
): Promise<{ b2Path: string } | null> {
  try {
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    
    let contentType = 'image/png';
    let extension = 'png';
    
    if (base64Data.includes('data:image/jpeg') || base64Data.includes('data:image/jpg')) {
      contentType = 'image/jpeg';
      extension = 'jpg';
    } else if (base64Data.includes('data:image/webp')) {
      contentType = 'image/webp';
      extension = 'webp';
    }
    
    const binaryStr = atob(base64Clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
    const B2_APP_KEY = Deno.env.get("B2_APPLICATION_KEY");
    const B2_BUCKET_ID = Deno.env.get("B2_BUCKET_ID");
    
    if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID) {
      console.error("B2 credentials not configured, skipping B2 upload");
      return null;
    }
    
    // Authorize with B2
    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      method: "GET",
      headers: {
        Authorization: "Basic " + btoa(`${B2_KEY_ID}:${B2_APP_KEY}`),
      },
    });
    
    if (!authResponse.ok) {
      console.error("B2 auth failed:", await authResponse.text());
      return null;
    }
    
    const authData = await authResponse.json();
    
    // Get upload URL
    const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
    });
    
    if (!uploadUrlResponse.ok) {
      console.error("B2 get upload URL failed:", await uploadUrlResponse.text());
      return null;
    }
    
    const uploadUrlData = await uploadUrlResponse.json();
    
    // Calculate SHA1
    const hashBuffer = await crypto.subtle.digest("SHA-1", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    const safeImageName = imageName.includes('.') ? imageName : `${imageName}.${extension}`;
    const b2FilePath = `question-images/extracted/${requestId}/${safeImageName}`;
    const encodedPath = b2FilePath.split('/').map(s => encodeURIComponent(s)).join('/');
    
    // Upload to B2
    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadUrlData.authorizationToken,
        "X-Bz-File-Name": encodedPath,
        "Content-Type": contentType,
        "Content-Length": bytes.length.toString(),
        "X-Bz-Content-Sha1": sha1Hash,
      },
      body: bytes,
    });
    
    if (!uploadResponse.ok) {
      console.error(`B2 upload failed for ${imageName}:`, await uploadResponse.text());
      return null;
    }
    
    const uploadResult = await uploadResponse.json();
    console.log(`Uploaded ${imageName} to B2: ${uploadResult.fileId}`);
    
    return { b2Path: b2FilePath };
  } catch (error) {
    console.error(`Error uploading image ${imageName} to B2:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DATALAB_API_KEY = Deno.env.get("DATALAB_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!DATALAB_API_KEY) {
      throw new Error("DATALAB_API_KEY is not configured");
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this is a poll request (GET with request_id query param)
    const url = new URL(req.url);
    const pollRequestId = url.searchParams.get("request_id");
    
    if (pollRequestId) {
      // POLLING MODE: Check status of existing request
      const skipImages = url.searchParams.get("skip_images") === "true";
      console.log(`Polling status for request: ${pollRequestId}, skipImages: ${skipImages}`);
      
      const statusResponse = await fetch(`https://www.datalab.to/api/v1/marker/${pollRequestId}`, {
        method: "GET",
        headers: { "X-API-Key": DATALAB_API_KEY },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error("Status check failed:", statusResponse.status, errorText);
        return new Response(
          JSON.stringify({ status: "error", message: "Failed to check status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result: DatalabResponse = await statusResponse.json();
      console.log("Poll result status:", result.status);

      if (result.status === "complete") {
        const pageCount = result.page_count ?? result.metadata?.pages ?? 0;
        
        // Upload images to B2 storage (skip if skip_images=true for faster PYQ extraction)
        const imageUrls: Record<string, string> = {};
        const uploadedImages: { b2Path: string; pageNumber: number; name: string }[] = [];
        
        if (!skipImages && result.images && Object.keys(result.images).length > 0) {
          console.log("Uploading extracted images to B2...");
          const imageEntries = Object.entries(result.images);
          for (let i = 0; i < imageEntries.length; i++) {
            const [imageName, base64Data] = imageEntries[i];
            const b2Result = await uploadImageToB2(base64Data, imageName, pollRequestId);
            if (b2Result) {
              imageUrls[imageName] = b2Result.b2Path;
              uploadedImages.push({ b2Path: b2Result.b2Path, pageNumber: i + 1, name: imageName });
            }
          }

          // Register uploaded images in the question_images lookup table with B2 paths
          if (uploadedImages.length > 0) {
            const imageRows = uploadedImages.map(img => ({
              original_filename: img.name.includes('.') ? img.name : `${img.name}.png`,
              storage_path: img.b2Path,
              public_url: img.b2Path,
              datalab_request_id: pollRequestId,
            }));
            
            const { error: imgError } = await supabase
              .from("question_images")
              .upsert(imageRows, { onConflict: "storage_path", ignoreDuplicates: true });
            
            if (imgError) console.error("Failed to register images in lookup table:", imgError);
            else console.log(`Registered ${imageRows.length} images in question_images table (B2 paths)`);
          }
        } else if (skipImages) {
          console.log("Skipping image uploads (skip_images=true)");
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: "complete",
            request_id: pollRequestId,
            content_json: result.json || null,
            content_markdown: result.markdown || null,
            images: imageUrls,
            uploaded_images: uploadedImages,
            metadata: { pages: pageCount, ocr_stats: result.metadata?.ocr_stats || null },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (result.status === "failed") {
        return new Response(
          JSON.stringify({ success: false, status: "failed", message: "Processing failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Still processing
        return new Response(
          JSON.stringify({ success: true, status: result.status, request_id: pollRequestId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // SUBMIT MODE: Start new processing job (requires POST with FormData)
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST with file/pdf_url or GET with request_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    let pdfUrl = formData.get("pdf_url") as string | null;

    if (!file && !pdfUrl) {
      return new Response(
        JSON.stringify({ error: "Either file or pdf_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting PDF parsing with Datalab Marker API...");
    console.log("File:", file?.name, "Size:", file?.size);

    // If pdfUrl is a relative B2 path, get signed URL
    if (pdfUrl && !pdfUrl.startsWith("http")) {
      console.log("Converting B2 path to signed URL...");
      pdfUrl = await getB2DownloadUrl(pdfUrl);
    }

    const datalabFormData = new FormData();
    
    if (file) {
      datalabFormData.append("file", file, file.name);
    } else if (pdfUrl) {
      datalabFormData.append("file_url", pdfUrl);
    }

    datalabFormData.append("output_format", "markdown");
    datalabFormData.append("force_ocr", "true");
    datalabFormData.append("paginate_output", "false");
    datalabFormData.append("skip_cache", "true");

    console.log("Submitting to Datalab Marker API...");
    const submitResponse = await fetch("https://www.datalab.to/api/v1/marker", {
      method: "POST",
      headers: { "X-API-Key": DATALAB_API_KEY },
      body: datalabFormData,
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error("Datalab submit error:", submitResponse.status, errorText);
      throw new Error(`Datalab API error: ${submitResponse.status} - ${errorText}`);
    }

    const submitResult = await submitResponse.json();
    const requestId = submitResult.request_id;
    console.log("Datalab request submitted, ID:", requestId);

    if (!requestId) {
      throw new Error("No request_id received from Datalab");
    }

    // Return immediately with request_id for client-side polling
    return new Response(
      JSON.stringify({
        success: true,
        status: "processing",
        request_id: requestId,
        message: "PDF submitted for processing. Poll with ?request_id=<id> to check status.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error parsing PDF:", error);
    return new Response(
      JSON.stringify({ error: "Failed to parse PDF", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
