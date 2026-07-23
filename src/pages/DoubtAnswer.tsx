import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { BookOpen, MessageCircleQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { PageLoader } from "@/components/ui/page-loader";

const DoubtAnswer = () => {
  const { id } = useParams<{ id: string }>();

  const { data: log, isLoading, error } = useQuery({
    queryKey: ["doubt-answer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_chat_logs" as any)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;

  if (error || !log) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">This doubt answer was not found or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Doubt Answer | SimpleLecture</title>
        <meta name="description" content="AI-powered doubt resolution for students" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">SimpleLecture</h1>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {/* Question */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <MessageCircleQuestion className="h-5 w-5 text-primary mt-1 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Your Question</p>
                  <p className="text-foreground text-lg">{log.message_text}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Answer */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-primary mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-3">AI Answer</p>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {log.ai_answer || "No answer available."}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Powered by SimpleLecture AI • Answers are AI-generated and may not always be accurate
          </p>
        </main>
      </div>
    </>
  );
};

export default DoubtAnswer;
