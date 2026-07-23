import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEO";
import Learning from "./Learning";

interface PreviewCourseMeta {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  thumbnail_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  seo_canonical_url: string | null;
}

const usePreviewCourseBySlug = (slug?: string) =>
  useQuery({
    queryKey: ["course-preview-route-meta", slug],
    enabled: !!slug,
    retry: 2,
    queryFn: async (): Promise<PreviewCourseMeta | null> => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, name, slug, short_description, thumbnail_url, seo_title, seo_description, seo_keywords, og_title, og_description, og_image_url, seo_canonical_url"
        )
        .eq("slug", slug!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data as PreviewCourseMeta) || null;
    },
  });

const useEnrollmentCheck = (courseId?: string) =>
  useQuery({
    queryKey: ["enrollment-check-for-preview", courseId],
    enabled: !!courseId,
    retry: 1,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return { enrolled: false };
      const { data, error } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", courseId!)
        .eq("student_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      return { enrolled: !!data };
    },
  });

export default function CoursePreviewRoute() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: course, isLoading: loading } = usePreviewCourseBySlug(slug);
  const { data: enrollment } = useEnrollmentCheck(course?.id);

  useEffect(() => {
    if (course?.id && enrollment?.enrolled) {
      navigate(`/learning/${course.id}`, { replace: true });
    }
  }, [course?.id, enrollment?.enrolled, navigate]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Course not found</h2>
            <Button onClick={() => navigate("/programs")}>Browse Programs</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (enrollment?.enrolled) {
    return null;
  }

  const seoTitle =
    course.seo_title?.trim() ||
    `${course.name} — Online Coaching & Live Classes`;
  const seoDescription =
    course.seo_description?.trim() ||
    course.short_description?.trim() ||
    `${course.name} — online coaching with live classes, recorded video lectures, AI doubt solver and mock tests on SimpleLecture.`;
  const seoKeywords =
    course.seo_keywords?.trim() ||
    `${course.name}, ${course.name} online coaching, ${course.name} video lectures, ${course.name} mock test, SimpleLecture`;
  const ogImage =
    course.og_image_url?.trim() ||
    course.thumbnail_url ||
    undefined;
  const canonical =
    course.seo_canonical_url?.trim() ||
    `https://simplelecture.com/course/${course.slug}`;

  const previewSeo = {
    title: seoTitle,
    description: seoDescription,
    keywords: seoKeywords,
    ogImage,
    canonicalUrl: canonical,
    ogTitle: course.og_title?.trim() || seoTitle,
    ogDescription: course.og_description?.trim() || seoDescription,
  };

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        ogImage={ogImage}
        canonicalUrl={canonical}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: course.name,
            description: seoDescription,
            url: canonical,
            ...(ogImage ? { image: ogImage } : {}),
            provider: {
              "@type": "EducationalOrganization",
              name: "SimpleLecture",
              url: "https://simplelecture.com",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://simplelecture.com/" },
              { "@type": "ListItem", position: 2, name: "Programs", item: "https://simplelecture.com/programs" },
              { "@type": "ListItem", position: 3, name: course.name, item: canonical },
            ],
          },
        ]}
      />
      <Learning
        previewMode
        previewCourseId={course.id}
        previewCourseSlug={course.slug}
        previewCourseName={course.name}
        previewSeo={previewSeo}
      />
    </>
  );
}
