/**
 * Central Supabase URL constant — hardcoded proxy to bypass ISP blocks.
 * Lovable auto-overwrites .env but cannot touch source files, so this is permanent.
 * Change the proxy URL here and it updates everywhere.
 */
export const SUPABASE_URL = "https://supabase-proxy.utuberpraveen.workers.dev";

/**
 * Direct Supabase URL — bypasses the Cloudflare Worker proxy.
 * Used ONLY for long-running edge functions (e.g. ai-teaching-assistant)
 * that would otherwise hit the Worker's 150s idle timeout.
 * Supabase Pro allows up to 400s wall-clock on edge functions.
 */
export const SUPABASE_DIRECT_URL = "https://oxwhqvsoelqqsblmqkxx.supabase.co";
