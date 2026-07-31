import { useState, useEffect } from "react";
// Cache bust: 2026-02-05
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { BookOpen, List, Brain, FileText, Users, GraduationCap, ArrowLeft, Sparkles, Loader2, FileJson, Video, Languages, ClipboardList, Film, Bot, NotebookTabs } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadWidget } from "@/components/admin/ImageUploadWidget";
import { AIImageGenerator } from "@/components/admin/AIImageGenerator";
import {
  useAdminSubject,
  useAdminSubjectFull,
  useCreateSubject,
  useUpdateSubject,
  VIDEO_SERVER_OPTIONS,
} from "@/hooks/useAdminPopularSubjects";
import { useAdminCategories, getCategoryHierarchyDisplay } from "@/hooks/useAdminCategories";
import { useAICourseContent } from "@/hooks/useAICourseContent";
import { Skeleton } from "@/components/ui/skeleton";
// Subject management components
import { SubjectChaptersTab } from "@/components/admin/SubjectChaptersTab";
import { SubjectQuestionsTab } from "@/components/admin/SubjectQuestionsTab";
import { SubjectPreviousYearTab } from "@/components/admin/SubjectPreviousYearTab";
import { SubjectInstructorsTab } from "@/components/admin/SubjectInstructorsTab";
import { SubjectCoursesTab } from "@/components/admin/SubjectCoursesTab";
import { SubjectDocumentsTab } from "@/components/admin/SubjectDocumentsTab";
import { SubjectVideoGeneratorTab } from "@/components/admin/SubjectVideoGeneratorTab";
import { SubjectLanguagesTab } from "@/components/admin/SubjectLanguagesTab";
import { SubjectReelsTab } from "@/components/admin/SubjectReelsTab";
import { SubjectStoriesTab } from "@/components/admin/SubjectStoriesTab";
import { SubjectNotesTab } from "@/components/admin/SubjectNotesTab";
import { SubjectAskAITab } from "@/components/admin/SubjectAskAITab";
import { SubjectPYQTab } from "@/components/admin/SubjectPYQTab";
import { useVideoGenerationJobs, useAutoSyncJobStatuses } from "@/hooks/useVideoGenerationJobs";
import { useSubjectThumbnail, useUploadSubjectThumbnail, useDeleteSubjectThumbnail } from "@/hooks/useSubjectThumbnail";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().max(2000).optional(),
  thumbnail_url: z.string().optional(),
  category_id: z.string().min(1, "Category is required"),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

