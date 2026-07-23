import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { goHome } from "@/lib/goHome";
import { SmartHeader } from "@/components/SmartHeader";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEO";
import { generateCourseSchema, generateBreadcrumbSchema } from "@/lib/seo/structuredData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSubjectDetail, useSubjectChapterTopics, useCheckSubjectEnrollment, useSiblingSubjects } from "@/hooks/useSubjectDetail";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomNav } from "@/components/mobile/BottomNav";
import { 
  BookOpen, 
  Clock, 
  Lock, 
  CheckCircle2, 
  Brain, 
  MessageCircle, 
  FileQuestion, 
  Target, 
  Calendar,
  FileText,
  ClipboardCheck,
  PlayCircle,
  FileDown,
  ArrowLeft,
  GraduationCap,
  ChevronRight,
  ShoppingCart
} from "lucide-react";

// Sibling subject navigation pills (used on all viewports)
const SiblingSubjectNav = ({ siblingData, currentSubjectId, courseSlug }: { siblingData: any[], currentSubjectId: string, courseSlug?: string }) => {
  if (!siblingData || siblingData.length === 0) return null;

  // Filter to only the matching course if courseSlug is provided
  const filteredData = courseSlug 
    ? siblingData.filter((g: any) => g.courseSlug === courseSlug)
    : siblingData;

  if (filteredData.length === 0) return null;

  return (
    <div className="space-y-2">
      {filteredData.map((courseGroup: any) => (
        <div key={courseGroup.courseId}>
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
            <Link to={`/course/${courseGroup.courseSlug}`} className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
              {courseGroup.courseName}
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {courseGroup.subjects.map((sub: any) => (
              <Link
                key={sub.id}
                to={`/subject/${sub.slug}${courseSlug ? `?course=${courseSlug}` : ''}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  sub.id === currentSubjectId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                {sub.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const SubjectDetail = () => {
  const { subjectSlug } = useParams<{ subjectSlug: string }>();
  const [searchParams] = useSearchParams();
  const courseSlug = searchParams.get('course') || undefined;
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const { data: subject, isLoading: loadingSubject } = useSubjectDetail(subjectSlug);
  const { data: chaptersData, isLoading: loadingChapters } = useSubjectChapterTopics(subject?.id);
  const { data: enrollmentData } = useCheckSubjectEnrollment(subject?.id);
  const { data: siblingData } = useSiblingSubjects(subject?.id);

  const isEnrolled = enrollmentData?.isEnrolled || false;
  const enrolledCourses = enrollmentData?.courses || [];

  // Determine enroll URL: prefer courseSlug from URL, then first sibling course, fallback to /programs
  const enrollUrl = courseSlug
    ? `/enroll/${courseSlug}`
    : siblingData && siblingData.length > 0 && siblingData[0].courseSlug
      ? `/enroll/${siblingData[0].courseSlug}`
      : "/programs";

  const features = [
    { icon: Brain, title: "AI-Based Tutorial", description: "Personalized learning with AI" },
    { icon: MessageCircle, title: "Instant AI Help", description: "Get answers instantly" },
    { icon: FileQuestion, title: "Question Bank", description: "Extensive practice questions" },
    { icon: Target, title: "Practice Sessions", description: "Interactive practice" },
    { icon: Calendar, title: "Daily Practice Tests", description: "Regular assessments" },
    { icon: FileText, title: "Detailed Notes", description: "Comprehensive materials" },
    { icon: ClipboardCheck, title: "Assignments", description: "Graded assignments" },
  ];

  const totalTopics = chaptersData?.reduce((acc: number, ch: any) => acc + (ch.subject_topics?.length || 0), 0) || 0;

  // Keyword-rich SEO metadata
  const subjectName = subject?.name || "";
  const seoTitle = subjectName ? `${subjectName} Online Classes – Video Lectures, Notes & Tests` : "Subject";
  const seoDescription = subjectName
    ? `Learn ${subjectName} online with ${chaptersData?.length || 0}+ chapters, video lectures, AI doubt solver, practice questions and mock tests. ${subject?.description ? subject.description.slice(0, 100) : 'Comprehensive coverage aligned with NEET, JEE & board exam syllabus.'} Enroll today.`
    : "";
  const seoKeywords = subjectName
    ? `${subjectName} online classes, ${subjectName} online lectures, ${subjectName} video lectures, ${subjectName} online tuition, ${subjectName} mock test, ${subjectName} MCQ practice, ${subjectName} for NEET, ${subjectName} for JEE, online learning, AI tutor`
    : "";
  const seoCanonical = subjectSlug ? `https://simplelecture.com/subject/${subjectSlug}` : undefined;
  const subjectStructuredData = subject ? {
    "@context": "https://schema.org",
    "@graph": [
      generateCourseSchema({
        name: `${subjectName} Online Classes`,
        description: subject.description || `Complete ${subjectName} online course with video lectures, practice tests and AI doubt clearing.`,
      }),
      generateBreadcrumbSchema([
        { name: "Home", url: "https://simplelecture.com/" },
        { name: "Programs", url: "https://simplelecture.com/programs" },
        { name: subjectName, url: `https://simplelecture.com/subject/${subjectSlug}` },
      ]),
    ],
  } : undefined;
  // Loading state
  if (loadingSubject || loadingChapters) {
    if (isMobile) {
      return (
        <div className="min-h-screen bg-background">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mx-4 mt-4 h-48 rounded-xl" />
          <div className="px-4 mt-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <BottomNav />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col">
        <SmartHeader />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <Skeleton className="h-64 mb-8" />
            <Skeleton className="h-12 w-96 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not found state
  if (!subject) {
    if (isMobile) {
      return (
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <button onClick={() => navigate("/programs")} className="p-1"><ArrowLeft className="h-5 w-5" /></button>
            <span className="font-semibold">Not Found</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="space-y-3">
              <h1 className="text-xl font-bold">Subject Not Found</h1>
              <Button size="sm" onClick={() => navigate("/programs")}>Browse Programs</Button>
            </div>
          </div>
          <BottomNav />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col">
        <SmartHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Subject Not Found</h1>
            <Button onClick={() => goHome(navigate)}>Back to Home</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ============ MOBILE LAYOUT ============
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-36">
        <SEOHead
          title={seoTitle}
          description={seoDescription}
          keywords={seoKeywords}
          canonicalUrl={seoCanonical}
          structuredData={subjectStructuredData}
        />

        {/* Mobile Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/programs")}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="flex-1 font-semibold text-sm line-clamp-1">{subject.name}</h1>
          </div>
        </div>

        {/* Sibling Subject Navigation */}
        {siblingData && siblingData.length > 0 && (
          <div className="px-4 pt-3">
            <SiblingSubjectNav siblingData={siblingData} currentSubjectId={subject.id} courseSlug={courseSlug} />
          </div>
        )}

        {/* Thumbnail */}
        {subject.thumbnail_url && (
          <div className="mx-4 mt-3">
            <img
              src={subject.thumbnail_url}
              alt={subject.name}
              className="w-full aspect-video rounded-xl object-cover shadow-md"
            />
          </div>
        )}

        {/* Subject Info */}
        <div className="px-4 mt-4 space-y-3">
          {subject.categories && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
              {subject.categories.name}
            </Badge>
          )}

          <h2 className="text-lg font-bold leading-snug">{subject.name}</h2>

          {subject.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{subject.description}</p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
              <BookOpen className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold">{chaptersData?.length || 0} Chapters</span>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold">{totalTopics} Topics</span>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-4 mt-5 space-y-4">

          {/* Learning Features */}
          <Card className="border">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Brain className="h-4 w-4 text-primary" />
                Learning Features
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 relative">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <feature.icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-[11px] font-medium leading-tight">{feature.title}</span>
                    {!isEnrolled && <Lock className="h-2.5 w-2.5 text-muted-foreground absolute top-1.5 right-1.5" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Curriculum */}
          <div className="space-y-2.5">
            <h3 className="flex items-center gap-2 font-bold text-sm">
              <BookOpen className="h-4 w-4 text-primary" />
              Curriculum ({chaptersData?.length || 0} Chapters)
            </h3>
            
            {!chaptersData || chaptersData.length === 0 ? (
              <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">No content available yet.</p></CardContent></Card>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {chaptersData.map((chapter: any) => (
                  <Card key={chapter.id} className="border">
                    <AccordionItem value={`chapter-${chapter.id}`} className="border-0">
                      <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                        <div className="flex items-start gap-2 text-left flex-1">
                          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5">
                            Ch {chapter.chapter_number}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-semibold line-clamp-2">{chapter.title}</h4>
                            <div className="flex gap-1.5 mt-1">
                              <span className="text-[10px] text-muted-foreground">{chapter.subject_topics?.length || 0} Topics</span>
                              {chapter.pdf_url && <Badge variant="secondary" className="text-[9px] px-1 py-0"><FileDown className="h-2 w-2 mr-0.5" />PDF</Badge>}
                              {chapter.video_id && <Badge variant="secondary" className="text-[9px] px-1 py-0"><PlayCircle className="h-2 w-2 mr-0.5" />Video</Badge>}
                            </div>
                          </div>
                          {!isEnrolled && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-3 pb-3 space-y-1.5">
                          {chapter.subject_topics?.map((topic: any) => (
                            <div key={topic.id} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="text-[9px] px-1 shrink-0">{topic.topic_number}</Badge>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium whitespace-normal break-words">{topic.title}</p>
                                </div>
                              </div>
                              {!isEnrolled && <Lock className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                ))}
              </Accordion>
            )}
          </div>
        </div>

        {/* Sticky Bottom CTA */}
        <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-40">
          <div className="px-4 py-3 flex items-center justify-between">
            {isEnrolled ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">Enrolled</span>
                </div>
                <Button size="sm" asChild>
                  <Link to="/dashboard">Start Learning</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Enroll via course</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={enrolledCourses.length > 0 ? `/course/${enrolledCourses[0].slug}` : "/programs"}>
                      <Target className="h-3.5 w-3.5 mr-1.5" />
                      {enrolledCourses.length > 0 ? "Back to Course" : "Explore Courses"}
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to={enrollUrl}>
                      <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                      Enroll Now
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ============ DESKTOP / TABLET LAYOUT ============
  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        canonicalUrl={seoCanonical}
        structuredData={subjectStructuredData}
      />
      <SmartHeader />
      
      <main className="flex-1">
        {/* Breadcrumb Navigation */}
        {enrolledCourses.length > 0 && (
          <div className="bg-muted/30 border-b">
            <div className="container mx-auto px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Available in:
                </span>
                {enrolledCourses.map((course: any, index: number) => (
                  <div key={course.id} className="flex items-center gap-2">
                    <Button asChild variant="link" className="h-auto p-0 text-sm font-medium">
                      <Link to={`/course/${course.slug}`} className="flex items-center gap-1 hover:text-primary">
                        <ArrowLeft className="h-3 w-3" />
                        {course.name}
                      </Link>
                    </Button>
                    {index < enrolledCourses.length - 1 && <span className="text-muted-foreground">•</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sibling Subject Navigation (Desktop/Tablet) */}
        {siblingData && siblingData.length > 0 && (
          <div className="border-b bg-muted/20">
            <div className="container mx-auto px-4 py-3">
              <SiblingSubjectNav siblingData={siblingData} currentSubjectId={subject.id} courseSlug={courseSlug} />
            </div>
          </div>
        )}

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
          <div className="container mx-auto px-4 py-1 relative">
            <div className="grid lg:grid-cols-2 gap-4 items-center">
              <div className="space-y-2">
                {subject.categories && (
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {subject.categories.name}
                  </Badge>
                )}
                
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
                  {subject.name}
                </h1>
                
                {subject.description && (
                  <p className="text-base opacity-90 leading-normal max-w-2xl">
                    {subject.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-2 py-0.5">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-sm font-semibold">{chaptersData?.length || 0} Chapters</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-2 py-0.5">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-semibold">{totalTopics} Topics</span>
                  </div>
                </div>

                {isEnrolled ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 bg-green-500/20 text-white border-2 border-white/30 rounded-full px-3 py-1 w-fit">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-semibold">You're Enrolled</span>
                    </div>
                    <p className="text-xs opacity-80">
                      Available via: {enrolledCourses.map((c: any) => c.name).join(", ")}
                    </p>
                    <Button size="sm" variant="secondary" asChild className="mt-2">
                      <Link to="/dashboard">Start Learning</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                      <Lock className="h-5 w-5" />
                      <span className="text-sm">Unlock all content by enrolling in a course</span>
                    </div>
                    <div className="flex gap-3">
                      <Button size="sm" variant="secondary" asChild className="shadow-xl">
                        <Link to={enrolledCourses.length > 0 ? `/course/${enrolledCourses[0].slug}` : "/programs"}>
                          <Target className="h-4 w-4 mr-2" />
                          {enrolledCourses.length > 0 ? "Back to Course" : "Explore Courses"}
                        </Link>
                      </Button>
                      <Button size="sm" asChild className="shadow-xl bg-white text-primary hover:bg-white/90">
                        <Link to={enrollUrl}>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Enroll Now
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {subject.thumbnail_url && (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/50 to-transparent rounded-2xl" />
                  <img
                    src={subject.thumbnail_url}
                    alt={subject.name}
                    className="rounded-2xl shadow-2xl w-full h-auto max-h-48 object-cover border-4 border-white/20"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-8 md:py-16 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">Complete Learning Experience</h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to master {subject.name} in one comprehensive package
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="relative border-2 hover:shadow-xl transition-all hover:scale-[1.02] group">
                  <CardContent className="p-4 md:p-6">
                    <div className="p-2 md:p-3 bg-primary/10 rounded-xl w-fit mb-3 md:mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                    </div>
                    <h3 className="text-base md:text-xl font-semibold mb-1 md:mb-2">{feature.title}</h3>
                    <p className="text-xs md:text-base text-muted-foreground">{feature.description}</p>
                    {!isEnrolled && (
                      <div className="absolute top-3 right-3 md:top-4 md:right-4 p-1.5 md:p-2 bg-muted rounded-full">
                        <Lock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Curriculum Section */}
        <section className="py-8 md:py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="mb-8 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-2 md:mb-4">Complete Course Curriculum</h2>
              <p className="text-base md:text-lg text-muted-foreground">
                Structured learning path with {chaptersData?.length || 0} comprehensive chapters covering all essential topics
              </p>
            </div>
            
            {!chaptersData || chaptersData.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No content available yet.</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="space-y-4">
                {chaptersData.map((chapter: any) => (
                  <Card key={chapter.id}>
                    <AccordionItem value={`chapter-${chapter.id}`} className="border-0">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-start gap-4 text-left flex-1">
                          <Badge variant="outline" className="shrink-0">Ch {chapter.chapter_number}</Badge>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold">{chapter.title}</h3>
                            {chapter.description && <p className="text-sm text-muted-foreground mt-1">{chapter.description}</p>}
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">{chapter.subject_topics?.length || 0} Topics</Badge>
                              {chapter.pdf_url && <Badge variant="secondary" className="text-xs"><FileDown className="h-3 w-3 mr-1" />PDF</Badge>}
                              {chapter.video_id && <Badge variant="secondary" className="text-xs"><PlayCircle className="h-3 w-3 mr-1" />Video</Badge>}
                            </div>
                          </div>
                          {!isEnrolled && <Lock className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-6 pb-4 space-y-2">
                          {chapter.subject_topics?.map((topic: any) => (
                            <div key={topic.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                              <div className="flex items-center gap-3 flex-1">
                                <Badge variant="outline" className="text-xs">{topic.topic_number}</Badge>
                                <div className="flex-1">
                                  <p className="font-medium">{topic.title}</p>
                                  {topic.description && <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>}
                                  <div className="flex gap-2 mt-1">
                                    {topic.pdf_url && <Badge variant="secondary" className="text-xs"><FileDown className="h-3 w-3 mr-1" />PDF</Badge>}
                                    {topic.video_id && <Badge variant="secondary" className="text-xs"><PlayCircle className="h-3 w-3 mr-1" />Video</Badge>}
                                  </div>
                                </div>
                              </div>
                              {!isEnrolled && <Lock className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                ))}
              </Accordion>
            )}
          </div>
        </section>

        {/* CTA Section */}
        {!isEnrolled && (
          <section className="py-10 md:py-16 bg-gradient-to-r from-primary via-primary/95 to-primary/90 text-primary-foreground">
            <div className="container mx-auto px-4 text-center">
              <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
                <h2 className="text-2xl md:text-4xl font-bold">Ready to Master {subject.name}?</h2>
                <p className="text-base md:text-2xl opacity-90">
                  Join thousands of students and unlock complete access to all chapters, topics, practice tests, and AI-powered learning tools
                </p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-2 md:pt-4">
                  <Button size="lg" variant="secondary" asChild className="shadow-xl text-base md:text-lg px-6 md:px-8">
                    <Link to={enrolledCourses.length > 0 ? `/course/${enrolledCourses[0].slug}` : "/programs"}>
                      <Target className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                      {enrolledCourses.length > 0 ? "Back to Course" : "Explore Courses"}
                    </Link>
                  </Button>
                  <Button size="lg" asChild className="shadow-xl bg-white text-primary hover:bg-white/90 text-base md:text-lg px-6 md:px-8">
                    <Link to={enrollUrl}>
                      <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                      Enroll Now
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SubjectDetail;
