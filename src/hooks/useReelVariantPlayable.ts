import { useQuery } from "@tanstack/react-query";

/**
 * Probe a reel variant video URL to confirm it is reachable and playable.
 * Uses a ranged GET (bytes=0-0) since some proxy setups reject HEAD.
 * Returns true only on 200/206 with a video content-type (or when the
 * server doesn't specify, since some proxies strip headers).
 */
async function probe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    if (!(res.status === 200 || res.status === 206)) return false;
    const ct = res.headers.get("content-type") || "";
    // Accept video/* or empty (proxy may hide it); reject explicit html/json errors.
    if (ct && !ct.startsWith("video/") && !ct.startsWith("application/octet-stream")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function useReelVariantPlayable(url: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["reel-variant-playable", url],
    queryFn: () => probe(url!),
    enabled: !!url && enabled,
    staleTime: 1000 * 60 * 5,
    retry: 0,
  });
}
