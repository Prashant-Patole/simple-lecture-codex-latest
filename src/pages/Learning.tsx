import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAIAssistantJob } from "@/contexts/AIAssistantJobContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle, Circle, Lock, AlertCircle, PanelLeftClose, PanelLeft, FolderOpen, ArrowLeft, BookOpen, BookMarked, ChevronRight, Video, Sparkles, ClipboardList, FileText, Target, BarChart3, HelpCircle, MessageCircleQuestion, Menu, Lightbulb } from "lucide-react";


import { SubjectNavigationBar } from "@/components/learning/SubjectNavigationBar";

import { AssignmentViewer } from "@/components/learning/AssignmentViewer";
import { RecordedVideos } from "@/components/learning/RecordedVideos";
import { AITeachingAssistant } from "@/components/learning/AITeachingAssistant";
import { PreviousYearPapers } from "@/components/learning/PreviousYearPapers";
import { PaperTestResults } from "@/components/learning/PaperTestResults";
import { DPPTab } from "@/components/learning/DPPTab";
import { DoubtsTab } from "@/components/learning/DoubtsTab";
import { CheckerQuestionsList } from "@/components/checker/CheckerQuestionsList";
import { QuestionsTab } from "@/components/learning/QuestionsTab";
import { SolutionsTab } from "@/components/learning/SolutionsTab";
import { PYQsStudentTab } from "@/components/learning/PYQsStudentTab";
import { NotesTab } from "@/components/learning/notes/NotesTab";
import { ImportantNotesTab } from "@/components/learning/notes/ImportantNotesTab";

import { CourseWelcomeCards } from "@/components/learning/CourseWelcomeCards";
import { SEOHead } from "@/components/SEO";
import { useLearningCourse, useSubjectChapters } from "@/hooks/useLearningCourse";
import { useIsChecker } from "@/hooks/useIsChecker";
import { useCheckerCourseData } from "@/hooks/useCheckerCourseData";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { BottomNav } from "@/components/mobile/BottomNav";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/contexts/AuthContext";
import { useCourseFreeAccess, useCourseFreePreviewLimits } from "@/hooks/useCourseFreeAccess";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PurchaseRequiredDialog } from "@/components/course/PurchaseRequiredDialog";
import { QuotaExhaustedDialog } from "@/components/course/QuotaExhaustedDialog";
import { refreshLearningResults } from "@/lib/refreshLearningResults";


interface PreviewSeoOverride {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
}

interface LearningProps {
  previewMode?: boolean;
  previewCourseId?: string;
  previewCourseSlug?: string;
  previewCourseName?: string;
  previewSeo?: PreviewSeoOverride;
}

// Lightweight preview-mode data fetch (mirrors useLearningCourse shape, no enrollment required)
const usePreviewLearningData = (courseId?: string, enabled?: boolean) =>
  useQuery({
    queryKey: ["preview-learning-data", courseId],
    enabled: !!courseId && !!enabled,
    retry: 2,
    queryFn: async () => {
      const { data: course, error } = await supabase
        .from("courses")
        .select(
          "id, name, slug, thumbnail_url, available_languages, language_topup_price, language_topup_original_price",
        )
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;
      if (!course) return { course: null, subjects: [], isEnrolled: false, error: "course_not_found" };

      const { data: cs, error: csErr } = await supabase
        .from("course_subjects")
        .select("display_order, subject:popular_subjects(id, name, slug, thumbnail_url)")
        .eq("course_id", course.id)
        .order("display_order");
      if (csErr) throw csErr;

      const subjects = (cs || [])
        .map((row: any) => row.subject && {
          id: row.subject.id,
          name: row.subject.name,
          slug: row.subject.slug,
          thumbnail_url: row.subject.thumbnail_url || null,
        })
        .filter(Boolean);

      return { course, subjects, isEnrolled: false, error: null as string | null };
    },
  });

