import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyText, prompt } = await req.json();

    if (!storyText && !prompt) {
      return new Response(
        JSON.stringify({ error: "Story text or prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const KIE_AI_API_KEY = Deno.env.get("KIE_AI_API_KEY");
    if (!KIE_AI_API_KEY) {
      console.log("KIE_AI_API_KEY not configured, returning placeholder");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Video generation not configured - KIE_AI_API_KEY missing",
          videoUrl: null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a visual prompt from the story - keep it concise for video gen
    const videoPrompt = prompt || `Educational animation showing: ${storyText.substring(0, 150)}. Simple, clear visuals with smooth motion.`;

    console.log("Generating video with WAN 2.2 via kie.ai:", videoPrompt.substring(0, 80));
    console.log("Using API Key:", KIE_AI_API_KEY.substring(0, 8) + "...");

    // Call KIE.AI WAN 2.2 API - correct endpoint format
    // Based on kie.ai documentation for WAN 2.2 model
    const response = await fetch("https://api.kie.ai/api/v1/video/wan/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KIE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: videoPrompt,
        model: "wan-2.2", // WAN 2.2 model
        resolution: "480p",
        aspect_ratio: "16:9",
        duration: 5, // 5 seconds for story video
      }),
    });

    console.log("KIE.AI Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("KIE.AI API error:", response.status, errorText);
      
      // Try alternative endpoint format
      console.log("Trying alternative endpoint...");
      const altResponse = await fetch("https://api.kie.ai/v1/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KIE_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "wan-2.2",
          prompt: videoPrompt,
          type: "video",
          settings: {
            resolution: "480p",
            aspect_ratio: "16:9",
            duration: 5,
          }
        }),
      });

      if (!altResponse.ok) {
        const altErrorText = await altResponse.text();
        console.error("KIE.AI alt endpoint error:", altResponse.status, altErrorText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Video generation failed: ${response.status} - ${errorText.substring(0, 200)}`,
            videoUrl: null 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const altResult = await altResponse.json();
      console.log("Alt endpoint result:", JSON.stringify(altResult).substring(0, 200));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          videoUrl: altResult.output?.url || altResult.video_url || altResult.url || null,
          taskId: altResult.task_id || altResult.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("Video generation result:", JSON.stringify(result).substring(0, 300));

    // Handle async task-based response
    if (result.task_id || result.id) {
      const taskId = result.task_id || result.id;
      console.log("Got task ID:", taskId, "- polling for completion...");
      
      // Poll for completion (max 60 seconds)
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusResponse = await fetch(`https://api.kie.ai/api/v1/video/status/${taskId}`, {
          headers: {
            "Authorization": `Bearer ${KIE_AI_API_KEY}`,
          },
        });
        
        if (statusResponse.ok) {
          const statusResult = await statusResponse.json();
          console.log("Status check attempt", attempts + 1, ":", statusResult.status);
          
          if (statusResult.status === "completed" || statusResult.status === "success") {
            const videoUrl = statusResult.video_url || statusResult.output?.url || statusResult.url;
            if (videoUrl) {
              console.log("Video generated successfully:", videoUrl.substring(0, 50));
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  videoUrl: videoUrl 
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else if (statusResult.status === "failed" || statusResult.status === "error") {
            console.error("Video generation failed:", statusResult.error || statusResult.message);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: statusResult.error || "Video generation failed",
                videoUrl: null 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        attempts++;
      }
      
      // Timeout - return task ID for later checking
      console.log("Video generation timed out, returning task ID for later");
      return new Response(
        JSON.stringify({ 
          success: false, 
          taskId: taskId,
          error: "Video generation in progress - check back later",
          videoUrl: null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Direct response with video URL
    const videoUrl = result.video_url || result.output?.url || result.url || null;
    console.log("Direct video URL response:", videoUrl?.substring(0, 50) || "none");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        videoUrl: videoUrl 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-story-video:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        videoUrl: null 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
