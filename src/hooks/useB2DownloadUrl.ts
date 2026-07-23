import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from '@/lib/supabaseUrl';

interface UseB2DownloadUrlResult {
  downloadUrl: string | null;
  proxyUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();

export function useB2DownloadUrl(filePath: string | null | undefined): UseB2DownloadUrlResult {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute proxy URL synchronously (no state needed)
  const proxyUrl = filePath && !filePath.startsWith('http')
    ? `${SUPABASE_URL}/functions/v1/b2-proxy-file?path=${encodeURIComponent(filePath)}`
    : filePath?.startsWith('http') ? filePath : null;

  useEffect(() => {
    if (!filePath) {
      setDownloadUrl(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // If it's already a full URL (from old Supabase storage), use it directly
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      setDownloadUrl(filePath);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Check cache first for direct URL
    const cached = urlCache.get(filePath);
    const now = Date.now();
    
    if (cached && cached.expiresAt > now) {
      setDownloadUrl(cached.url);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Fetch authorized URL from B2
    let isMounted = true;
    
    const fetchUrl = async () => {
      setIsLoading(true);
      setError(null);

      // TEMP: B2 suspended — try Supabase Storage docs bucket first
      try {
        const { data: signed } = await supabase.storage
          .from('uploaded-question-documents')
          .createSignedUrl(filePath, 3600);
        if (signed?.signedUrl && isMounted) {
          urlCache.set(filePath, { url: signed.signedUrl, expiresAt: now + (3600 - 300) * 1000 });
          setDownloadUrl(signed.signedUrl);
          setIsLoading(false);
          return;
        }
      } catch { /* fall through to B2 */ }

      try {
        const { data, error: fetchError } = await supabase.functions.invoke('b2-get-download-url', {

          body: { filePath }
        });

        if (!isMounted) return;

        if (fetchError) throw fetchError;
        if (!data?.downloadUrl) throw new Error('No download URL returned');

        const url = data.downloadUrl;
        const expiresIn = data.expiresIn || 3600; // Default 1 hour

        // Cache the URL (expire 5 minutes before actual expiry for safety)
        urlCache.set(filePath, {
          url,
          expiresAt: now + (expiresIn - 300) * 1000
        });

        setDownloadUrl(url);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching B2 download URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to get download URL');
        setDownloadUrl(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUrl();
    
    return () => {
      isMounted = false;
    };
  }, [filePath]);

  return { downloadUrl, proxyUrl, isLoading, error };
}
