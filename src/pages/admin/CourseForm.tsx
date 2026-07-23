import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save } from "lucide-react";
import { useAdminCourse, useCreateCourse, useUpdateCourse } from "@/hooks/useAdminCourses";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CourseGeneralTab } from "@/components/admin/course/CourseGeneralTab";
import { CourseCategoriesTab } from "@/components/admin/course/CourseCategoriesTab";
import { CourseSubjectsTab } from "@/components/admin/course/CourseSubjectsTab";
import { CourseContentTab } from "@/components/admin/course/CourseContentTab";
import { CourseFAQsTab } from "@/components/admin/course/CourseFAQsTab";
import { CourseInstructorsTab } from "@/components/admin/course/CourseInstructorsTab";
import { CoursePricingTab } from "@/components/admin/course/CoursePricingTab";
import { CourseTopUpsTab } from "@/components/admin/course/CourseTopUpsTab";
import { CoursePromoCodesTab } from "@/components/admin/course/CoursePromoCodesTab";
import { CourseFreeAccessTab } from "@/components/admin/course/CourseFreeAccessTab";
import { CourseSEOTab } from "@/components/admin/course/CourseSEOTab";
import { toast } from "sonner";

export default function CourseForm() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data: course } = useAdminCourse(courseId);
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();

  const [formData, setFormData] = useState<any>({
    name: "",
    slug: "",
    short_description: "",
    detailed_description: "",
    thumbnail_url: "",
    promotional_video_url: "",
    duration_months: 0,
    price_inr: 0,
    original_price_inr: 0,
    what_you_learn: [],
    course_includes: [],
    is_active: true,
    ai_tutoring_enabled: false,
    ai_tutoring_price: 2000,
    live_classes_enabled: false,
    live_classes_price: 2000,
    available_languages: ["english"] as string[],
    language_topup_price: 0,
    language_topup_original_price: 0,
    is_coming_soon: false,
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    og_title: "",
    og_description: "",
    og_image_url: "",
    seo_canonical_url: "",
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("general");

  // Fetch existing course categories
  const { data: courseCategories } = useQuery({
    queryKey: ["course-categories", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data } = await supabase
        .from("course_categories")
        .select("category_id")
        .eq("course_id", courseId);
      return data || [];
    },
    enabled: !!courseId,
  });

  // Prefill selected categories when course loads
  useEffect(() => {
    if (courseCategories) {
      setSelectedCategories(courseCategories.map((cc) => cc.category_id));
    }
  }, [courseCategories]);

  useEffect(() => {
    if (course) {
      const courseData = course as any; // Type assertion for new fields not yet in generated types
      setFormData({
        id: course.id, // Include the course ID for thumbnail saving
        name: course.name || "",
        slug: course.slug || "",
        short_description: course.short_description || "",
        detailed_description: course.detailed_description || "",
        thumbnail_url: course.thumbnail_url || "",
        promotional_video_url: courseData.promotional_video_url || "",
        duration_months: course.duration_months || 0,
        price_inr: course.price_inr || 0,
        original_price_inr: course.original_price_inr || 0,
        what_you_learn: course.what_you_learn || [],
        course_includes: course.course_includes || [],
        is_active: course.is_active ?? true,
        ai_tutoring_enabled: courseData.ai_tutoring_enabled || false,
        ai_tutoring_price: courseData.ai_tutoring_price || 2000,
        live_classes_enabled: courseData.live_classes_enabled || false,
        live_classes_price: courseData.live_classes_price || 2000,
        available_languages: courseData.available_languages || ["english"],
        language_topup_price: courseData.language_topup_price || 0,
        language_topup_original_price: courseData.language_topup_original_price || 0,
        is_coming_soon: courseData.is_coming_soon ?? false,
        seo_title: courseData.seo_title || "",
        seo_description: courseData.seo_description || "",
        seo_keywords: courseData.seo_keywords || "",
        og_title: courseData.og_title || "",
        og_description: courseData.og_description || "",
        og_image_url: courseData.og_image_url || "",
        seo_canonical_url: courseData.seo_canonical_url || "",
      });
    }
  }, [course]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    
    // Auto-generate slug from name
    if (field === "name" && !courseId) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      setFormData((prev: any) => ({ ...prev, slug }));
    }
  };

  const saveCourseCategories = async (cId: string) => {
    try {
      // Delete existing mappings
      await supabase.from("course_categories").delete().eq("course_id", cId);
      
      // Insert new mappings
      if (selectedCategories.length > 0) {
        const { error } = await supabase.from("course_categories").insert(
          selectedCategories.map((categoryId) => ({
            course_id: cId,
            category_id: categoryId,
          }))
        );
        if (error) throw error;
      }
    } catch (error: any) {
      toast.error("Failed to save course categories: " + error.message);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      toast.error("Please fill in required fields");
      return;
    }

    if (courseId) {
      updateCourse.mutate(
        { id: courseId, ...formData },
        {
          onSuccess: async () => {
            try {
              await saveCourseCategories(courseId);
              toast.success("Course and categories updated successfully");
            } catch {
              toast.error("Course updated but categories failed to save");
            }
          },
        }
      );
    } else {
      createCourse.mutate(formData, {
        onSuccess: async (data) => {
          try {
            await saveCourseCategories(data.id);
            toast.success("Course and categories created successfully");
            navigate(`/admin/courses/${data.id}/edit`);
          } catch {
            toast.error("Course created but categories failed to save");
            navigate(`/admin/courses/${data.id}/edit`);
          }
        },
      });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/courses")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {courseId ? "Edit Course" : "Create New Course"}
            </h1>
            <p className="text-muted-foreground">
              {courseId ? "Update course details" : "Add a new course to your platform"}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={createCourse.isPending || updateCourse.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {courseId ? "Update" : "Create"} Course
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-11">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="freeaccess" disabled={!courseId}>Free Access</TabsTrigger>
              <TabsTrigger value="instructors" disabled={!courseId}>Instructors</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="topups">Top-Ups</TabsTrigger>
              <TabsTrigger value="content" disabled={!courseId}>Content</TabsTrigger>
              <TabsTrigger value="faqs" disabled={!courseId}>FAQs</TabsTrigger>
              <TabsTrigger value="promocodes" disabled={!courseId}>Promo Codes</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 pt-6">
              <CourseGeneralTab formData={formData} onChange={handleChange} />
            </TabsContent>

            <TabsContent value="categories" className="space-y-6 pt-6">
              <CourseCategoriesTab
                selectedCategories={selectedCategories}
                onChange={setSelectedCategories}
              />
            </TabsContent>

            <TabsContent value="subjects" className="space-y-6 pt-6">
              <CourseSubjectsTab courseId={courseId} selectedCategories={selectedCategories} />
            </TabsContent>

            <TabsContent value="freeaccess" className="space-y-6 pt-6">
              <CourseFreeAccessTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="instructors" className="space-y-6 pt-6">
              <CourseInstructorsTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6 pt-6">
              <CoursePricingTab formData={formData} onChange={handleChange} />
            </TabsContent>

            <TabsContent value="topups" className="space-y-6 pt-6">
              <CourseTopUpsTab
                selectedLanguages={formData.available_languages}
                onChange={(languages) => handleChange("available_languages", languages)}
                languageTopupPrice={formData.language_topup_price}
                languageTopupOriginalPrice={formData.language_topup_original_price}
                onPriceChange={handleChange}
              />
            </TabsContent>

            <TabsContent value="content" className="space-y-6 pt-6">
              <CourseContentTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="faqs" className="space-y-6 pt-6">
              <CourseFAQsTab
                courseId={courseId}
                courseName={formData.name}
                shortDescription={formData.short_description}
              />
            </TabsContent>

            <TabsContent value="promocodes" className="space-y-6 pt-6">
              <CoursePromoCodesTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="seo" className="space-y-6 pt-6">
              <CourseSEOTab formData={formData} onChange={handleChange} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}