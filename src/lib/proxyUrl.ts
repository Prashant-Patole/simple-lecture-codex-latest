import { SUPABASE_URL } from '@/lib/supabaseUrl';

const DIRECT_ORIGIN = "https://oxwhqvsoelqqsblmqkxx.supabase.co";
const PROXY_ORIGIN = SUPABASE_URL;

export function rewriteStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith(DIRECT_ORIGIN) ? url.replace(DIRECT_ORIGIN, PROXY_ORIGIN) : url;
}
