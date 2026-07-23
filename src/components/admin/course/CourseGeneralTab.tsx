import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
 import { Sparkles, Plus, X, Upload, Loader2 } from "lucide-react";
 import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAICourseContent } from "@/hooks/useAICourseContent";
import { AIImageGenerator } from "@/components/admin/AIImageGenerator";
import { toast } from "sonner";
import { useUploadCourseThumbnail } from "@/hooks/useUploadCourseThumbnail";
import { useCourseThumbnail } from "@/hooks/useCourseThumbnail";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Most Popular Toggle sub-component
const MostPopularToggle = ({ courseId }: { courseId?: string }) => {
  const [isToggling, setIsToggling] = useState(false);
  const queryClient = useQueryClient();

  const { data: isMostPopular, isLoading } = useQuery({
    queryKey: ["most-popular-status", courseId],
    queryFn: async () => {
      if (!courseId) return false;
      const { data } = await supabase
        .from("featured_courses")
        .select("id")
        .eq("course_id", courseId)
        .eq("section_type", "most_popular")
        .maybeSingle();
      return !!data;
    },
    enabled: !!courseId,
  });

  const handleToggle = async (checked: boolean) => {
    if (!courseId) {
      toast.error("Save the course first before toggling Most Popular");
      return;
    }
    setIsToggling(true);
    try {
      if (checked) {
        const { error } = await supabase
          .from("featured_courses")
          .insert({ course_id: courseId, section_type: "most_popular", display_order: 99, is_active: true });
        if (error) throw error;
        toast.success("Course marked as Most Popular!");
      } else {
        const { error } = await supabase
          .from("featured_courses")
          .delete()
          .eq("course_id", courseId)
          .eq("section_type", "most_popular");
        if (error) throw error;
        toast.success("Course removed from Most Popular");
      }
      queryClient.invalidateQueries({ queryKey: ["most-popular-status", courseId] });
      queryClient.invalidateQueries({ queryKey: ["homepage-data"] });
    } catch (error) {
      toast.error("Failed to update: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsToggling(false);
    }
  };

  if (!courseId) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-2">
        <Switch
          id="is_most_popular"
          checked={isMostPopular ?? false}
          onCheckedChange={handleToggle}
          disabled={isLoading || isToggling}
        />
        <Label htmlFor="is_most_popular">🔥 Most Popular</Label>
      </div>
      <p className="text-sm text-muted-foreground ml-[52px]">
        When enabled, this course will appear in the "Most Popular" section on the homepage
      </p>
    </div>
  );
};

interface CourseGeneralTabProps {
  formData: any;
  onChange: (field: string, value: any) => void;
}

