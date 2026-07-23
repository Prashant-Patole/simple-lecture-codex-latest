import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Download,
  Trash2,
  Play,
  HardDrive,
  Clock,
  Video,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useOfflineDownloads, useRevokeOfflineDownload, useRequestOfflineDownload } from '@/hooks/useClassRecordings';
import { format, formatDistanceToNow } from 'date-fns';

interface OfflineDownloadsManagerProps {
  onPlayOffline?: (downloadId: string) => void;
  deviceId: string;
  maxDownloads?: number;
}

export const OfflineDownloadsManager = ({
  onPlayOffline,
  deviceId,
  maxDownloads = 10,
}: OfflineDownloadsManagerProps) => {
  const { data: downloads, isLoading } = useOfflineDownloads();
  const revokeDownload = useRevokeOfflineDownload();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  const getStatusBadge = (download: any) => {
    if (download.is_revoked) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (download.expires_at && new Date(download.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    switch (download.download_status) {
      case 'ready':
        return <Badge variant="default" className="bg-green-600">Ready</Badge>;
      case 'downloading':
        return <Badge variant="secondary">Downloading...</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{download.download_status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Offline Downloads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const activeDownloads = downloads?.filter(d => !d.is_revoked && d.download_status !== 'expired') || [];
  const usedStorage = activeDownloads.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Offline Downloads
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            <span>{formatFileSize(usedStorage)} used</span>
            <span>•</span>
            <span>{activeDownloads.length}/{maxDownloads} videos</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeDownloads.length === 0 ? (
          <div className="text-center py-8">
            <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Offline Videos</h3>
            <p className="text-muted-foreground text-sm">
              Download videos to watch them without internet connection.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDownloads.map((download) => {
              const recording = download.recording;
              const scheduledClass = recording?.scheduled_class;
              const isExpiringSoon = download.expires_at && 
                new Date(download.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

              return (
                <div
                  key={download.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Video className="h-8 w-8 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">
                        {scheduledClass?.subject || 'Recording'}
                      </h4>
                      {getStatusBadge(download)}
                      <Badge variant="outline">{download.quality}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {scheduledClass?.course?.name || 'Unknown course'}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatFileSize(download.file_size_bytes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(recording?.duration_seconds)}
                      </span>
                      {download.expires_at && (
                        <span className={`flex items-center gap-1 ${isExpiringSoon ? 'text-yellow-600' : ''}`}>
                          {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                          Expires {formatDistanceToNow(new Date(download.expires_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {download.download_status === 'ready' && (
                      <Button
                        size="sm"
                        onClick={() => onPlayOffline?.(download.id)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Play
                      </Button>
                    )}
                    
                    {download.download_status === 'downloading' && (
                      <Button size="sm" disabled>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Downloading...
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Offline Video?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the downloaded video from your device. You can download it again later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              setDeletingId(download.id);
                              revokeDownload.mutate(download.id, {
                                onSettled: () => setDeletingId(null),
                              });
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingId === download.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Delete'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {activeDownloads.length >= maxDownloads && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              You've reached the maximum number of offline downloads. Delete some videos to download more.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
