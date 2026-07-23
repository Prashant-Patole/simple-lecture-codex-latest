import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const MAX_JOBS_PER_IP = 2;
const PENDING_MAX_AGE_MS = 3 * 60 * 60 * 1000;    // 3 hours
const PROCESSING_MAX_AGE_MS = 3 * 60 * 60 * 1000;  // 3 hours

interface StaleJobRow {
  id: string;
  external_job_id: string | null;
  status: string;
  server_ip: string | null;
}

// Verify each stale job against the generation server before flipping its status.
// - completed on server  -> mark completed (restore video_url, progress=100)
// - failed on server     -> mark failed with the server's real error message
// - still processing     -> leave row alone (we only stop counting it for slot purposes)
// - server unreachable   -> leave row alone, try again next cycle
async function reconcileStaleJobs(serverIp: string, rows: StaleJobRow[]) {
  await Promise.all(rows.map(async (row) => {
    if (!row.external_job_id) return;
    try {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'status', job_id: row.external_job_id, server_ip: serverIp },
      });
      if (error || !data) return; // unreachable -> leave alone

      if (data.status === 'completed') {
        await supabase
          .from('video_generation_jobs')
          .update({
            status: 'completed',
            progress: 100,
            video_url: data.player_url || data.video_url || `http://${serverIp}:5005/player_v2/?job=${row.external_job_id}`,
            completed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', row.id);
      } else if (data.status === 'failed') {
        await supabase
          .from('video_generation_jobs')
          .update({
            status: 'failed',
            error_message: data.error || 'Job failed on server',
          })
          .eq('id', row.id);
      }
      // processing / pending / anything else -> leave the row untouched
    } catch {
      // network error: leave row untouched
    }
  }));
}

async function cleanupAndCountSlots(serverIp: string): Promise<number> {
  const now = Date.now();
  const pendingCutoff = new Date(now - PENDING_MAX_AGE_MS).toISOString();
  const processingCutoff = new Date(now - PROCESSING_MAX_AGE_MS).toISOString();

  // Find stale rows and verify each with the server before changing status
  const { data: stalePending } = await supabase
    .from('video_generation_jobs')
    .select('id, external_job_id, status, server_ip')
    .eq('server_ip', serverIp)
    .eq('status', 'pending')
    .lt('created_at', pendingCutoff);

  const { data: staleProcessing } = await supabase
    .from('video_generation_jobs')
    .select('id, external_job_id, status, server_ip')
    .eq('server_ip', serverIp)
    .eq('status', 'processing')
    .lt('created_at', processingCutoff);

  const staleRows = [
    ...((stalePending as StaleJobRow[] | null) || []),
    ...((staleProcessing as StaleJobRow[] | null) || []),
  ];

  if (staleRows.length > 0) {
    await reconcileStaleJobs(serverIp, staleRows);
  }

  // Count remaining active jobs within the recent window only.
  // Older 'processing' rows still on the server are not counted against the IP cap,
  // so they don't block new submissions, but they are no longer destroyed.
  const { count: pendingCount } = await supabase
    .from('video_generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('server_ip', serverIp)
    .eq('status', 'pending')
    .gt('created_at', pendingCutoff);

  const { count: processingCount } = await supabase
    .from('video_generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('server_ip', serverIp)
    .eq('status', 'processing')
    .gt('created_at', processingCutoff);

  return (pendingCount || 0) + (processingCount || 0);
}

export function useServerIpSlots(serverIp?: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['server-ip-slots', serverIp],
    queryFn: async () => {
      if (!serverIp) return 0;
      return cleanupAndCountSlots(serverIp);
    },
    enabled: !!serverIp,
    refetchInterval: 10000,
  });

  const activeCount = data ?? 0;

  return {
    activeCount,
    maxJobs: MAX_JOBS_PER_IP,
    isFull: activeCount >= MAX_JOBS_PER_IP,
    isLoading,
    refetch,
  };
}

export async function checkServerIpSlots(serverIp: string): Promise<number> {
  return cleanupAndCountSlots(serverIp);
}
