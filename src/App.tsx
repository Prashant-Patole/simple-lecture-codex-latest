import { useState, useEffect, useRef, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { mcLog, getNavType } from "@/lib/debug/myCoursesLogger";
import { HelmetProvider } from 'react-helmet-async';
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/page-loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { SocialProofToast } from "@/components/SocialProofToast";
import { RouteNoIndex } from "@/components/SEO";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AIAssistantJobProvider } from "@/contexts/AIAssistantJobContext";
import { AIAssistantBackgroundUI } from "@/components/ai-assistant/AIAssistantBackgroundUI";

// Essential pages loaded immediately
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Auth pages lazy loaded - not needed on initial homepage visit
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));

// Helper component to redirect encoded auth URLs to proper URLs
const AuthRedirect = ({ tab }: { tab: string }) => <Navigate to={`/auth?tab=${tab}`} replace />;

// Component to track page views in Google Analytics & Facebook Pixel
const AnalyticsTracker = () => {
  useGoogleAnalytics();
  useFacebookPixel();
  return null;
};

// Route-level logger: prints every pathname change so we can see if MyCourses unmounts on back-nav.
const RouteLogger = () => {
  const location = useLocation();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    mcLog('Router', 'location', {
      from: prev.current,
      to: location.pathname,
      navType: getNavType(),
    });
    prev.current = location.pathname;
  }, [location.pathname]);
  return null;
};


