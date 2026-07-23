import { useQuery } from "@tanstack/react-query";
import { V4_PROXY_BASE } from "@/components/learning/v4/constants";

export interface ReelVariant {
  dir: string;
  label: string;
  status: string;
  variant: string;
  vimeo_url?: string | null;
  vimeo_uploaded?: boolean;
}

export interface ReelEntry {
  reel_index: number;
  title: string;
  final_video_path: string | null;
  variants: ReelVariant[];
}

export interface ReelManifest {
  job_id: string;
  mode: string;
  total_reels: number;
  reels: ReelEntry[];
  // Origin that actually returned the manifest (used to build video URLs).
  resolved_ip?: string | null;
  resolved_port?: number | null;
}

// Known origins to try as a fallback when the bound origin returns nothing.
// Order matters: stored origin is always tried first.
const KNOWN_ORIGINS: Array<{ ip: string; port: number }> = [
  { ip: "204.12.237.78", port: 5006 },
  { ip: "69.197.145.4", port: 5006 },
];

function originQuery(serverIp?: string | null, targetPort?: number | null) {
  const params: string[] = [];
  if (serverIp) params.push(`__ip=${encodeURIComponent(serverIp)}`);
  if (targetPort) params.push(`__port=${encodeURIComponent(String(targetPort))}`);
  return params.length ? `?${params.join("&")}` : "";
}

export function reelVariantVideoUrl(
  jobId: string,
  dir: string,
  serverIp?: string | null,
  targetPort?: number | null,
) {
  return `${V4_PROXY_BASE}/player/jobs/${jobId}/${dir}/videos/presentation_final.mp4${originQuery(serverIp, targetPort)}`;
}

async function tryManifest(
  jobId: string,
  ip?: string | null,
  port?: number | null,
): Promise<ReelManifest | null> {
  try {
    const res = await fetch(
      `${V4_PROXY_BASE}/job/${jobId}/reels${originQuery(ip, port)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as ReelManifest;
    if (!json?.reels?.length) return null;
    return { ...json, resolved_ip: ip ?? null, resolved_port: port ?? null };
  } catch {
    return null;
  }
}

export function useReelJobManifest(
  jobId: string | undefined,
  enabled: boolean,
  serverIp?: string | null,
  targetPort?: number | null,
) {
  return useQuery({
    queryKey: ["reel-job-manifest", jobId, serverIp, targetPort],
    queryFn: async () => {
      // 1. Try the row's stored origin first (source of truth).
      if (serverIp && targetPort) {
        const bound = await tryManifest(jobId!, serverIp, targetPort);
        if (bound) return bound;
        console.warn(
          `[useReelJobManifest] job ${jobId} bound to ${serverIp}:${targetPort} returned no reels — trying known origins as fallback.`,
        );
      } else {
        console.warn(
          `[useReelJobManifest] job ${jobId} has no server_ip/target_port bound — trying known origins.`,
        );
      }

      // 2. Fallback: try each known origin, skipping the one we just tried.
      for (const o of KNOWN_ORIGINS) {
        if (o.ip === serverIp && o.port === targetPort) continue;
        const found = await tryManifest(jobId!, o.ip, o.port);
        if (found) {
          console.warn(
            `[useReelJobManifest] job ${jobId} resolved via fallback origin ${o.ip}:${o.port}. Rebind the job to persist this.`,
          );
          return found;
        }
      }

      // 3. Last resort: hit the proxy with no override so it uses its own default.
      const proxyDefault = await tryManifest(jobId!, null, null);
      if (proxyDefault) return proxyDefault;

      throw new Error("No reels manifest found on any known origin");
    },
    enabled: !!jobId && enabled,
    staleTime: Infinity,
    retry: 1,
  });
}
