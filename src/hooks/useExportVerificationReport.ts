import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useExportVerificationReport = () => {
  return useMutation({
    mutationFn: async ({
      documentId,
      format
    }: {
      documentId: string;
      format: 'csv' | 'pdf';
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "export-verification-report",
        { body: { documentId, format } }
      );
      if (error) throw error;
      return { data, format };
    },
    onSuccess: ({ data, format }) => {
      if (format === 'csv') {
        // Create blob and download CSV
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verification-report-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("CSV report downloaded");
      } else {
        // For PDF, open the HTML in a new window for printing
        const htmlWindow = window.open('', '_blank');
        if (htmlWindow) {
          htmlWindow.document.write(data.html);
          htmlWindow.document.close();
          toast.success("PDF report opened in new window. Use browser's print function to save as PDF.");
        }
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to export report", {
        description: error.message
      });
    }
  });
};