// Component to clear React Query cache on auth state changes
const AuthCacheManager = () => {
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const initializedRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUserId = session?.user?.id ?? null;
      
      // First event - just initialize, don't clear anything
      if (!initializedRef.current) {
        initializedRef.current = true;
        previousUserIdRef.current = currentUserId;
        return;
      }
      
      // Handle specific events - only clear cache on explicit sign out or user switch
      switch (event) {
        case 'SIGNED_OUT':
          // User explicitly signed out - clear cache
          queryClient.clear();
          previousUserIdRef.current = null;
          break;
          
        case 'SIGNED_IN':
          // Only clear if actually switching to a DIFFERENT user
          // Same user signing in again (new tab, refresh) should NOT clear
          if (previousUserIdRef.current && 
              previousUserIdRef.current !== currentUserId && 
              currentUserId !== null) {
            queryClient.clear();
          }
          previousUserIdRef.current = currentUserId;
          break;
          
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          // Token refresh or user update - same user, don't clear cache
          previousUserIdRef.current = currentUserId;
          break;
          
        case 'INITIAL_SESSION':
          // Initial session restoration - don't clear
          previousUserIdRef.current = currentUserId;
          break;
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
};

// ============================================================
// LAZY LOADED PAGES - Code splitting for faster initial load
// ============================================================

// Dashboard pages
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const StudentDashboard = lazyWithRetry(() => import("./pages/StudentDashboard"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));


// Course & Learning pages
const Learning = lazyWithRetry(() => import("./pages/Learning"));
const CoursePreview = lazyWithRetry(() => import("./pages/CoursePreviewRoute"));
const MyCourses = lazyWithRetry(() => import("./pages/MyCourses"));
const Programs = lazyWithRetry(() => import("./pages/Programs"));
const ProgramDetail = lazyWithRetry(() => import("./pages/ProgramDetail"));
const ExploreByGoal = lazyWithRetry(() => import("./pages/ExploreByGoal"));
const SubjectDetail = lazyWithRetry(() => import("./pages/SubjectDetail"));
const Enroll = lazyWithRetry(() => import("./pages/Enroll"));
const LanguageTopup = lazyWithRetry(() => import("./pages/LanguageTopup"));
const AITutorial = lazyWithRetry(() => import("./pages/AITutorial"));
const SeoLanding = lazyWithRetry(() => import("./pages/SeoLanding"));
const MobileReels = lazyWithRetry(() => import("./pages/MobileReels"));

// Payment pages
const Cart = lazyWithRetry(() => import("./pages/Cart"));
const Checkout = lazyWithRetry(() => import("./pages/Checkout"));
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const PaymentFailed = lazyWithRetry(() => import("./pages/PaymentFailed"));
const PaymentCallback = lazyWithRetry(() => import("./pages/PaymentCallback"));

// Live & Recording pages
const Live = lazyWithRetry(() => import("./pages/Live"));
const WatchRecording = lazyWithRetry(() => import("./pages/WatchRecording"));
const Recordings = lazyWithRetry(() => import("./pages/Recordings"));
const V3PlayerPage = lazyWithRetry(() => import("./pages/V3PlayerPage"));
const V4PlayerPage = lazyWithRetry(() => import("./pages/V4PlayerPage"));
const V5PlayerPage = lazyWithRetry(() => import("./pages/V5PlayerPage"));
const V3TrialPage = lazyWithRetry(() => import("./pages/V3TrialPage"));

// Forum & Support pages
const Forum = lazyWithRetry(() => import("./pages/Forum"));
const ForumCategory = lazyWithRetry(() => import("./pages/ForumCategory"));
const ForumPost = lazyWithRetry(() => import("./pages/ForumPost"));
const ForumGroupChat = lazyWithRetry(() => import("./pages/ForumGroupChat"));
const Support = lazyWithRetry(() => import("./pages/Support"));

// Blog pages
const BlogListing = lazyWithRetry(() => import("./pages/BlogListing"));
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"));

// Legal pages
const AboutUs = lazyWithRetry(() => import("./pages/AboutUs"));
const SuccessStories = lazyWithRetry(() => import("./pages/SuccessStories"));
const HowItWorks = lazyWithRetry(() => import("./pages/HowItWorks"));
const TermsAndConditions = lazyWithRetry(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const ContactUs = lazyWithRetry(() => import("./pages/ContactUs"));

// Misc pages
const Implementation = lazyWithRetry(() => import("./pages/Implementation"));
const InventionDisclosure = lazyWithRetry(() => import("./pages/InventionDisclosure"));
const DoubtAnswer = lazyWithRetry(() => import("./pages/DoubtAnswer"));
const MyRewards = lazyWithRetry(() => import("./pages/MyRewards"));
const StudyTimetable = lazyWithRetry(() => import("./pages/StudyTimetable"));
const MyTests = lazyWithRetry(() => import("./pages/MyTests"));
const MyTestTake = lazyWithRetry(() => import("./pages/MyTestTake"));
const MyTestResult = lazyWithRetry(() => import("./pages/MyTestResult"));
const PracticeResultReview = lazyWithRetry(() => import("./pages/PracticeResultReview"));
const MyNotesCourses = lazyWithRetry(() => import("./pages/MyNotesCourses"));
const MyNotesSubjects = lazyWithRetry(() => import("./pages/MyNotesSubjects"));
const MyNotesChapters = lazyWithRetry(() => import("./pages/MyNotesChapters"));


// Admin pages
const AdminProtectedRoute = lazyWithRetry(() => import("./components/admin/AdminProtectedRoute").then(m => ({ default: m.AdminProtectedRoute })));
const AdminLayout = lazyWithRetry(() => import("./components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const CategoryList = lazyWithRetry(() => import("./pages/admin/CategoryList"));
const CategoryForm = lazyWithRetry(() => import("./pages/admin/CategoryForm"));
const ExploreByGoalList = lazyWithRetry(() => import("./pages/admin/ExploreByGoalList"));
const ExploreByGoalForm = lazyWithRetry(() => import("./pages/admin/ExploreByGoalForm"));
const PopularSubjectsList = lazyWithRetry(() => import("./pages/admin/PopularSubjectsList"));
const PopularSubjectsForm = lazyWithRetry(() => import("./pages/admin/PopularSubjectsForm"));
const CoursesList = lazyWithRetry(() => import("./pages/admin/CoursesList"));
const CourseForm = lazyWithRetry(() => import("./pages/admin/CourseForm"));
const UsersList = lazyWithRetry(() => import("./pages/admin/UsersList"));
const ParentsList = lazyWithRetry(() => import("./pages/admin/ParentsList"));
const InstructorsList = lazyWithRetry(() => import("./pages/admin/InstructorsList"));
const StaffList = lazyWithRetry(() => import("./pages/admin/StaffList"));
const Academics = lazyWithRetry(() => import("./pages/admin/Academics"));
const Settings = lazyWithRetry(() => import("./pages/admin/Settings"));
const BatchesList = lazyWithRetry(() => import("./pages/admin/BatchesList"));
const BatchForm = lazyWithRetry(() => import("./pages/admin/BatchForm"));
const BatchDetails = lazyWithRetry(() => import("./pages/admin/BatchDetails"));
const SubjectForm = lazyWithRetry(() => import("./pages/admin/SubjectForm"));
const QuestionBank = lazyWithRetry(() => import("./pages/admin/QuestionBank"));
const UploadQuestionBank = lazyWithRetry(() => import("./pages/admin/UploadQuestionBank"));
const VerifyUploadedQuestions = lazyWithRetry(() => import("./pages/admin/VerifyUploadedQuestions"));
const DocumentVerificationDetail = lazyWithRetry(() => import("./pages/admin/DocumentVerificationDetail"));
const VerificationNotifications = lazyWithRetry(() => import("./pages/admin/VerificationNotifications"));
const ProcessingJobsMonitor = lazyWithRetry(() => import("./pages/admin/ProcessingJobsMonitor"));
const KannadaCoverageScan = lazyWithRetry(() => import("./pages/admin/KannadaCoverageScan"));
const KannadaQueue = lazyWithRetry(() => import("./pages/admin/KannadaQueue"));
const Server4Jobs = lazyWithRetry(() => import("./pages/admin/Server4Jobs"));
const Server78Jobs = lazyWithRetry(() => import("./pages/admin/Server78Jobs"));
const VideoCoverageReport = lazyWithRetry(() => import("./pages/admin/VideoCoverageReport"));
const CompletedJobIntegrity = lazyWithRetry(() => import("./pages/admin/CompletedJobIntegrity"));
const LanguageChecker = lazyWithRetry(() => import("./pages/admin/LanguageChecker"));
const TestReplitAPI = lazyWithRetry(() => import("./pages/admin/TestReplitAPI"));
const CdnPresentationRefresh = lazyWithRetry(() => import("./pages/admin/CdnPresentationRefresh"));
const AssignmentManager = lazyWithRetry(() => import("./pages/admin/AssignmentManager"));
const DepartmentsManager = lazyWithRetry(() => import("./pages/admin/hr/DepartmentsManager"));
const InstructorsManager = lazyWithRetry(() => import("./pages/admin/hr/InstructorsManager"));
const TimetableManager = lazyWithRetry(() => import("./pages/admin/hr/TimetableManager"));
const LiveClassesManager = lazyWithRetry(() => import("./pages/admin/hr/LiveClassesManager"));
const AcademicsTimetable = lazyWithRetry(() => import("./pages/admin/AcademicsTimetable"));
const HolidaysManager = lazyWithRetry(() => import("./pages/admin/HolidaysManager"));
const Documentation = lazyWithRetry(() => import("./pages/admin/Documentation"));
const GenerateSeedImages = lazyWithRetry(() => import("./pages/admin/GenerateSeedImages"));
const FileBrowser = lazyWithRetry(() => import("./pages/admin/FileBrowser"));
const PDFViewer = lazyWithRetry(() => import("./pages/admin/PDFViewer"));
const CounselorAvatars = lazyWithRetry(() => import("./pages/admin/CounselorAvatars"));
const FeaturedCoursesManager = lazyWithRetry(() => import("./pages/admin/FeaturedCoursesManager"));
const OrdersList = lazyWithRetry(() => import("./pages/admin/OrdersList"));
const BulkAssignInstructors = lazyWithRetry(() => import("./pages/admin/BulkAssignInstructors"));
const RecordingsManager = lazyWithRetry(() => import("./pages/admin/RecordingsManager"));
const ForumModeration = lazyWithRetry(() => import("./pages/admin/ForumModeration"));
const SupportDashboard = lazyWithRetry(() => import("./pages/admin/SupportDashboard"));
const SalesLeads = lazyWithRetry(() => import("./pages/admin/SalesLeads"));

// Checker pages
const CheckerProtectedRoute = lazyWithRetry(() => import("./components/checker/CheckerProtectedRoute").then(m => ({ default: m.CheckerProtectedRoute })));
const CheckerLayout = lazyWithRetry(() => import("./components/checker/CheckerLayout").then(m => ({ default: m.CheckerLayout })));
const CheckerDashboard = lazyWithRetry(() => import("./pages/checker/CheckerDashboard"));
const ContentAuditSubject = lazyWithRetry(() => import("./pages/admin/ContentAuditSubject"));
const ContentAuditChapter = lazyWithRetry(() => import("./pages/admin/ContentAuditChapter"));
const ContentAudit = lazyWithRetry(() => import("./pages/admin/ContentAudit"));
const DocContentCoverage = lazyWithRetry(() => import("./pages/admin/DocContentCoverage"));
const CdnDocCoverage = lazyWithRetry(() => import("./pages/admin/CdnDocCoverage"));
const CoverageAnalyzer = lazyWithRetry(() => import("./pages/admin/CoverageAnalyzer"));
const DownloadSourceFiles = lazyWithRetry(() => import("./pages/tools/DownloadSourceFiles"));
const PromoCodesList = lazyWithRetry(() => import("./pages/admin/PromoCodesList"));
const PromoCodeForm = lazyWithRetry(() => import("./pages/admin/PromoCodeForm"));
const KieAIBalance = lazyWithRetry(() => import("./pages/admin/KieAIBalance"));
const AutoPipelineReports = lazyWithRetry(() => import("./pages/admin/AutoPipelineReports"));
const PipelineMonitorPage = lazyWithRetry(() => import("./components/admin/PipelineMonitorPage"));
const VisitorAnalytics = lazyWithRetry(() => import("./pages/admin/VisitorAnalytics"));
const AdminAnalytics = lazyWithRetry(() => import("./pages/admin/AdminAnalytics"));
const AdminAskAI = lazyWithRetry(() => import("./pages/admin/AdminAskAI"));

// Instructor pages
const InstructorProtectedRoute = lazyWithRetry(() => import("./components/instructor/InstructorProtectedRoute").then(m => ({ default: m.InstructorProtectedRoute })));
const InstructorLayout = lazyWithRetry(() => import("./components/instructor/InstructorLayout").then(m => ({ default: m.InstructorLayout })));
const InstructorDashboard = lazyWithRetry(() => import("./pages/instructor/InstructorDashboard"));
const InstructorLiveClasses = lazyWithRetry(() => import("./pages/instructor/InstructorLiveClasses"));
const InstructorSubjects = lazyWithRetry(() => import("./pages/instructor/InstructorSubjects"));
const InstructorActivityLog = lazyWithRetry(() => import("./pages/instructor/InstructorActivityLog"));

// Lazy-loaded widget for authenticated users
const SalesAssistantWidget = lazyWithRetry(() => import("@/components/SalesAssistant/SalesAssistantWidget").then(m => ({ default: m.SalesAssistantWidget })));

// Deferred widget wrapper — renders SalesAssistantWidget only after idle or 5s
const DeferredSalesWidget = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 5000);
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setReady(true));
    }
    return () => clearTimeout(timer);
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <SalesAssistantWidget />
    </Suspense>
  );
};

