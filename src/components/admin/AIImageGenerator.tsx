import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIImageGeneratorProps {
  suggestedPrompt?: string;
  onImageGenerated: (imageUrl: string) => void;
  courseId?: string;
}

export const AIImageGenerator = ({ suggestedPrompt = "", onImageGenerated, courseId }: AIImageGeneratorProps) => {
  const [prompt, setPrompt] = useState(suggestedPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt, courseId },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Image generated successfully!");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      
      // Check if it's a credits issue
      if (error.message?.includes("402") || error.message?.includes("credits")) {
        toast.error(
          "Not enough AI credits. Please add credits in Settings → Workspace → Usage.",
          { duration: 6000 }
        );
      } else {
        toast.error(error.message || "Failed to generate image");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseImage = () => {
    if (generatedImage) {
      onImageGenerated(generatedImage);
      toast.success("Image applied!");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Image Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Image Description</Label>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            disabled={isGenerating}
          />
          {suggestedPrompt && prompt !== suggestedPrompt && (
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto mt-1"
              onClick={() => setPrompt(suggestedPrompt)}
            >
              Use suggested prompt
            </Button>
          )}
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Image
            </>
          )}
        </Button>

        {generatedImage && (
          <div className="space-y-2">
            <img 
              src={generatedImage} 
              alt="Generated" 
              className="w-full rounded-lg border"
            />
            <div className="flex gap-2">
              <Button onClick={handleUseImage} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Use This Image
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setGeneratedImage(null)}
              >
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
