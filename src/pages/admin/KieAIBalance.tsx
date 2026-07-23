import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Copy, ExternalLink, Wallet, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const KieAIBalance = () => {
  const [fileUrl, setFileUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadGeneratedAt, setDownloadGeneratedAt] = useState<Date | null>(null);

  const { data: credits, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["kie-ai-credits"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("kie-ai-common", {
        body: { action: "check_credit" },
      });
      if (error) throw error;
      return data.credits as number;
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke("kie-ai-common", {
        body: { action: "get_download_url", url },
      });
      if (error) throw error;
      return data.downloadUrl as string;
    },
    onSuccess: (url) => {
      setDownloadUrl(url);
      setDownloadGeneratedAt(new Date());
      toast({ title: "Download link generated", description: "Link is valid for 20 minutes." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to get download URL", description: err.message, variant: "destructive" });
    },
  });

  const creditStatus = credits === undefined ? null : credits > 50 ? "healthy" : credits >= 10 ? "low" : "critical";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KIE.AI Account</h1>
        <p className="text-muted-foreground">Monitor credits and manage generated file downloads</p>
      </div>

      {/* Credit Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Credit Balance
          </CardTitle>
          <CardDescription>Your current KIE.AI account credit balance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold text-foreground">
                  {isLoading ? "..." : credits ?? "—"}
                </span>
                <span className="text-lg text-muted-foreground">credits</span>
              </div>
              <div className="flex items-center gap-2">
                {creditStatus === "healthy" && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" /> Healthy
                  </Badge>
                )}
                {creditStatus === "low" && (
                  <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Low
                  </Badge>
                )}
                {creditStatus === "critical" && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Critical
                  </Badge>
                )}
              </div>
              {dataUpdatedAt > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last checked {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Download URL Tool */}
      <Card>
        <CardHeader>
          <CardTitle>Download URL Converter</CardTitle>
          <CardDescription>
            Convert KIE.AI generated file URLs into temporary downloadable links (valid for 20 minutes)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Paste KIE.AI generated file URL here..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => downloadMutation.mutate(fileUrl)}
              disabled={!fileUrl.trim() || downloadMutation.isPending}
            >
              {downloadMutation.isPending ? "Getting..." : "Get Download Link"}
            </Button>
          </div>

          {downloadUrl && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Download Link</span>
                <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">
                  <Clock className="h-3 w-3 mr-1" />
                  Expires in 20 minutes
                </Badge>
              </div>
              <div className="flex gap-2">
                <Input value={downloadUrl} readOnly className="flex-1 text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(downloadUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              {downloadGeneratedAt && (
                <p className="text-xs text-muted-foreground">
                  Generated {formatDistanceToNow(downloadGeneratedAt, { addSuffix: true })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KieAIBalance;