export const CourseGeneralTab = ({ formData, onChange }: CourseGeneralTabProps) => {
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [aiType, setAIType] = useState<"short" | "detailed" | "what_you_learn" | "course_includes">("short");
  const [newLearnItem, setNewLearnItem] = useState("");
  const [newIncludeItem, setNewIncludeItem] = useState({ icon: "Video", text: "" });
   const [isUploading, setIsUploading] = useState(false);
  
  const generateContent = useAICourseContent();
  const uploadThumbnail = useUploadCourseThumbnail();
  const queryClient = useQueryClient();
   
   // Fetch existing thumbnail from course_thumbnails table
   const { data: existingThumbnail } = useCourseThumbnail({
     courseId: formData.id,
     enabled: !!formData.id,
   });
 
   // Handle file upload to storage bucket
   const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
 
     // Validate file type
     if (!file.type.startsWith("image/")) {
       toast.error("Please select an image file");
       return;
     }
 
     // Validate file size (max 5MB)
     if (file.size > 5 * 1024 * 1024) {
       toast.error("Image must be less than 5MB");
       return;
     }
 
     // If course doesn't have an ID yet (new course), store the file temporarily
     if (!formData.id) {
       // For new courses, we'll upload after the course is created
       // Store the file in formData temporarily
       const reader = new FileReader();
       reader.onload = (event) => {
         onChange("_pendingThumbnailFile", file);
         onChange("thumbnail_url", event.target?.result as string); // Preview only
       };
       reader.readAsDataURL(file);
       toast.info("Thumbnail will be uploaded when course is saved");
       return;
     }
 
     setIsUploading(true);
     try {
       await uploadThumbnail.mutateAsync({
         courseId: formData.id,
         file,
       });
     } finally {
       setIsUploading(false);
     }
   };
 
  // Handle AI-generated image
  const handleAIImageGenerated = async (imageUrl: string) => {
    console.log('[THUMBNAIL] Generated image URL:', imageUrl);
    console.log('[THUMBNAIL] Is storage URL?', imageUrl.startsWith('http') && !imageUrl.startsWith('data:'));
    console.log('[THUMBNAIL] formData.id:', formData.id);
    
    // Check if this is already a storage URL (not base64)
    const isStorageUrl = imageUrl.startsWith('http') && !imageUrl.startsWith('data:');
    
    if (!formData.id) {
      console.log('[THUMBNAIL] No course ID - returning early');
      // For new courses, just store the URL for now
      onChange("thumbnail_url", imageUrl);
      toast.info("Thumbnail will be saved when course is created");
      return;
    }

    if (isStorageUrl) {
      // Image is already in storage, just save the URL to course_thumbnails table
      setIsUploading(true);
      try {
        console.log('[THUMBNAIL] Saving storage URL to database:', imageUrl);
        console.log('[THUMBNAIL] Course ID:', formData.id);
        
        const response = await supabase
          .from("course_thumbnails")
          .upsert(
            { course_id: formData.id, storage_url: imageUrl },
            { onConflict: "course_id" }
          )
          .select();
        
        console.log('[THUMBNAIL] Full upsert response:', { data: response.data, error: response.error });
        
        if (response.error) {
          console.error('[THUMBNAIL] Database error details:', {
            message: response.error.message,
            code: (response.error as any).code,
            status: (response.error as any).status,
            details: (response.error as any).details,
            hint: (response.error as any).hint
          });
          throw response.error;
        }
        
        // Check if data is empty (RLS silently rejected)
        if (!response.data || response.data.length === 0) {
          console.warn('[THUMBNAIL] Upsert returned empty data - RLS may have rejected it');
          toast.error("Permission denied: Unable to save thumbnail. Check RLS policies.");
          return;
        }
        
        console.log('[THUMBNAIL] Successfully saved to database:', response.data);
        
        // Invalidate caches so homepage shows new thumbnail
        queryClient.invalidateQueries({ queryKey: ["course-thumbnail", formData.id] });
        queryClient.invalidateQueries({ queryKey: ["featured-courses"] });
        queryClient.invalidateQueries({ queryKey: ["admin-featured-courses"] });
        queryClient.invalidateQueries({ queryKey: ["homepage-data"] });
        
        toast.success("Thumbnail saved successfully!");
      } catch (error) {
        console.error("[THUMBNAIL] Failed to save thumbnail URL:", error);
        toast.error("Failed to save thumbnail: " + (error instanceof Error ? error.message : "Unknown error"));
      } finally {
        setIsUploading(false);
      }
    } else {
      // Legacy base64 handling - fetch and upload to storage
      console.log('[THUMBNAIL] Received base64, will convert and upload');
      setIsUploading(true);
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], `ai-thumbnail-${Date.now()}.jpg`, { type: "image/jpeg" });
        
        console.log('[THUMBNAIL] Uploading converted image to storage');
        await uploadThumbnail.mutateAsync({
          courseId: formData.id,
          file,
        });
        
        console.log('[THUMBNAIL] Conversion and upload complete');
      } catch (error) {
        console.error("[THUMBNAIL] Failed to save AI-generated thumbnail:", error);
        toast.error("Failed to save AI-generated thumbnail: " + (error instanceof Error ? error.message : "Unknown error"));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleAIGenerate = async () => {
    const type = aiType === "short" || aiType === "detailed" ? "description" : aiType;
    
    generateContent.mutate({
      type: type as any,
      context: {
        courseName: formData.name || "Untitled Course",
        shortDescription: aiType === "detailed" ? formData.short_description : undefined,
      },
    }, {
      onSuccess: (data) => {
        if (aiType === "short") {
          onChange("short_description", data.content);
        } else if (aiType === "detailed") {
          onChange("detailed_description", data.content);
        } else if (aiType === "what_you_learn") {
          const existing = formData.what_you_learn || [];
          onChange("what_you_learn", [...existing, ...(Array.isArray(data.content) ? data.content : [data.content])]);
        } else if (aiType === "course_includes") {
          const existing = formData.course_includes || [];
          onChange("course_includes", [...existing, ...(Array.isArray(data.content) ? data.content : [data.content])]);
        }
        setIsAIDialogOpen(false);
        toast.success("Content generated successfully!");
      },
    });
  };

  const addLearnItem = () => {
    if (newLearnItem.trim()) {
      const existing = formData.what_you_learn || [];
      onChange("what_you_learn", [...existing, newLearnItem.trim()]);
      setNewLearnItem("");
    }
  };

  const removeLearnItem = (index: number) => {
    const existing = formData.what_you_learn || [];
    onChange("what_you_learn", existing.filter((_: any, i: number) => i !== index));
  };

  const addIncludeItem = () => {
    if (newIncludeItem.text.trim()) {
      const existing = formData.course_includes || [];
      onChange("course_includes", [...existing, { ...newIncludeItem }]);
      setNewIncludeItem({ icon: "Video", text: "" });
    }
  };

  const removeIncludeItem = (index: number) => {
    const existing = formData.course_includes || [];
    onChange("course_includes", existing.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Course Name *</Label>
          <Input
            id="name"
            value={formData.name || ""}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Enter course name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug || ""}
            onChange={(e) => onChange("slug", e.target.value)}
            placeholder="course-slug"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="short_description">Short Description</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAIType("short");
              setIsAIDialogOpen(true);
            }}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Generate with AI
          </Button>
        </div>
        <Textarea
          id="short_description"
          value={formData.short_description || ""}
          onChange={(e) => onChange("short_description", e.target.value)}
          placeholder="Brief course overview (max 200 chars)"
          maxLength={200}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="detailed_description">Detailed Description</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAIType("detailed");
              setIsAIDialogOpen(true);
            }}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Generate with AI
          </Button>
        </div>
        <Textarea
          id="detailed_description"
          value={formData.detailed_description || ""}
          onChange={(e) => onChange("detailed_description", e.target.value)}
          placeholder="Full course details"
          rows={6}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="thumbnail_url">Course Thumbnail</Label>
           <div className="space-y-3">
             {/* Current Thumbnail Preview */}
             {(existingThumbnail || formData.thumbnail_url) && (
               <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                 <img
                   src={existingThumbnail || formData.thumbnail_url}
                   alt="Course thumbnail"
                   className="w-full h-full object-cover"
                 />
               </div>
             )}
             
             {/* Upload Button */}
             <div className="flex items-center gap-2">
               <label className="flex-1">
                 <input
                   type="file"
                   accept="image/*"
                   onChange={handleThumbnailUpload}
                   className="hidden"
                   disabled={isUploading}
                 />
                 <Button
                   type="button"
                   variant="outline"
                   className="w-full cursor-pointer"
                   disabled={isUploading}
                   asChild
                 >
                   <span>
                     {isUploading ? (
                       <>
                         <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                         Uploading...
                       </>
                     ) : (
                       <>
                         <Upload className="w-4 h-4 mr-2" />
                         Upload Image
                       </>
                     )}
                   </span>
                 </Button>
               </label>
             </div>
           </div>
        </div>
        
        <div className="space-y-2">
          <Label>AI Generate Thumbnail</Label>
          <AIImageGenerator
            suggestedPrompt={`Professional course thumbnail for "${formData.name || 'a course'}" about ${formData.short_description || 'education'}. Modern, vibrant, professional photography style. by simple Lecture`}
             onImageGenerated={handleAIImageGenerated}
            courseId={formData.id}
          />
           {isUploading && (
             <p className="text-xs text-muted-foreground flex items-center gap-1">
               <Loader2 className="w-3 h-3 animate-spin" />
               Saving to storage...
             </p>
           )}
        </div>
      </div>

      {/* Promotional Video URL */}
      <div className="space-y-2">
        <Label htmlFor="promotional_video_url">Promotional Video (YouTube URL)</Label>
        <Input
          id="promotional_video_url"
          value={formData.promotional_video_url || ""}
          onChange={(e) => onChange("promotional_video_url", e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <p className="text-xs text-muted-foreground">
          Enter a YouTube video URL. This will display on the course page banner instead of the thumbnail.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="duration_months">Duration (months)</Label>
          <Input
            id="duration_months"
            type="number"
            value={formData.duration_months || ""}
            onChange={(e) => onChange("duration_months", parseInt(e.target.value) || 0)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="price_inr">Price (INR)</Label>
          <Input
            id="price_inr"
            type="number"
            value={formData.price_inr || ""}
            onChange={(e) => onChange("price_inr", parseInt(e.target.value) || 0)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="original_price_inr">Original Price (INR)</Label>
          <Input
            id="original_price_inr"
            type="number"
            value={formData.original_price_inr || ""}
            onChange={(e) => onChange("original_price_inr", parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="student_count">Student Count</Label>
          <Input
            id="student_count"
            type="number"
            value={formData.student_count || ""}
            onChange={(e) => onChange("student_count", parseInt(e.target.value) || 0)}
            placeholder="Total enrolled students"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="review_count">Review Count</Label>
          <Input
            id="review_count"
            type="number"
            value={formData.review_count || ""}
            onChange={(e) => onChange("review_count", parseInt(e.target.value) || 0)}
            placeholder="Total reviews"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="rating">Rating (0-5)</Label>
          <Input
            id="rating"
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={formData.rating || ""}
            onChange={(e) => onChange("rating", parseFloat(e.target.value) || 0)}
            placeholder="Average rating"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>What You'll Learn</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAIType("what_you_learn");
              setIsAIDialogOpen(true);
            }}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Generate with AI
          </Button>
        </div>
        <div className="space-y-2">
          {(formData.what_you_learn || []).map((item: string, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <Input value={item} readOnly className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLearnItem(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newLearnItem}
              onChange={(e) => setNewLearnItem(e.target.value)}
              placeholder="Add learning point"
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLearnItem())}
            />
            <Button type="button" onClick={addLearnItem} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>This Course Includes</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAIType("course_includes");
              setIsAIDialogOpen(true);
            }}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Generate with AI
          </Button>
        </div>
        <div className="space-y-2">
          {(formData.course_includes || []).map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <Input value={`${item.icon}: ${item.text}`} readOnly className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeIncludeItem(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newIncludeItem.icon}
              onChange={(e) => setNewIncludeItem({ ...newIncludeItem, icon: e.target.value })}
              placeholder="Icon"
              className="w-32"
            />
            <Input
              value={newIncludeItem.text}
              onChange={(e) => setNewIncludeItem({ ...newIncludeItem, text: e.target.value })}
              placeholder="Feature description"
              className="flex-1"
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addIncludeItem())}
            />
            <Button type="button" onClick={addIncludeItem} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active ?? true}
          onCheckedChange={(checked) => onChange("is_active", checked)}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <Switch
            id="is_coming_soon"
            checked={formData.is_coming_soon ?? false}
            onCheckedChange={(checked) => onChange("is_coming_soon", checked)}
          />
          <Label htmlFor="is_coming_soon">Mark as Coming Soon</Label>
        </div>
        <p className="text-sm text-muted-foreground ml-[52px]">
          When enabled, this course will be shown as "Coming Soon" to students instead of being available for enrollment
        </p>
      </div>

      {/* Most Popular Toggle */}
      <MostPopularToggle courseId={formData.id} />

      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Content with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {aiType === "short" && "Generate a short description for your course"}
              {aiType === "detailed" && "Generate a detailed description based on the short description"}
              {aiType === "what_you_learn" && "Generate learning outcomes for your course"}
              {aiType === "course_includes" && "Generate course features and inclusions"}
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={handleAIGenerate} 
                disabled={generateContent.isPending}
                className="flex-1"
              >
                {generateContent.isPending ? "Generating..." : "Generate"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsAIDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};