export default function SubjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [activeTab, setActiveTab] = useState("basic");

  // Lightweight subject data for form (excludes large JSON fields)
  const { data: subject, isLoading: isLoadingSubject } = useAdminSubject(id);
  
  // Full subject data only when Documents tab is active (lazy load heavy content_json)
  const { data: fullSubject } = useAdminSubjectFull(id, activeTab === 'documents');
  
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const { data: categories, isLoading: isLoadingCategories } = useAdminCategories();
  const generateContent = useAICourseContent();

  // Subject thumbnail hooks - Storage-based
  const { data: storageThumbnailUrl } = useSubjectThumbnail(id);
  const uploadThumbnail = useUploadSubjectThumbnail();
  const deleteThumbnail = useDeleteSubjectThumbnail();

  // Background auto-sync for video generation jobs - only when on Video tab
  const { data: videoJobs } = useVideoGenerationJobs({ 
    subjectId: id, 
    enabled: activeTab === 'generate-video' 
  });
  useAutoSyncJobStatuses(videoJobs || []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      thumbnail_url: "",
      category_id: "",
      display_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (subject) {
      const subjectData = subject as any;
      form.reset({
        name: subject.name,
        slug: subject.slug,
        description: subject.description || "",
        thumbnail_url: subjectData.thumbnail_url || "",
        category_id: subjectData.category_id || "",
        display_order: subject.display_order,
        is_active: subject.is_active,
      });
    }
  }, [subject, form]);

  const nameValue = form.watch("name");
  useEffect(() => {
    if (nameValue && !isEdit) {
      const slug = nameValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  }, [nameValue, isEdit, form]);

  const onSubmit = (data: FormData) => {
    if (isEdit && id) {
      updateSubject.mutate(
        { id, ...data },
        {
          onSuccess: () => navigate("/admin/popular-subjects"),
        }
      );
    } else {
      createSubject.mutate(data as any, {
        onSuccess: (newSubject) => {
          navigate(`/admin/subjects/${newSubject.id}/edit`);
        },
      });
    }
  };

  const handleGenerateDescription = async () => {
    const subjectName = form.watch("name");
    const categoryId = form.watch("category_id");
    
    if (!subjectName) {
      return;
    }

    const selectedCategory = categories?.find(c => c.id === categoryId);
    const categoryName = selectedCategory 
      ? getCategoryHierarchyDisplay(selectedCategory.id, categories || [])
      : undefined;

    generateContent.mutate({
      type: 'subject_description',
      context: {
        subjectName,
        categoryName,
      },
    }, {
      onSuccess: (data) => {
        if (data?.content) {
          form.setValue('description', data.content);
        }
      },
    });
  };

  const isLoading = isLoadingSubject || isLoadingCategories;

  if (isLoading && isEdit) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/popular-subjects")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-3xl font-bold">
              {isEdit ? "Edit Subject" : "Add Subject"}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {isEdit ? "Manage subject details, chapters, and questions" : "Create a new subject"}
            </p>
          </div>
        </div>
        
        {/* Server IP Selector - only show in edit mode */}
        {isEdit && subject && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Video Server:</Label>
            <Select
              value={(subject as any).server_ip || '69.197.145.4'}
              onValueChange={(newIp) => {
                updateSubject.mutate({ id: id!, server_ip: newIp });
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {VIDEO_SERVER_OPTIONS.map((server) => (
                  <SelectItem key={server.ip} value={server.ip}>
                    <div className="flex flex-col">
                      <span>{server.label}</span>
                      <span className="text-xs text-muted-foreground">{server.ip}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-6 md:flex md:flex-nowrap w-full h-auto p-1 bg-muted/50 gap-1">
            <TabsTrigger value="basic" className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Basic</span>
            </TabsTrigger>
            <TabsTrigger value="documents" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <FileJson className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Docs</span>
            </TabsTrigger>
            <TabsTrigger value="instructors" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Instructors</span>
            </TabsTrigger>
            <TabsTrigger value="courses" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <GraduationCap className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Courses</span>
            </TabsTrigger>
            <TabsTrigger value="chapters" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <List className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Chapters</span>
            </TabsTrigger>
            <TabsTrigger value="questions" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <Brain className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Question Bank</span>
            </TabsTrigger>
            <TabsTrigger value="previous-year" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Questions</span>
            </TabsTrigger>
            <TabsTrigger value="pyqs" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <ClipboardList className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">PYQ's</span>
            </TabsTrigger>
            <TabsTrigger value="generate-video" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <Video className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Video</span>
            </TabsTrigger>
            <TabsTrigger value="reels" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <Film className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Reels</span>
            </TabsTrigger>
            <TabsTrigger value="stories" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Stories</span>
            </TabsTrigger>
            <TabsTrigger value="notes" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <NotebookTabs className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="ask-ai" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <Bot className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Ask AI</span>
            </TabsTrigger>
            <TabsTrigger value="languages" disabled={!isEdit} className="gap-1 md:gap-2 px-1 md:px-3 py-2">
              <Languages className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-[9px] md:text-sm truncate">Languages</span>
            </TabsTrigger>
          </TabsList>

        {/* Tab 1: Basic Information */}
        <TabsContent value="basic">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Subject Information</CardTitle>
                  <CardDescription>
                    Basic details about the subject
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Physics (NEET/JEE)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., physics-neet-jee" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL-friendly identifier (auto-generated)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Description</FormLabel>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleGenerateDescription}
                            disabled={!form.watch("name") || generateContent.isPending}
                            className="gap-2"
                          >
                            {generateContent.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            AI Write
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of this subject..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image Upload Section - Storage-based */}
                  <div className="space-y-4">
                    <Label>Subject Thumbnail</Label>
                    <ImageUploadWidget
                      label=""
                      value={storageThumbnailUrl || form.watch("thumbnail_url") || ""}
                      onChange={(url) => {
                        if (url === null && id) {
                          // Delete from storage
                          deleteThumbnail.mutate(id);
                        }
                        form.setValue("thumbnail_url", url || "");
                      }}
                      onFileSelect={async (file) => {
                        if (!id) {
                          // For new subjects, use legacy form field temporarily
                          return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                          });
                        }
                        // For existing subjects, upload to Storage
                        const storageUrl = await uploadThumbnail.mutateAsync({ subjectId: id, file });
                        return storageUrl;
                      }}
                    />
                  </div>

                  {/* AI Image Generation */}
                  <div className="space-y-2">
                    <Label>Or Generate with AI</Label>
                    <AIImageGenerator
                      suggestedPrompt={`Educational illustration for ${form.watch("name") || "subject"}, ${form.watch("description") || ""}, professional, modern, clean design by Simple Lecture`}
                      onImageGenerated={(url) => form.setValue("thumbnail_url", url)}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="display_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Lower numbers appear first in lists
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                          <FormDescription>
                            Make this subject visible to users
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50">
                            {categories?.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {getCategoryHierarchyDisplay(category.id, categories)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the primary category for this subject
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex items-center gap-4">
                <Button
                  type="submit"
                  disabled={createSubject.isPending || updateSubject.isPending}
                >
                  {createSubject.isPending || updateSubject.isPending
                    ? "Saving..."
                    : isEdit
                    ? "Update Subject"
                    : "Create Subject"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/popular-subjects")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Tab 2: Instructors */}
        <TabsContent value="instructors">
          {isEdit && id ? (
            <SubjectInstructorsTab subjectId={id} subjectName={subject?.name || ""} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to manage instructors
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: Courses */}
        <TabsContent value="courses">
          {isEdit && id ? (
            <SubjectCoursesTab subjectId={id} subjectName={subject?.name || ""} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to view related courses
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 4: Chapters & Topics */}
        <TabsContent value="chapters">
          {isEdit && id ? (
            <SubjectChaptersTab 
              subjectId={id} 
              subjectName={subject?.name || ""} 
              categoryId={(subject as any)?.category_id}
              categoryName={
                subject && (subject as any).category_id && categories
                  ? getCategoryHierarchyDisplay((subject as any).category_id, categories)
                  : undefined
              }
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to manage chapters and topics
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 5: Questions */}
        <TabsContent value="questions">
          {isEdit && id ? (
            <SubjectQuestionsTab 
              subjectId={id} 
              subjectName={subject?.name || ""} 
              categoryId={(subject as any)?.category_id}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to manage questions
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 6: Previous Year Papers */}
        <TabsContent value="previous-year">
          {isEdit && id ? (
            <SubjectPreviousYearTab subjectId={id} subjectName={subject?.name || ""} categoryId={subject?.category_id || ""} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to manage previous year papers
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 7: Documents (JSON/PDF) */}
        <TabsContent value="documents">
          {isEdit && id ? (
            <SubjectDocumentsTab 
              subjectId={id} 
              subjectName={subject?.name || ""} 
              currentJson={(fullSubject as any)?.content_json}
              currentPdfUrl={(fullSubject as any)?.json_source_pdf_url}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to manage documents
              </CardContent>
            </Card>
          )}
        </TabsContent>


        {/* Tab 10: Generate Video */}
        <TabsContent value="generate-video">
          {isEdit && id ? (
            <SubjectVideoGeneratorTab 
              subjectId={id} 
              subjectName={subject?.name || ""} 
              serverIp={(subject as any)?.server_ip || '69.197.145.4'}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to generate videos
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Reels */}
        <TabsContent value="reels">
          {isEdit && id ? (
            <SubjectReelsTab subjectId={id} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to manage reels.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Stories */}
        <TabsContent value="stories">
          {isEdit && id ? (
            <SubjectStoriesTab subjectId={id} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to submit stories.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Notes */}
        <TabsContent value="notes">
          {isEdit && id ? (
            <SubjectNotesTab
              subjectId={id}
              subjectName={subject?.name || ""}
              subjectSlug={(subject as any)?.slug || ""}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to generate notes.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Ask AI */}
        <TabsContent value="ask-ai">
          {isEdit && id ? (
            <SubjectAskAITab
              subjectId={id}
              subjectName={subject?.name || ""}
              subjectSlug={(subject as any)?.slug || ""}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to use Ask AI.
              </CardContent>
            </Card>
          )}
        </TabsContent>




        {/* Tab 11: Languages */}
        <TabsContent value="languages">
          {isEdit && id ? (
            <SubjectLanguagesTab
              subjectId={id}
              subjectName={subject?.name || ""}
              serverIp={(subject as any)?.server_ip || '69.197.145.4'}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to generate language avatars
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 12: PYQ's */}
        <TabsContent value="pyqs">
          {isEdit && id ? (
            <SubjectPYQTab subjectId={id} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Save the subject first to manage PYQ questions
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