export default function Learning({
  previewMode = false,
  previewCourseId,
  previewCourseSlug,
  previewCourseName,
  previewSeo,
}: LearningProps = {}) {
  const params = useParams();
  const courseId = previewCourseId || params.courseId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const { data: currentUser } = useCurrentUser();
  const { isAuthenticated } = useAuth();

  const requireAuthForTopic = (_topicId: string): boolean => false;
  const screenProtected = false; // TEMPORARILY DISABLED

  // Content protection: block right-click, copy, cut, paste, keyboard shortcuts
  useEffect(() => {
    const blockEvent = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['s', 'u', 'p'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') ||
        e.key === 'F12' ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  // TEMPORARILY DISABLED - content protection overlay
  // useEffect(() => {
  //   const handleVisibility = () => {
  //     if (document.hidden) setScreenProtected(true);
  //     else setTimeout(() => setScreenProtected(false), 300);
  //   };
  //   const handleBlur = () => setScreenProtected(true);
  //   const handleFocus = () => setTimeout(() => setScreenProtected(false), 300);
  //   document.addEventListener('visibilitychange', handleVisibility);
  //   window.addEventListener('blur', handleBlur);
  //   window.addEventListener('focus', handleFocus);
  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibility);
  //     window.removeEventListener('blur', handleBlur);
  //     window.removeEventListener('focus', handleFocus);
  //   };
  // }, []);
  // Lock layout on mount to prevent fullscreen/orientation changes from switching layouts
  const [isMobile] = useState(() => window.innerWidth < 768);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [chapterTab, setChapterTab] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("videos");
  const [mobileStep, setMobileStep] = useState<'subjects' | 'chapters' | 'content'>('subjects');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // [DoubtsDebug] Parent state-change diagnostics
  useEffect(() => { console.log("[Learning] selectedSubjectId →", selectedSubjectId); }, [selectedSubjectId]);
  useEffect(() => { console.log("[Learning] selectedTopic →", selectedTopic?.id ?? null); }, [selectedTopic]);
  useEffect(() => { console.log("[Learning] selectedChapter →", selectedChapter?.id ?? null); }, [selectedChapter]);
  useEffect(() => { console.log("[Learning] activeTab →", activeTab); }, [activeTab]);
  
  const [pendingDoubtQuestion, setPendingDoubtQuestion] = useState<{
    questionText: string;
    correctAnswer: string;
    studentAnswer: string;
  } | null>(null);

  const [preloadedAIQuestion, setPreloadedAIQuestion] = useState<string | null>(null);
  const [preloadedAIResponse, setPreloadedAIResponse] = useState<any | null>(null);
  const openCachedInAITab = (questionText: string, cachedResponse: any) => {
    setPreloadedAIQuestion(questionText);
    setPreloadedAIResponse(cachedResponse);
    setActiveTab('ai-assistant');
  };
  const clearPreloadedAI = () => {
    setPreloadedAIQuestion(null);
    setPreloadedAIResponse(null);
  };


  const { isChecker, isLoading: checkerLoading } = useIsChecker();
  const { data: studentLearningData, isLoading: studentCourseLoading } = useLearningCourse(previewMode ? undefined : courseId);
  const { data: checkerCourseData, isLoading: checkerCourseLoading } = useCheckerCourseData(courseId, isChecker);
  const { data: previewData, isLoading: previewLoading } = usePreviewLearningData(courseId, previewMode);

  const learningData = previewMode
    ? previewData
    : (isChecker ? checkerCourseData : studentLearningData);
  const courseLoading = previewMode
    ? previewLoading
    : (checkerLoading || (isChecker ? checkerCourseLoading : studentCourseLoading));
  const aiUserTier: 'free' | 'pro' = learningData?.isEnrolled ? 'pro' : 'free';

  // Free-access (preview) chapters + per-course quota
  const { data: freeRows } = useCourseFreeAccess(previewMode ? courseId : undefined);
  const { data: previewLimits } = useCourseFreePreviewLimits(previewMode ? courseId : undefined);
  const unlockedChapterIds = useMemo(() => {
    const s = new Set<string>();
    (freeRows || []).forEach((r) => s.add(r.chapter_id));
    return s;
  }, [freeRows]);
  const unlockedSubjectIds = useMemo(() => {
    const s = new Set<string>();
    (freeRows || []).forEach((r) => s.add(r.subject_id));
    return s;
  }, [freeRows]);
  // Centralized: for free-preview visitors, unlocked chapters play only Kannada.
  const getPreviewLanguageForChapter = useCallback(
    (chapterId?: string | null): string | null => {
      if (!previewMode) return null;
      if (!chapterId) return null;
      return unlockedChapterIds.has(chapterId) ? 'kannada' : null;
    },
    [previewMode, unlockedChapterIds],
  );


  const [lockOpen, setLockOpen] = useState(false);
  const [quotaDialog, setQuotaDialog] = useState<{ open: boolean; tab: "AI" | "Doubts" }>(
    { open: false, tab: "AI" },
  );

  const { data: rawChapters, isLoading: chaptersLoading } = useSubjectChapters(selectedSubjectId || undefined);
  const chapters = useMemo(() => {
    if (!rawChapters) return rawChapters;
    if (!previewMode) return rawChapters;
    return (rawChapters as any[]).map((c) => ({
      ...c,
      _locked: !unlockedChapterIds.has(c.id),
    }));
  }, [rawChapters, previewMode, unlockedChapterIds]);
  

  // Handle URL query params for subject and tab
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    const tabParam = searchParams.get('tab');
    const topicParam = searchParams.get('topic');
    const chapterParam = searchParams.get('chapter');

    if (subjectParam && learningData?.subjects?.some(s => s.id === subjectParam)) {
      setSelectedSubjectId(subjectParam);
      if (isMobile) setMobileStep(tabParam === 'pyqs' ? 'content' : (topicParam || chapterParam ? 'content' : 'chapters'));
    }

    if (tabParam) {
      setActiveTab(tabParam);
      if (tabParam === 'ai-assistant') {
        setSidebarCollapsed(true);
      }
    }
  }, [searchParams, learningData?.subjects, isMobile]);

  // Set first subject as default when subjects load (only desktop, not mobile)
  useEffect(() => {
    if (learningData?.subjects?.length && !selectedSubjectId && !searchParams.get('subject') && !isMobile) {
      setSelectedSubjectId(learningData.subjects[0].id);
    }
  }, [learningData?.subjects, selectedSubjectId, searchParams, isMobile]);

  // Auto-select chapter / topic from URL once chapter data is available (deep-link from timetable)
  const deepLinkAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const topicParam = searchParams.get('topic');
    const chapterParam = searchParams.get('chapter');
    const tabParam = searchParams.get('tab');
    if (!topicParam && !chapterParam) return;
    if (!chapters || !chapters.length) return;
    const key = `${selectedSubjectId}|${chapterParam || ''}|${topicParam || ''}`;
    if (deepLinkAppliedRef.current === key) return;

    if (topicParam) {
      for (const ch of chapters as any[]) {
        const t = ch.topics?.find((x: any) => x.id === topicParam);
        if (t) {
          setSelectedTopic(t);
          setSelectedChapter(null);
          setChapterTab(null);
          if (!tabParam) setActiveTab('videos');
          if (isMobile) setMobileStep('content');
          deepLinkAppliedRef.current = key;
          return;
        }
      }
    }
    if (chapterParam) {
      const ch = (chapters as any[]).find((c: any) => c.id === chapterParam);
      if (ch) {
        setSelectedChapter(ch);
        setSelectedTopic(null);
        setChapterTab(null);
        if (!tabParam) setActiveTab('videos');
        if (isMobile) setMobileStep('content');
        deepLinkAppliedRef.current = key;
      }
    }
  }, [chapters, searchParams, selectedSubjectId, isMobile]);






  // Auto-collapse sidebar when AI Assistant tab is selected.
  // Also intercept tab switches AWAY from AI when a presentation is ready
  // but not yet started, prompting the user with a confirmation dialog.
  const aiJob = useAIAssistantJob();
  const isAiReadyPending =
    !!aiJob.job &&
    aiJob.job.status === 'ready' &&
    !aiJob.job.presentationStarted &&
    !aiJob.job.response?.blocked;
  const [pendingTabSwitch, setPendingTabSwitch] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  // Strict logging: report every change to the gate state so we can debug
  // why the "presentation ready" dialog did or did not appear.
  useEffect(() => {
    console.log('[AIGate] Learning isAiReadyPending →', isAiReadyPending, {
      hasJob: !!aiJob.job,
      status: aiJob.job?.status,
      presentationStarted: aiJob.job?.presentationStarted,
      blocked: aiJob.job?.response?.blocked,
      activeTab,
    });
  }, [isAiReadyPending, aiJob.job?.status, aiJob.job?.presentationStarted, aiJob.job?.response?.blocked, activeTab]);

  const handleTabChange = useCallback((value: string) => {
    console.log('[AIGate] handleTabChange', { from: activeTab, to: value, isAiReadyPending });
    if (activeTab === 'ai-assistant' && value !== 'ai-assistant' && isAiReadyPending) {
      console.log('[AIGate] handleTabChange BLOCKED → opening dialog');
      setPendingTabSwitch(value);
      return;
    }
    if (value === "my-results") {
      refreshLearningResults(queryClient);
    }
    setActiveTab(value);
    if (value === "ai-assistant") {
      setSidebarCollapsed(true);
    }
  }, [activeTab, isAiReadyPending, queryClient]);

  // Guard any in-page route navigation (e.g. Back buttons) the same way as
  // tab switches: if a presentation is ready, prompt before leaving.
  const safeNavigate = useCallback((target: string) => {
    console.log('[AIGate] safeNavigate', { target, isAiReadyPending, activeTab });
    if (isAiReadyPending) {
      console.log('[AIGate] safeNavigate BLOCKED → opening dialog');
      setPendingRoute(target);
      return;
    }
    navigate(target);
  }, [isAiReadyPending, navigate, activeTab]);

  // Note: in-app route blocking requires a data router; this project uses
  // BrowserRouter, so we intercept only tab switches and in-page Back
  // buttons via `safeNavigate`. Browser-level back/refresh is not blocked.
  const blocker: { state: string; reset: () => void; proceed: () => void } = { state: 'unblocked', reset: () => {}, proceed: () => {} };

  // Handle doubt clearing from PaperTestResults - switch to AI Assistant tab
  // Handle video player navigation - close player and switch tab
  const handleVideoPlayerNavigate = useCallback((tabValue: string) => {
    handleTabChange(tabValue);
  }, [handleTabChange]);

  // Build quick actions for video player dialog (mobile only)
  const mobileQuickActions = useMemo(() => {
    if (!isMobile) return undefined;
    if (isChecker) {
      return [
        { value: "questions", label: "Questions", icon: HelpCircle, desc: "Browse Q&A" },
      ];
    }
    return [
      { value: "ai-assistant", label: "Ask AI", icon: Sparkles, desc: "Have a doubt? Get help" },
      { value: "notes", label: "Notes", icon: BookOpen, desc: "Read topic notes" },
      { value: "important-notes", label: "Important Notes", icon: BookMarked, desc: "Generated revision notes" },
      { value: "all-questions", label: "Questions", icon: HelpCircle, desc: "Browse Q&A" },
      { value: "solutions", label: "Solutions", icon: Lightbulb, desc: "Watch answers" },
      { value: "assignments", label: "Assignments", icon: ClipboardList, desc: "View your tasks" },
      ...(selectedTopic ? [{ value: "dpp", label: "DPP", icon: Target, desc: "Daily Practice Problems" }] : []),
      { value: "doubts", label: "Doubts", icon: MessageCircleQuestion, desc: "Ask lecture doubts" },
      { value: "pyqs", label: "PYQ's", icon: FileText, desc: "Previous year questions" },
    ];
  }, [isMobile, isChecker, selectedTopic]);

  const handleClearDoubt = useCallback((doubtData: {
    questionText: string;
    correctAnswer: string;
    studentAnswer: string;
  }) => {
    console.log('[Learning] Clear doubt requested:', doubtData.questionText.substring(0, 50));
    setPendingDoubtQuestion(doubtData);
    setActiveTab('ai-assistant');
    setSidebarCollapsed(true);
  }, []);

  // Mobile navigation handlers
  const handleMobileSubjectSelect = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedTopic(null);
    setSelectedChapter(null);
    setChapterTab(null);
    setMobileStep('chapters');
  };

  const handleMobileBackToSubjects = () => {
    setSelectedSubjectId(null);
    setSelectedTopic(null);
    setSelectedChapter(null);
    setChapterTab(null);
    setMobileStep('subjects');
  };

  const handleMobileTopicSelect = (topic: any) => {
    setSelectedTopic(topic);
    setSelectedChapter(null);
    setChapterTab(null);
    setActiveTab("videos");
    setMobileStep('content');
  };

  const handleMobileChapterSelect = (chapter: any) => {
    setSelectedChapter(chapter);
    setSelectedTopic(null);
    setChapterTab(null);
    setActiveTab("videos");
    setMobileStep('content');
  };

  const handleMobileBackToChapters = () => {
    setSelectedTopic(null);
    setSelectedChapter(null);
    setChapterTab(null);
    setMobileStep('chapters');
  };

  // Handle access control
  if (courseLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-14 border-b bg-card">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex flex-1 p-6 gap-6">
          <Skeleton className="w-80 h-full" />
          <Skeleton className="flex-1 h-96" />
        </div>
      </div>
    );
  }

  if (learningData?.error === "not_authenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">
              Please login to access your courses.
            </p>
            <Button onClick={() => navigate("/auth")}>
              Login / Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (learningData?.error === "not_enrolled" && !isChecker && !previewMode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You are not enrolled in this course. Please enroll to access the learning content.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/my-courses")}>
                My Courses
              </Button>
              <Button onClick={() => navigate("/programs")}>
                Browse Programs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (learningData?.error === "course_not_found") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Course Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The course you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate("/my-courses")}>
              Go to My Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allSubjects = learningData?.subjects || [];
  const subjects = previewMode
    ? allSubjects.filter((s: any) => unlockedSubjectIds.has(s.id))
    : allSubjects;
  const course = learningData?.course;
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedTopic(null);
    setSelectedChapter(null);
    setChapterTab(null);
  };

  const handleChapterTabClick = (chapter: any, tab: string) => {
    setSelectedChapter(chapter);
    setChapterTab(tab);
    setSelectedTopic(null);
    setActiveTab(tab);
    if (tab === "ai-assistant") {
      setSidebarCollapsed(true);
    }
  };

  // Shared tab content renderer for both mobile and desktop
  const renderTabsContent = () => {
    if (selectedTopic) {
      return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          {!isMobile && (
            isChecker ? (
              <TabsList className="p-1.5 h-auto bg-muted/80 rounded-xl border shadow-sm grid w-full grid-cols-2">
                <TabsTrigger value="videos" className="py-2 rounded-lg font-medium text-sm">Classes</TabsTrigger>
                <TabsTrigger value="questions" className="py-2 rounded-lg font-medium text-sm">Questions</TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="p-1.5 h-auto bg-muted/80 rounded-xl border shadow-sm grid w-full grid-cols-11">
                <TabsTrigger value="videos" className="py-2 rounded-lg font-medium text-sm">Classes</TabsTrigger>
                <TabsTrigger value="notes" className="py-2 rounded-lg font-medium text-sm">Notes</TabsTrigger>
                <TabsTrigger value="important-notes" className="py-2 rounded-lg font-medium text-xs">Important Notes</TabsTrigger>
                <TabsTrigger value="ai-assistant" className="py-2 rounded-lg font-medium text-sm">AI</TabsTrigger>
                <TabsTrigger value="all-questions" className="py-2 rounded-lg font-medium text-sm">Questions</TabsTrigger>
                <TabsTrigger value="solutions" className="py-2 rounded-lg font-medium text-sm">Solutions</TabsTrigger>
                <TabsTrigger value="assignments" className="py-2 rounded-lg font-medium text-sm">Assignments</TabsTrigger>
                <TabsTrigger value="dpp" className="py-2 rounded-lg font-medium text-sm">DPP</TabsTrigger>
                <TabsTrigger value="my-results" className="py-2 rounded-lg font-medium text-sm">Results</TabsTrigger>
                <TabsTrigger value="doubts" className="py-2 rounded-lg font-medium text-sm">Doubts</TabsTrigger>
                <TabsTrigger value="pyqs" className="py-2 rounded-lg font-medium text-sm">PYQ's</TabsTrigger>
              </TabsList>
            )
          )}

          <TabsContent value="videos">
            <RecordedVideos 
              topicId={selectedTopic.id}
              chapterId={selectedTopic.chapter_id}
              subjectId={selectedSubjectId}
              topicVideoId={selectedTopic.video_id}
              topicVideoPlatform={selectedTopic.video_platform}
              topicTitle={selectedTopic.title}
              aiGeneratedVideoUrl={selectedTopic.ai_generated_video_url}
              aiPresentationJson={selectedTopic.ai_presentation_json}
              courseId={courseId}
              availableLanguages={course?.available_languages as string[] | null}
              languageTopupPrice={course?.language_topup_price as number | undefined}
              languageTopupOriginalPrice={course?.language_topup_original_price as number | undefined}
              isChecker={isChecker}
              onNavigateTab={handleVideoPlayerNavigate}
              quickActions={mobileQuickActions}
              onRequireAuth={() => requireAuthForTopic(selectedTopic.id)}
              restrictToLanguage={getPreviewLanguageForChapter(selectedTopic.chapter_id)}
              chapterNumber={(chapters as any[] | undefined)?.find((c) => c.id === selectedTopic.chapter_id)?.chapter_number ?? null}

            />
          </TabsContent>
          <TabsContent value="questions">
            <CheckerQuestionsList topicId={selectedTopic.id} />
          </TabsContent>
          {!isChecker && (
            <>
              <TabsContent value="ai-assistant">
                <AITeachingAssistant 
                  key={selectedTopic.id}
                  topicId={selectedTopic.id} 
                  chapterId={selectedTopic.chapter_id}
                  topicTitle={selectedTopic.title}
                  subjectName={selectedSubject?.name}
                  subjectId={selectedSubjectId ?? undefined}
                  availableLanguages={course?.available_languages as string[] | null}
                  initialDoubtQuestion={pendingDoubtQuestion}
                  onDoubtCleared={() => setPendingDoubtQuestion(null)}
                  aiPresentationJson={selectedTopic.ai_presentation_json}
                  aiGeneratedVideoUrl={selectedTopic.ai_generated_video_url}
                  isActive={activeTab === 'ai-assistant'}
                  initialQuestion={preloadedAIQuestion}
                  initialCachedResponse={preloadedAIResponse}
                  onInitialResponseConsumed={clearPreloadedAI}
                  userTier={aiUserTier}

                  {...(previewMode && courseId ? {
                    previewMode: true,
                    previewCourseId: courseId,
                    previewLimit: previewLimits?.ai ?? 0,
                    onPreviewQuotaExceeded: () => setQuotaDialog({ open: true, tab: "AI" }),
                  } : {})}
                />
              </TabsContent>
              <TabsContent value="notes"><NotesTab topicId={selectedTopic.id} chapterId={selectedTopic.chapter_id} subjectId={selectedSubjectId ?? undefined} topicTitle={selectedTopic.title} /></TabsContent>
              <TabsContent value="important-notes"><ImportantNotesTab chapterId={selectedTopic.chapter_id} topicId={selectedTopic.id} topicTitle={selectedTopic.title} /></TabsContent>
              <TabsContent value="all-questions"><QuestionsTab topicId={selectedTopic.id} subjectId={selectedSubjectId ?? undefined} /></TabsContent>
              <TabsContent value="solutions"><SolutionsTab topicId={selectedTopic.id} chapterId={selectedTopic.chapter_id} subjectId={selectedSubjectId ?? undefined} subjectName={selectedSubject?.name} onOpenInAITab={openCachedInAITab} /></TabsContent>
              <TabsContent value="assignments"><AssignmentViewer topicId={selectedTopic.id} chapterId={selectedTopic.chapter_id} subjectId={selectedSubjectId ?? undefined} onOpenInAITab={openCachedInAITab} /></TabsContent>
              
              <TabsContent value="dpp"><DPPTab subjectId={selectedSubjectId} topicId={selectedTopic?.id} chapterId={selectedTopic.chapter_id} onOpenInAITab={openCachedInAITab} /></TabsContent>
              <TabsContent value="my-results"><PaperTestResults subjectId={selectedSubjectId} subjectName={selectedSubject?.name} topicId={selectedTopic.id} chapterId={selectedTopic.chapter_id} onClearDoubt={handleClearDoubt} /></TabsContent>
              <TabsContent value="doubts"><DoubtsTab subjectId={selectedSubjectId} subjectName={selectedSubject?.name} {...(previewMode && courseId ? { previewMode: true, previewCourseId: courseId, previewLimit: previewLimits?.doubts ?? 0, onPreviewQuotaExceeded: () => setQuotaDialog({ open: true, tab: "Doubts" }) } : {})} /></TabsContent>
              
              <TabsContent value="pyqs"><PYQsStudentTab subjectId={selectedSubjectId} /></TabsContent>
            </>
          )}
        </Tabs>
      );
    }

    if (selectedChapter) {
      return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          {!isMobile && (
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold">Ch {selectedChapter.chapter_number}: {selectedChapter.title}</h2>
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">Chapter Level</span>
            </div>
          )}
          {!isMobile && (
            isChecker ? (
              <TabsList className="p-1.5 h-auto bg-muted/80 rounded-xl border shadow-sm grid w-full grid-cols-2">
                <TabsTrigger value="videos" className="py-2 rounded-lg font-medium text-sm">Classes</TabsTrigger>
                <TabsTrigger value="questions" className="py-2 rounded-lg font-medium text-sm">Questions</TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="p-1.5 h-auto bg-muted/80 rounded-xl border shadow-sm grid w-full grid-cols-11">
                <TabsTrigger value="videos" className="py-2 rounded-lg font-medium text-sm">Classes</TabsTrigger>
                <TabsTrigger value="notes" className="py-2 rounded-lg font-medium text-sm">Notes</TabsTrigger>
                <TabsTrigger value="important-notes" className="py-2 rounded-lg font-medium text-xs">Important Notes</TabsTrigger>
                <TabsTrigger value="ai-assistant" className="py-2 rounded-lg font-medium text-sm">AI</TabsTrigger>
                <TabsTrigger value="all-questions" className="py-2 rounded-lg font-medium text-sm">Questions</TabsTrigger>
                <TabsTrigger value="solutions" className="py-2 rounded-lg font-medium text-sm">Solutions</TabsTrigger>
                <TabsTrigger value="assignments" className="py-2 rounded-lg font-medium text-sm">Assignments</TabsTrigger>
                <TabsTrigger value="my-results" className="py-2 rounded-lg font-medium text-sm">Results</TabsTrigger>
                <TabsTrigger value="doubts" className="py-2 rounded-lg font-medium text-sm">Doubts</TabsTrigger>
                
                <TabsTrigger value="pyqs" className="py-2 rounded-lg font-medium text-sm">PYQ's</TabsTrigger>
              </TabsList>
            )
          )}

          <TabsContent value="videos">
            <RecordedVideos 
              chapterId={selectedChapter.id}
              subjectId={selectedSubjectId}
              topicTitle={`Ch ${selectedChapter.chapter_number}: ${selectedChapter.title}`}
              aiGeneratedVideoUrl={selectedChapter.ai_generated_video_url}
              aiPresentationJson={selectedChapter.ai_presentation_json}
              courseId={courseId}
              isChecker={isChecker}
              onNavigateTab={handleVideoPlayerNavigate}
              quickActions={mobileQuickActions}
              onRequireAuth={() => requireAuthForTopic(selectedChapter.id)}
              restrictToLanguage={getPreviewLanguageForChapter(selectedChapter.id)}
              chapterNumber={selectedChapter.chapter_number ?? null}

            />
          </TabsContent>
          <TabsContent value="questions">
            <CheckerQuestionsList chapterId={selectedChapter.id} chapterOnly />
          </TabsContent>
          {!isChecker && (
            <>
              <TabsContent value="ai-assistant">
                <AITeachingAssistant 
                  key={selectedChapter.id}
                  chapterId={selectedChapter.id}
                  topicTitle={`Ch ${selectedChapter.chapter_number}: ${selectedChapter.title}`}
                  subjectName={selectedSubject?.name}
                  subjectId={selectedSubjectId ?? undefined}
                  availableLanguages={course?.available_languages as string[] | null}
                  initialDoubtQuestion={pendingDoubtQuestion}
                  onDoubtCleared={() => setPendingDoubtQuestion(null)}
                  aiPresentationJson={selectedChapter.ai_presentation_json}
                  aiGeneratedVideoUrl={selectedChapter.ai_generated_video_url}
                  isActive={activeTab === 'ai-assistant'}
                  initialQuestion={preloadedAIQuestion}
                  initialCachedResponse={preloadedAIResponse}
                  onInitialResponseConsumed={clearPreloadedAI}
                  userTier={aiUserTier}

                  {...(previewMode && courseId ? {
                    previewMode: true,
                    previewCourseId: courseId,
                    previewLimit: previewLimits?.ai ?? 0,
                    onPreviewQuotaExceeded: () => setQuotaDialog({ open: true, tab: "AI" }),
                  } : {})}
                />
              </TabsContent>
              <TabsContent value="notes">
                <ChapterNotes chapter={selectedChapter} subjectId={selectedSubjectId ?? undefined} />
              </TabsContent>
              <TabsContent value="important-notes">
                <ImportantNotesTab chapterId={selectedChapter.id} />
              </TabsContent>
              <TabsContent value="all-questions"><QuestionsTab chapterId={selectedChapter.id} chapterOnly subjectId={selectedSubjectId ?? undefined} /></TabsContent>
              <TabsContent value="solutions"><SolutionsTab chapterId={selectedChapter.id} subjectId={selectedSubjectId ?? undefined} subjectName={selectedSubject?.name} onOpenInAITab={openCachedInAITab} /></TabsContent>
              <TabsContent value="assignments"><AssignmentViewer chapterId={selectedChapter.id} subjectId={selectedSubjectId ?? undefined} onOpenInAITab={openCachedInAITab} /></TabsContent>
              
              <TabsContent value="my-results"><PaperTestResults subjectId={selectedSubjectId} subjectName={selectedSubject?.name} chapterId={selectedChapter.id} onClearDoubt={handleClearDoubt} /></TabsContent>
              <TabsContent value="doubts"><DoubtsTab subjectId={selectedSubjectId} subjectName={selectedSubject?.name} {...(previewMode && courseId ? { previewMode: true, previewCourseId: courseId, previewLimit: previewLimits?.doubts ?? 0, onPreviewQuotaExceeded: () => setQuotaDialog({ open: true, tab: "Doubts" }) } : {})} /></TabsContent>
              
              <TabsContent value="pyqs"><PYQsStudentTab subjectId={selectedSubjectId} /></TabsContent>
            </>
          )}
        </Tabs>
      );
    }

    if (activeTab === 'pyqs' && selectedSubjectId) {
      return <PYQsStudentTab subjectId={selectedSubjectId} />;
    }
    return <CourseWelcomeCards courseName={course?.name || "this course"} />;
  };

  const courseSlugForBuy = previewCourseSlug || (course as any)?.slug || "";
  const previewBanner = previewMode ? (
    <div className="sticky top-0 z-50 bg-card border-b">
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <button
          onClick={() => safeNavigate(courseSlugForBuy ? `/course/${courseSlugForBuy}` : "/programs")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 justify-center">
          <span className="font-semibold text-xs sm:text-sm truncate">
            {previewCourseName || (course as any)?.name || "Course"}
          </span>
          <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs">Free Preview</Badge>
        </div>
        <Button size="sm" className="text-xs sm:text-sm h-8 shrink-0" onClick={() => safeNavigate(courseSlugForBuy ? `/course/${courseSlugForBuy}` : "/programs")}>
          Buy course
        </Button>
      </div>
    </div>
  ) : null;
  const previewDialogs = previewMode ? (
    <>
      <PurchaseRequiredDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        courseSlug={courseSlugForBuy}
      />
      <QuotaExhaustedDialog
        open={quotaDialog.open}
        onOpenChange={(o) => setQuotaDialog((p) => ({ ...p, open: o }))}
        courseSlug={courseSlugForBuy}
        tab={quotaDialog.tab}
      />
    </>
  ) : null;

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <>
        {previewBanner}
        {previewDialogs}
        {/* Screen protection overlay */}
        {screenProtected && (
          <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
            <p className="text-lg font-semibold text-foreground">Content Protected</p>
          </div>
        )}
        {!previewSeo && (
          <SEOHead
            title={`${course?.name || "Learning"} | SimpleLecture`}
            description="Learn with AI-powered tools"
          />
        )}
        <div className="flex flex-col min-h-screen pb-20 bg-background" style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}>
          {/* Step 1: Subject Selection */}
          {mobileStep === 'subjects' && (
            <>
              <div className="sticky top-0 z-40 bg-background border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => safeNavigate("/my-courses")}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-base truncate">{course?.name || "Course"}</h1>
                    <p className="text-xs text-muted-foreground">Select a subject</p>
                  </div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {subjects.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => handleMobileSubjectSelect(subject.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-all active:scale-95"
                  >
                    {subject.thumbnail_url ? (
                      <img src={subject.thumbnail_url} alt={subject.name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-center leading-tight">{subject.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Chapters & Topics */}
          {mobileStep === 'chapters' && (
            <>
              <div className="sticky top-0 z-40 bg-background border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleMobileBackToSubjects}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-base truncate">{selectedSubject?.name || "Subject"}</h1>
                    <p className="text-xs text-muted-foreground">{course?.name}</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                {chaptersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                  </div>
                ) : chapters && chapters.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-3">
                    {chapters.map((chapter: any) => (
                      <AccordionItem key={chapter.id} value={chapter.id} className={cn("border-0 rounded-xl overflow-hidden shadow-sm", chapter._locked && "opacity-60")}>
                        <AccordionTrigger className="hover:bg-primary/15 px-4 py-3 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 transition-all">
                          <div className="flex-1 text-left flex items-center gap-2">
                            {chapter._locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <div className="flex-1">
                              <div className="font-semibold text-sm">Ch {chapter.chapter_number}: {chapter.title}</div>
                              <Progress value={chapter.progress || 0} className="mt-2 h-1.5 bg-primary/20" />
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-3 px-2">
                          {/* Chapter Content button */}
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-sm mb-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10"
                            onClick={(e) => e.preventDefault()}
                          >
                            <div className="p-1.5 rounded-lg mr-2 bg-primary/10">
                              {chapter._locked ? <Lock className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
                            </div>
                            Chapter Content
                          </Button>

                          {/* Topics */}
                          <div className="space-y-1 pl-2 ml-2 border-l-2 border-primary/20">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Topics</p>
                            {chapter.topics?.length > 0 ? (
                              chapter.topics.map((topic: any) => (
                                <Button
                                  key={topic.id}
                                  variant="ghost"
                                  className="w-full justify-start text-sm rounded-lg hover:bg-primary/10 h-auto min-h-9 py-2 items-start"
                                  onClick={() => chapter._locked ? setLockOpen(true) : handleMobileTopicSelect(topic)}
                                >
                                  {chapter._locked ? (
                                    <div className="p-1 rounded-full mr-2 bg-muted">
                                      <Lock className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  ) : topic.completed ? (
                                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 mr-2">
                                      <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                                    </div>
                                  ) : (
                                    <div className="p-1 rounded-full mr-2 bg-primary/10">
                                      <Circle className="h-3 w-3" />
                                    </div>
                                  )}
                                  <span className="flex-1 text-left whitespace-normal break-words">{topic.title}</span>
                                </Button>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">No topics available</p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No chapters available for this subject</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 3: Content */}
          {mobileStep === 'content' && (
            <>
              <div className="sticky top-0 z-40 bg-background border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleMobileBackToChapters}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-sm truncate">
                      {selectedTopic ? selectedTopic.title : selectedChapter ? `Ch ${selectedChapter.chapter_number}: ${selectedChapter.title}` : "Content"}
                    </h1>
                    <p className="text-xs text-muted-foreground truncate">{selectedSubject?.name}</p>
                  </div>

                  <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileSidebarOpen(true)}>
                      <Menu className="h-4 w-4" />
                    </Button>
                    <SheetContent side="left" className="w-[260px] p-0">
                      <SheetHeader className="px-4 pt-4 pb-2 border-b">
                        <SheetTitle className="text-sm font-semibold">Navigate</SheetTitle>
                      </SheetHeader>
                      <nav className="flex flex-col gap-1 p-3">
                        {(isChecker ? [
                          { value: "videos", label: "Classes", icon: Video },
                          { value: "questions", label: "Questions", icon: HelpCircle },
                        ] : [
                          { value: "videos", label: "Classes", icon: Video },
                          { value: "ai-assistant", label: "Ask AI", icon: Sparkles },
                          { value: "notes", label: "Notes", icon: BookOpen },
                          { value: "important-notes", label: "Important Notes", icon: BookMarked },
                          { value: "all-questions", label: "Questions", icon: HelpCircle },
                          { value: "solutions", label: "Solutions", icon: Lightbulb },
                          { value: "assignments", label: "Assignments", icon: ClipboardList },
                          ...(selectedTopic ? [{ value: "dpp", label: "DPP", icon: Target }] : []),
                          { value: "doubts", label: "Doubts", icon: MessageCircleQuestion },
                          
                          { value: "pyqs", label: "PYQ's", icon: FileText },
                        ]).map(({ value, label, icon: Icon }) => {
                          const isActive = activeTab === value;
                          return (
                            <Button
                              key={value}
                              variant={isActive ? "default" : "ghost"}
                              className="w-full justify-start gap-3 h-10"
                              onClick={() => {
                                handleTabChange(value);
                                setMobileSidebarOpen(false);
                              }}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{label}</span>
                            </Button>
                          );
                        })}
                      </nav>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden">
                {renderTabsContent()}
                
                {/* Quick Actions Grid */}
                <div className="mt-6 mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(isChecker ? [
                      { value: "questions", label: "Questions", icon: HelpCircle, desc: "Browse Q&A" },
                    ] : [
                      { value: "ai-assistant", label: "Ask AI", icon: Sparkles, desc: "Have a doubt? Get help" },
                      { value: "notes", label: "Notes", icon: BookOpen, desc: "Read topic notes" },
                      { value: "important-notes", label: "Important Notes", icon: BookMarked, desc: "Generated revision notes" },
                      { value: "all-questions", label: "Questions", icon: HelpCircle, desc: "Browse Q&A" },
                      { value: "solutions", label: "Solutions", icon: Lightbulb, desc: "Watch answers" },
                      { value: "assignments", label: "Assignments", icon: ClipboardList, desc: "View your tasks" },
                      ...(selectedTopic ? [{ value: "dpp", label: "DPP", icon: Target, desc: "Daily Practice Problems" }] : []),
                      { value: "doubts", label: "Doubts", icon: MessageCircleQuestion, desc: "Ask lecture doubts" },
                      { value: "pyqs", label: "PYQ's", icon: FileText, desc: "Previous year questions" },
                    ]).map(({ value, label, icon: Icon, desc }) => {
                      const isActive = activeTab === value;
                      return (
                        <button
                          key={value}
                          onClick={() => handleTabChange(value)}
                          className={cn(
                            "flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all",
                            isActive
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg",
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className={cn("text-sm font-semibold", isActive ? "text-primary" : "text-foreground")}>{label}</p>
                            <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <BottomNav />
      </>
    );
  }

  // ─── DESKTOP LAYOUT (unchanged) ───
  return (
    <>
      {previewBanner}
      {previewDialogs}
      {/* Screen protection overlay */}
      {screenProtected && (
        <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
          <p className="text-lg font-semibold text-foreground">Content Protected</p>
        </div>
      )}
      {!previewSeo && (
        <SEOHead
          title={`${course?.name || "Learning"} | SimpleLecture`}
          description="Learn with AI-powered tools"
        />
      )}
      <div className="flex flex-col h-screen" style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}>
        <SubjectNavigationBar 
          subjects={subjects.map(s => ({ name: s.name, slug: s.slug, id: s.id }))} 
          selectedSubjectId={selectedSubjectId}
          onSubjectChange={handleSubjectChange}
          courseName={course?.name}
          onBack={() => safeNavigate("/my-courses")}
        />
        
        <div className="flex flex-1 overflow-hidden relative">
          {/* Expand button when collapsed - top left position */}
          {sidebarCollapsed && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-2 z-10 bg-gradient-to-br from-primary/20 to-primary/5 shadow-md hover:shadow-lg border-primary/20 hover:bg-primary/15 transition-all duration-300"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
            >
              <PanelLeft className="h-4 w-4 text-primary" />
            </Button>
          )}

          <aside className={cn(
            "border-r overflow-y-auto transition-all duration-300 flex flex-col",
            sidebarCollapsed ? "w-0 overflow-hidden" : "w-80"
          )}>
            <div className="p-4 flex-1">
              {/* Header with title and collapse button */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
                <h2 className="text-lg font-bold text-foreground">{selectedSubject?.name || "Select Subject"}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-primary/10 h-8 w-8 text-primary"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
              
              {chaptersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : chapters && chapters.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-3">
                  {chapters.map((chapter: any) => (
                    <AccordionItem key={chapter.id} value={chapter.id} className={cn("border-0 rounded-xl overflow-hidden shadow-sm", chapter._locked && "opacity-60")}>
                      <AccordionTrigger className="hover:bg-primary/15 px-4 py-3 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 transition-all duration-300 hover:shadow-md">
                        <div className="flex-1 text-left flex items-center gap-2">
                          {chapter._locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-foreground">
                              Ch {chapter.chapter_number}: {chapter.title}
                            </div>
                            <Progress value={chapter.progress || 0} className="mt-2 h-1.5 bg-primary/20" />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-3 px-2">
                        {/* Chapter Content button */}
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-sm mb-3 rounded-lg transition-all duration-300",
                            selectedChapter?.id === chapter.id && !selectedTopic 
                              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md" 
                              : "bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10"
                          )}
                          onClick={(e) => e.preventDefault()}
                        >
                          <div className={cn(
                            "p-1.5 rounded-lg mr-2",
                            selectedChapter?.id === chapter.id && !selectedTopic 
                              ? "bg-primary-foreground/20" 
                              : "bg-primary/10"
                          )}>
                            {chapter._locked ? <Lock className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
                          </div>
                          Chapter Content
                        </Button>

                        {/* Topics section */}
                        <div className="space-y-1 pl-2 ml-2 border-l-2 border-primary/20">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Topics</p>
                          {chapter.topics?.length > 0 ? (
                            chapter.topics.map((topic: any) => (
                              <Button
                                key={topic.id}
                                variant="ghost"
                                className={cn(
                                  "w-full justify-start text-sm rounded-lg transition-all duration-300 h-auto min-h-9 py-2 items-start",
                                  selectedTopic?.id === topic.id 
                                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md" 
                                    : "hover:bg-primary/10"
                                )}
                                onClick={() => {
                                  if (chapter._locked) { setLockOpen(true); return; }
                                  setSelectedTopic(topic);
                                  setSelectedChapter(null);
                                  setChapterTab(null);
                                  setActiveTab("videos");
                                  setSidebarCollapsed(true);
                                }}

                              >
                                {chapter._locked ? (
                                  <div className="p-1 rounded-full mr-2 bg-muted">
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                ) : topic.completed ? (
                                  <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 mr-2">
                                    <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "p-1 rounded-full mr-2",
                                    selectedTopic?.id === topic.id 
                                      ? "bg-primary-foreground/20" 
                                      : "bg-primary/10"
                                  )}>
                                    <Circle className="h-3 w-3" />
                                  </div>
                                )}
                                <span className="flex-1 text-left whitespace-normal break-words">{topic.title}</span>
                              </Button>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">
                              No topics available
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {selectedSubjectId ? "No chapters available for this subject" : "Select a subject to view chapters"}
                  </p>
                </div>
              )}
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-6">
            {renderTabsContent()}
          </main>
        </div>
      </div>
      <BottomNav />

      <AlertDialog
        open={pendingTabSwitch !== null || pendingRoute !== null || blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) {
            console.log('[AIGate] dialog dismissed via overlay');
            setPendingTabSwitch(null);
            setPendingRoute(null);
            if (blocker.state === 'blocked') blocker.reset?.();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Your presentation is ready</AlertDialogTitle>
            <AlertDialogDescription>
              {aiJob.job?.question && (
                <span className="mb-2 block rounded-md bg-muted p-2 text-sm italic text-foreground">
                  "{aiJob.job.question}"
                </span>
              )}
              Do you want to watch it now? Leaving will discard the ready answer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                console.log('[AIGate] dialog → Cancel and leave', { pendingTabSwitch, pendingRoute });
                aiJob.clearJob();
                if (pendingRoute) {
                  const target = pendingRoute;
                  setPendingRoute(null);
                  setPendingTabSwitch(null);
                  navigate(target);
                } else if (pendingTabSwitch) {
                  const target = pendingTabSwitch;
                  setPendingTabSwitch(null);
                  setActiveTab(target);
                  if (target === 'ai-assistant') setSidebarCollapsed(true);
                }
                if (blocker.state === 'blocked') blocker.proceed?.();
              }}
            >
              Cancel and leave
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                console.log('[AIGate] dialog → Watch presentation');
                aiJob.acknowledgeAndConfirm();
                setPendingTabSwitch(null);
                setPendingRoute(null);
                setActiveTab('ai-assistant');
                setSidebarCollapsed(true);
                if (blocker.state === 'blocked') blocker.reset?.();
              }}
            >
              Watch presentation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>

  );
}

/**
 * Chapter-level Notes wrapper: lets the user pick a topic within the chapter
 * and renders the standard NotesTab for that topic.
 */
function ChapterNotes({
  chapter,
  subjectId,
}: {
  chapter: any;
  subjectId?: string;
}) {
  const topics: any[] = Array.isArray(chapter?.topics) ? chapter.topics : [];
  const [activeTopicId, setActiveTopicId] = useState<string | null>(
    topics[0]?.id ?? null
  );

  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center space-y-2">
        <p className="font-medium">Notes not available yet</p>
        <p className="text-sm text-muted-foreground">
          This chapter doesn't have any topics with published notes.
        </p>
      </div>
    );
  }

  const active = topics.find((t) => t.id === activeTopicId) || topics[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {topics.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActiveTopicId(t.id)}
            className={
              "text-xs px-3 py-1.5 rounded-full border transition-colors " +
              (t.id === active.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted hover:bg-primary/10 hover:text-primary border-transparent")
            }
          >
            {i + 1}. {t.title}
          </button>
        ))}
      </div>
      <NotesTab
        topicId={active.id}
        chapterId={chapter.id}
        subjectId={subjectId}
        topicTitle={active.title}
      />
    </div>
  );
}
