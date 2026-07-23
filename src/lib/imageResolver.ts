import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from '@/lib/supabaseUrl';

// Module-level cache for resolved image URLs
const imageCache = new Map<string, string | null>();

// Cached auth token for proxy URLs
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const { data } = await supabase.auth.getSession();
  cachedToken = data.session?.access_token || null;
  tokenExpiry = Date.now() + 30 * 60 * 1000;
  return cachedToken;
}

/**
 * Convert a B2 file path to a proxy URL for rendering
 */
function toProxyUrl(path: string, token?: string): string {
  let url = `${SUPABASE_URL}/functions/v1/b2-proxy-file?path=${encodeURIComponent(path)}`;
  if (token) url += `&token=${encodeURIComponent(token)}`;
  return url;
}

/**
 * Check if a src string is a bare filename (not a full URL or absolute path)
 */
export function isBareFilename(src: string): boolean {
  if (!src) return false;
  return !src.startsWith("http://") && 
         !src.startsWith("https://") && 
         !src.startsWith("/") && 
         !src.startsWith("data:");
}

/**
 * Check if a URL/path is a B2 path (not a full Supabase URL)
 */
function isB2Path(url: string): boolean {
  return !url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:");
}

/**
 * Resolve a bare image filename to a public URL via the question_images table.
 * Single indexed query instead of iterating storage folders.
 * Handles both old Supabase URLs and new B2 paths.
 */
export async function resolveQuestionImageUrl(filename: string): Promise<string | null> {
  if (!filename) return null;
  
  // Check cache first
  const cached = imageCache.get(filename.toLowerCase());
  if (cached !== undefined) return cached;

  try {
    // Strip extension for flexible matching (file might be stored as .jpg.png)
    const nameWithoutExt = filename.toLowerCase().replace(/\.[^.]+$/, "");

    const { data } = await supabase
      .from("question_images")
      .select("public_url")
      .ilike("original_filename", `%${nameWithoutExt}%`)
      .limit(1)
      .maybeSingle();

    let url = data?.public_url || null;
    
    // If the stored URL is a B2 path (not a full URL), convert to proxy URL
    if (url && isB2Path(url)) {
      const token = await getAccessToken();
      url = toProxyUrl(url, token || undefined);
    }
    
    imageCache.set(filename.toLowerCase(), url);
    return url;
  } catch (error) {
    console.error("Error resolving image URL:", error);
    imageCache.set(filename.toLowerCase(), null);
    return null;
  }
}

/**
 * Clear the image resolution cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}