const VisitorTracker = () => { useVisitorTracking(); return null; };

const App = () => (
  <ErrorBoundary>
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthCacheManager />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AIAssistantJobProvider>
            <ScrollToTop />
            <AnalyticsTracker />
            <RouteLogger />
            <VisitorTracker />
            <RouteNoIndex />
            <SocialProofToast />
            <AIAssistantBackgroundUI />
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                {/* Handle encoded URL - redirect /auth%3Ftab=login to /auth?tab=login */}
                <Route path="/auth%3Ftab=login" element={<AuthRedirect tab="login" />} />
                <Route path="/auth%3Ftab=signup" element={<AuthRedirect tab="signup" />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/student-dashboard" element={<StudentDashboard />} />
                <Route path="/my-courses" element={<MyCourses />} />
                {/* Course detail route - new SEO-friendly path */}
                <Route path="/course/:slug" element={<ProgramDetail />} />
                <Route path="/course/:slug/preview" element={<CoursePreview />} />
                {/* SEO-friendly path-based routes for categories */}
                <Route path="/programs" element={<Programs />} />
                <Route path="/programs/:categorySlug/:subcategorySlug/:subsubcategorySlug" element={<Programs />} />
                <Route path="/programs/:categorySlug/:subcategorySlug" element={<Programs />} />
                <Route path="/programs/:categorySlug" element={<Programs />} />
                {/* Legacy course detail route - backward compatibility for old links */}
                <Route path="/programs/:slug" element={<ProgramDetail />} />
                <Route path="/explore/:goalSlug" element={<ExploreByGoal />} />
                <Route path="/subject/:subjectSlug" element={<SubjectDetail />} />
                <Route path="/learn/:slug" element={<SeoLanding />} />
                <Route path="/enroll/:courseSlug" element={<Enroll />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/payment-failed" element={<PaymentFailed />} />
                <Route path="/payment-callback" element={<PaymentCallback />} />
                <Route path="/learning/:courseId" element={<Learning />} />
                <Route path="/learning/:courseId/:subjectId" element={<Learning />} />
                <Route path="/ai-tutorial/:topicId" element={<AITutorial />} />
                <Route path="/language-topup/:courseId" element={<LanguageTopup />} />
                <Route path="/live" element={<Live />} />
                <Route path="/recordings" element={<Recordings />} />
                <Route path="/v3-player" element={<V3PlayerPage />} />
                <Route path="/v4-player" element={<V4PlayerPage />} />
                <Route path="/v5-player" element={<V5PlayerPage />} />
                <Route path="/v3-trial" element={<V3TrialPage />} />
                <Route path="/watch/:recordingId" element={<WatchRecording />} />
                
                <Route path="/forum" element={<Forum />} />
                <Route path="/forum/category/:slug" element={<ForumCategory />} />
                <Route path="/forum/post/:id" element={<ForumPost />} />
                <Route path="/forum/group/:groupId" element={<ForumGroupChat />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/success-stories" element={<SuccessStories />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/support" element={<Support />} />
                <Route path="/blog" element={<BlogListing />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/terms" element={<TermsAndConditions />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/implementation" element={<Implementation />} />
                <Route path="/invention-disclosure" element={<InventionDisclosure />} />
                <Route path="/doubt/:id" element={<DoubtAnswer />} />
                <Route path="/my-rewards" element={<MyRewards />} />
                <Route path="/reels" element={<MobileReels />} />
                <Route path="/timetable" element={<StudyTimetable />} />
                <Route path="/my-tests" element={<MyTests />} />
                <Route path="/my-tests/:id/take" element={<MyTestTake />} />
                <Route path="/my-tests/:id/result" element={<MyTestResult />} />
                <Route path="/practice-results/:resultId" element={<PracticeResultReview />} />
                <Route path="/my-notes" element={<MyNotesCourses />} />
                <Route path="/my-notes/:courseId" element={<MyNotesSubjects />} />
                <Route path="/my-notes/:courseId/:subjectId" element={<MyNotesChapters />} />

                
                {/* Admin Routes */}
                <Route path="/admin" element={<AdminProtectedRoute />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="categories" element={<CategoryList />} />
                    <Route path="categories/add" element={<CategoryForm />} />
                    <Route path="categories/edit/:id" element={<CategoryForm />} />
                    <Route path="explore-by-goal" element={<ExploreByGoalList />} />
                    <Route path="explore-by-goal/add" element={<ExploreByGoalForm />} />
                    <Route path="explore-by-goal/edit/:id" element={<ExploreByGoalForm />} />
                    <Route path="popular-subjects" element={<PopularSubjectsList />} />
                    <Route path="subjects/add" element={<SubjectForm />} />
                    <Route path="subjects/:id/edit" element={<SubjectForm />} />
                    <Route path="question-bank" element={<QuestionBank />} />
                    <Route path="question-bank/upload" element={<UploadQuestionBank />} />
                    <Route path="question-bank/verify" element={<VerifyUploadedQuestions />} />
                    <Route path="question-bank/verify/:documentId" element={<DocumentVerificationDetail />} />
                    <Route path="question-bank/jobs-monitor" element={<ProcessingJobsMonitor />} />
                    <Route path="notifications" element={<VerificationNotifications />} />
                    <Route path="question-bank/test-api" element={<TestReplitAPI />} />
                    <Route path="assignments" element={<AssignmentManager />} />
                    <Route path="popular-subjects/add" element={<PopularSubjectsForm />} />
                    <Route path="popular-subjects/edit/:id" element={<PopularSubjectsForm />} />
                    <Route path="courses" element={<CoursesList />} />
                    <Route path="courses/new" element={<CourseForm />} />
                    <Route path="courses/:courseId/edit" element={<CourseForm />} />
                    <Route path="batches" element={<BatchesList />} />
                    <Route path="batches/new" element={<BatchForm />} />
                    <Route path="batches/:id" element={<BatchDetails />} />
                    <Route path="batches/:id/edit" element={<BatchForm />} />
                    <Route path="orders" element={<OrdersList />} />
                    <Route path="promo-codes" element={<PromoCodesList />} />
                    <Route path="promo-codes/add" element={<PromoCodeForm />} />
                    <Route path="promo-codes/edit/:id" element={<PromoCodeForm />} />
                    <Route path="users" element={<UsersList />} />
                    <Route path="parents" element={<ParentsList />} />
                    <Route path="instructors" element={<InstructorsList />} />
                    <Route path="staff" element={<StaffList />} />
                    <Route path="academics" element={<Academics />} />
                    <Route path="academics/timetable" element={<AcademicsTimetable />} />
                    <Route path="academics/holidays" element={<HolidaysManager />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="settings/documentation" element={<Documentation />} />
                    <Route path="settings/generate-images" element={<GenerateSeedImages />} />
                    <Route path="settings/counselor-avatars" element={<CounselorAvatars />} />
                    <Route path="settings/featured-courses" element={<FeaturedCoursesManager />} />
                    <Route path="files" element={<FileBrowser />} />
                    <Route path="pdf-viewer" element={<PDFViewer />} />
                    
                    {/* Human Resource Routes */}
                    <Route path="hr/departments" element={<DepartmentsManager />} />
                    <Route path="hr/instructors" element={<InstructorsManager />} />
                    <Route path="hr/timetable" element={<TimetableManager />} />
                    <Route path="hr/bulk-assign-instructors" element={<BulkAssignInstructors />} />
                    <Route path="hr/live-classes" element={<LiveClassesManager />} />
                    <Route path="hr/recordings" element={<RecordingsManager />} />
                    <Route path="forum-moderation" element={<ForumModeration />} />
                    <Route path="support" element={<SupportDashboard />} />
                    <Route path="sales-leads" element={<SalesLeads />} />
                    <Route path="content-audit" element={<ContentAudit />} />
                    <Route path="content-audit/subject/:subjectId" element={<ContentAuditSubject />} />
                    <Route path="content-audit/chapter/:chapterId" element={<ContentAuditChapter />} />
                    <Route path="doc-coverage" element={<DocContentCoverage />} />
                    <Route path="cdn-doc-coverage" element={<CdnDocCoverage />} />
                    <Route path="coverage-analyzer" element={<CoverageAnalyzer />} />
                    <Route path="kie-balance" element={<KieAIBalance />} />
                    <Route path="reports" element={<AutoPipelineReports />} />
                    <Route path="pipeline-monitor" element={<PipelineMonitorPage />} />
                    <Route path="analytics" element={<AdminAnalytics />} />
                    <Route path="ask-ai" element={<AdminAskAI />} />
                    <Route path="visitor-analytics" element={<VisitorAnalytics />} />
                    <Route path="kannada-scan" element={<KannadaCoverageScan />} />
                    <Route path="kannada-queue" element={<KannadaQueue />} />
                    <Route path="cdn-presentation-refresh" element={<CdnPresentationRefresh />} />
                    <Route path="server4-jobs" element={<Server4Jobs />} />
                    <Route path="server78-jobs" element={<Server78Jobs />} />
                    <Route path="video-coverage" element={<VideoCoverageReport />} />
                    <Route path="language-checker" element={<LanguageChecker />} />
                    <Route path="completed-integrity" element={<CompletedJobIntegrity />} />
                  </Route>
                </Route>

                {/* Admin-only tools */}
                <Route path="/tools" element={<AdminProtectedRoute />}>
                  <Route path="download-source-files" element={<DownloadSourceFiles />} />
                </Route>
                
                {/* Instructor Routes */}
                <Route path="/instructor" element={<InstructorProtectedRoute />}>
                  <Route element={<InstructorLayout />}>
                    <Route index element={<InstructorDashboard />} />
                    <Route path="classes" element={<InstructorLiveClasses />} />
                    <Route path="subjects" element={<InstructorSubjects />} />
                    <Route path="activity" element={<InstructorActivityLog />} />
                  </Route>
                </Route>
                
                {/* Checker Routes - redirect to my-courses */}
                <Route path="/checker" element={<Navigate to="/my-courses" replace />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
            {/* <DeferredSalesWidget /> hidden per request */}
            </AIAssistantJobProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
  </ErrorBoundary>
);

export default App;
