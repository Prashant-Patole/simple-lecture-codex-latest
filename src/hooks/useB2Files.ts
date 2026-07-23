import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface B2File {
  fileId: string;
  fileName: string;
  contentLength: number;
  contentType: string;
  downloadUrl: string;
  metadata: any;
}

interface B2Folder {
  name: string;
  isFolder: true;
}

export function useB2Files(prefix: string = '') {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['b2-files', prefix],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('b2-list-files', {
        body: { prefix, delimiter: '/' }
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');

      return data as { files: B2File[]; folders: B2Folder[]; nextFileName: string | null };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ fileName, fileId }: { fileName: string; fileId: string }) => {
      const { data, error } = await supabase.functions.invoke('b2-delete-file', {
        body: { fileName, fileId }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Delete failed');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2-files'] });
      toast({
        title: "File deleted",
        description: "File has been successfully deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  return {
    files: data?.files || [],
    folders: data?.folders || [],
    isLoading,
    error,
    deleteFile: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
