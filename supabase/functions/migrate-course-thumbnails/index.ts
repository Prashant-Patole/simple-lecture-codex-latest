 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import { corsHeaders } from "../_shared/cors.ts";
 
 interface MigrationResult {
   courseId: string;
   courseName: string;
   success: boolean;
   error?: string;
 }
 
 Deno.serve(async (req) => {
   // Handle CORS preflight
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     // Create Supabase client with service role for admin operations
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, serviceRoleKey);
 
     // Verify admin authentication
     const authHeader = req.headers.get("Authorization");
     if (!authHeader) {
       return new Response(
         JSON.stringify({ error: "Missing authorization header" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Verify the user is an admin
     const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
     const { data: { user }, error: authError } = await anonClient.auth.getUser(
       authHeader.replace("Bearer ", "")
     );
 
     if (authError || !user) {
       return new Response(
         JSON.stringify({ error: "Invalid authentication" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Check if user has admin role
     const { data: roles } = await supabase
       .from("user_roles")
       .select("role")
       .eq("user_id", user.id);
 
     const isAdmin = roles?.some(r => r.role === "admin" || r.role === "super_admin");
     if (!isAdmin) {
       return new Response(
         JSON.stringify({ error: "Admin access required" }),
         { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("Starting thumbnail migration...");
 
     // Fetch all courses with base64 thumbnail_url
     const { data: courses, error: fetchError } = await supabase
       .from("courses")
       .select("id, name, thumbnail_url")
       .not("thumbnail_url", "is", null);
 
     if (fetchError) {
       console.error("Error fetching courses:", fetchError);
       throw fetchError;
     }
 
     console.log(`Found ${courses?.length || 0} courses with thumbnails`);
 
     const results: MigrationResult[] = [];
     let successCount = 0;
     let skipCount = 0;
     let failCount = 0;
 
     for (const course of courses || []) {
       try {
         const thumbnailUrl = course.thumbnail_url;
 
         // Skip if not base64
         if (!thumbnailUrl?.startsWith("data:image")) {
           console.log(`Skipping ${course.name}: not base64 data`);
           skipCount++;
           continue;
         }
 
         // Check if already migrated
         const { data: existing } = await supabase
           .from("course_thumbnails")
           .select("id")
           .eq("course_id", course.id)
           .maybeSingle();
 
         if (existing) {
           console.log(`Skipping ${course.name}: already migrated`);
           skipCount++;
           continue;
         }
 
         // Extract base64 data
         const base64Match = thumbnailUrl.match(/^data:image\/(\w+);base64,(.+)$/);
         if (!base64Match) {
           console.log(`Skipping ${course.name}: invalid base64 format`);
           skipCount++;
           continue;
         }
 
         const [, imageType, base64Data] = base64Match;
         
         // Decode base64 to binary
         const binaryString = atob(base64Data);
         const bytes = new Uint8Array(binaryString.length);
         for (let i = 0; i < binaryString.length; i++) {
           bytes[i] = binaryString.charCodeAt(i);
         }
 
         // Determine content type and extension
         const contentType = `image/${imageType === "jpg" ? "jpeg" : imageType}`;
         const extension = imageType === "jpeg" ? "jpg" : imageType;
         const fileName = `${course.id}/thumbnail_${Date.now()}.${extension}`;
 
         console.log(`Uploading thumbnail for ${course.name}...`);
 
         // Upload to storage bucket
         const { data: uploadData, error: uploadError } = await supabase.storage
           .from("course-thumbnails")
           .upload(fileName, bytes.buffer, {
             contentType,
             cacheControl: "3600",
             upsert: true,
           });
 
         if (uploadError) {
           console.error(`Upload failed for ${course.name}:`, uploadError);
           results.push({
             courseId: course.id,
             courseName: course.name,
             success: false,
             error: uploadError.message,
           });
           failCount++;
           continue;
         }
 
         // Get public URL
         const { data: urlData } = supabase.storage
           .from("course-thumbnails")
           .getPublicUrl(uploadData.path);
 
         const publicUrl = urlData.publicUrl;
 
         // Upsert into course_thumbnails table
         const { error: dbError } = await supabase
           .from("course_thumbnails")
           .upsert({
             course_id: course.id,
             storage_url: publicUrl,
           }, {
             onConflict: "course_id",
           });
 
         if (dbError) {
           console.error(`Database insert failed for ${course.name}:`, dbError);
           results.push({
             courseId: course.id,
             courseName: course.name,
             success: false,
             error: dbError.message,
           });
           failCount++;
           continue;
         }
 
         console.log(`Successfully migrated ${course.name}`);
         results.push({
           courseId: course.id,
           courseName: course.name,
           success: true,
         });
         successCount++;
 
       } catch (error) {
         console.error(`Error processing ${course.name}:`, error);
         results.push({
           courseId: course.id,
           courseName: course.name,
           success: false,
           error: error instanceof Error ? error.message : "Unknown error",
         });
         failCount++;
       }
     }
 
     const summary = {
       total: courses?.length || 0,
       success: successCount,
       skipped: skipCount,
       failed: failCount,
       results,
     };
 
     console.log("Migration complete:", summary);
 
     return new Response(
       JSON.stringify(summary),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error) {
     console.error("Migration error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Migration failed" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });