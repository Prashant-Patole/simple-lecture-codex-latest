import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, Sparkles, RefreshCw, User } from "lucide-react";

interface CounselorAvatar {
  id: string;
  name: string;
  gender: string;
  language: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
}

const DEFAULT_PROMPTS = {
  female: `Ultra realistic 8K DSLR photograph of a beautiful young Indian woman, age 24-26, professional education counselor. She has:
- Large expressive eyes with natural kajal
- Glowing fair-medium Indian skin
- Warm genuine smile showing confidence and approachability
- Professional yet traditional look
- Pastel kurta with delicate embroidery
- Small diamond nose pin and elegant jhumka earrings
- Silky black hair styled professionally
- Studio portrait lighting, Canon 85mm lens
- PHOTOREALISTIC photograph, NOT ILLUSTRATION, NOT CARTOON, NOT CGI, NOT AI-GENERATED LOOKING`,
  male: `Ultra realistic 8K DSLR photograph of a handsome young Indian man, age 26-30, professional education counselor. He has:
- Confident warm smile with dimples
- Clean-shaven with well-groomed appearance
- Navy blazer over crisp white formal shirt
- Sharp professional haircut
- Expressive friendly eyes
- Fair-medium Indian skin tone
- Studio portrait lighting, Canon 85mm lens
- PHOTOREALISTIC photograph, NOT ILLUSTRATION, NOT CARTOON, NOT CGI, NOT AI-GENERATED LOOKING`
};

export default function CounselorAvatars() {
  const [avatars, setAvatars] = useState<CounselorAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  
  // Generation form state
  const [gender, setGender] = useState<"female" | "male">("female");
  const [language, setLanguage] = useState("hi-IN");
  const [quantity, setQuantity] = useState(2);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPTS.female);
  
  const { toast } = useToast();

  // Load existing avatars
  const loadAvatars = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("counselor_avatars")
      .select("*")
      .order("gender")
      .order("display_order");
    
    if (error) {
      toast({ title: "Error loading avatars", description: error.message, variant: "destructive" });
    } else {
      setAvatars(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadAvatars();
  }, []);

  // Update prompt when gender changes
  useEffect(() => {
    setCustomPrompt(DEFAULT_PROMPTS[gender]);
    setLanguage(gender === "female" ? "hi-IN" : "en-IN");
  }, [gender]);

  // Generate avatars with AI
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedImages([]);
    
    const newImages: string[] = [];
    
    for (let i = 0; i < quantity; i++) {
      try {
        toast({ title: `Generating image ${i + 1} of ${quantity}...`, duration: 2000 });
        
        const { data, error } = await supabase.functions.invoke("ai-generate-image", {
          body: { prompt: customPrompt }
        });
        
        if (error) throw error;
        if (data?.imageUrl) {
          newImages.push(data.imageUrl);
          setGeneratedImages([...newImages]);
        }
      } catch (error: any) {
        console.error("Generation error:", error);
        toast({ 
          title: `Failed to generate image ${i + 1}`, 
          description: error.message || "Unknown error",
          variant: "destructive" 
        });
      }
    }
    
    setIsGenerating(false);
    
    if (newImages.length > 0) {
      toast({ title: `Generated ${newImages.length} images!`, description: "Review and save the ones you like." });
    }
  };

  // Save a generated image to database
  const handleSaveImage = async (imageUrl: string) => {
    const name = gender === "female" ? "Priya" : "Rahul";
    const maxOrder = avatars.filter(a => a.gender === gender).length + 1;
    
    const { error } = await supabase.from("counselor_avatars").insert({
      name,
      gender,
      language,
      image_url: imageUrl,
      display_order: maxOrder,
      is_active: true
    });
    
    if (error) {
      toast({ title: "Error saving avatar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Avatar saved!", description: `${name} avatar added successfully.` });
      setGeneratedImages(prev => prev.filter(img => img !== imageUrl));
      loadAvatars();
    }
  };

  // Delete an avatar
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("counselor_avatars").delete().eq("id", id);
    
    if (error) {
      toast({ title: "Error deleting avatar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Avatar deleted" });
      loadAvatars();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Counselor Avatars</h1>
        <p className="text-muted-foreground">Generate and manage AI counselor avatars for the sales assistant</p>
      </div>

      {/* Generation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate New Avatars
          </CardTitle>
          <CardDescription>
            Create realistic Indian counselor photos using AI (Nano Banana / Gemini)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as "female" | "male")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female (Priya - Hindi)</SelectItem>
                  <SelectItem value="male">Male (Rahul - English)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hi-IN">Hindi (hi-IN)</SelectItem>
                  <SelectItem value="en-IN">English (en-IN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Select value={quantity.toString()} onValueChange={(v) => setQuantity(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>AI Prompt (customize for different looks)</Label>
            <Textarea 
              value={customPrompt} 
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate {quantity} Avatar{quantity > 1 ? "s" : ""}
              </>
            )}
          </Button>

          {/* Generated Images Preview */}
          {generatedImages.length > 0 && (
            <div className="space-y-3">
              <Label>Generated Images (click to save)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {generatedImages.map((img, idx) => (
                  <div 
                    key={idx} 
                    className="relative group cursor-pointer"
                    onClick={() => handleSaveImage(img)}
                  >
                    <img 
                      src={img} 
                      alt={`Generated ${idx + 1}`}
                      className="w-full aspect-[3/4] object-cover rounded-lg border hover:ring-2 hover:ring-primary transition-all"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                      <span className="text-white text-sm font-medium">Click to Save</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Avatars */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Existing Avatars ({avatars.length})
            </span>
            <Button variant="outline" size="sm" onClick={loadAvatars}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : avatars.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No avatars yet. Generate some above!
            </div>
          ) : (
            <div className="space-y-6">
              {/* Female Avatars */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">🇮🇳 Priya (Female - Hindi)</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {avatars.filter(a => a.gender === "female").map(avatar => (
                    <div key={avatar.id} className="relative group">
                      <img 
                        src={avatar.image_url} 
                        alt={avatar.name}
                        className="w-full aspect-[3/4] object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(avatar.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 rounded-b-lg">
                        <span className="text-white text-xs">{avatar.language}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Male Avatars */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">🇬🇧 Rahul (Male - English)</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {avatars.filter(a => a.gender === "male").map(avatar => (
                    <div key={avatar.id} className="relative group">
                      <img 
                        src={avatar.image_url} 
                        alt={avatar.name}
                        className="w-full aspect-[3/4] object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(avatar.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 rounded-b-lg">
                        <span className="text-white text-xs">{avatar.language}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
