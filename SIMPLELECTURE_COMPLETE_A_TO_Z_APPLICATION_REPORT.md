# SimpleLecture.com — Complete A-to-Z Application Report

> Repository built on **Lovable.dev** • Stack: **React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui + Supabase (Cloud)**
> This report covers the platform end-to-end from the perspectives of **Student, Teacher/Instructor, Checker, Admin, Guest, Super-Admin, Developer, and QA Tester**.
> Numbers at a glance: **~50 student/public pages**, **51 admin pages**, **4 instructor pages**, **1 checker page**, **128 Supabase Edge Functions**, **~378 React components**, **~140 Postgres tables**.

---

## Table of Contents
1. Application Overview
2. Full Page-by-Page Explanation
3. Student Flow (start → end)
4. Teacher / Instructor Flow
5. Admin Flow
6. Frontend Code Explanation
7. Backend / Supabase / Edge Functions
8. Database Documentation
9. Button-by-Button & Feature-by-Feature Audit
10. Complete QA Testing Checklist
11. Bug & Risk Report
12. Developer Handover Documentation
13. Final Summary & Roadmap

---

## 1. Application Overview

**SimpleLecture.com** is an AI-first Learning Management System (LMS) targeting Indian K-12 (CBSE/ICSE/State Boards, esp. Karnataka SSLC), competitive-exam prep (NEET, JEE, KCET, Banking), and professional up-skilling.

**Problems solved**
- Personalised AI-generated lectures per topic (video, presentation, narration in multiple Indian languages).
- Doubt clearing 24/7 via AI Teaching Assistant grounded in the current lecture (RAG).
- Live-classes (BigBlueButton), recordings, PYQ (Previous Year Questions) bank, DPP (Daily Practice Problems), self-tests, assignments.
- Forum + group chat for peer/instructor discussion.
- Reels/Stories short-form learning content served via Vimeo/CDN.
- Automated content pipelines that turn a raw PDF into a full course (chapters → topics → questions → PYQs → video lectures → reels).

**Primary user roles** (`app_role` enum, table `user_roles`)
- `student` (default on signup)
- `instructor` (teacher)
- `checker` (read-only verifier)
- `admin` (full platform)
- `super_admin` (used for a few destructive ops — same table, role = admin with extra guarded UI)

**Runtime architecture**
```
Browser (React SPA) ── Cloudflare proxy ──▶ Supabase (Postgres + Auth + Storage + Edge Functions)
                                               │
                                               ├── Backblaze B2 (video/audio/pdf storage, signed URLs)
                                               ├── Vimeo (reels/marketing videos)
                                               ├── Lovable AI Gateway → Gemini 2.5 Flash / Flash-Image
                                               ├── OpenAI (fallback)
                                               ├── Mathpix + Datalab (OCR)
                                               ├── Razorpay (payments)
                                               ├── Nettyfish (SMS/OTP), SMTP (email), Wacto (WhatsApp), FCM (push)
                                               └── Custom GPU servers (204.12.237.78:5005 lectures, :5006 marketing) via proxy
```

---

## 2. Full Page-by-Page Explanation

Routes come from `src/App.tsx`. Every lazy-loaded page is wrapped in `lazyWithRetry` and rendered under `AuthProvider → HelmetProvider → QueryClientProvider → BrowserRouter`.

### 2.1 Public / Guest pages

| Route | File | Purpose | Key buttons/actions |
|---|---|---|---|
| `/` | `pages/Index.tsx` | Landing page: Hero, Programs, Bestsellers, Testimonials, FAQ | "Explore programs", "Get started" → `/auth`, category tiles → `/programs/:slug` |
| `/programs` | `Programs.tsx` | All categories grid | Tap category → `/programs/:slug` |
| `/programs/:slug` | `ProgramDetail.tsx` | Category + its courses | Enroll, Add to cart |
| `/explore/:slug` | `ExploreByGoal.tsx` | Goal-based landing (SEO) | Enroll CTAs |
| `/courses/:slug` | `CoursePreviewRoute.tsx` | Marketing course page: thumbnails, promo video, FAQs, teachers, subjects | "Enroll now", "Add to cart", "Language topup" |
| `/subject/:slug` | `SubjectDetail.tsx` | Subject preview with chapter list | Enroll CTA if not enrolled |
| `/blog` | `BlogListing.tsx` | Auto-generated SEO blog index | Read post |
| `/blog/:slug` | `BlogPost.tsx` | Article with JSON-LD, share | — |
| `/about-us`, `/how-it-works`, `/success-stories`, `/contact-us`, `/privacy-policy`, `/terms-and-conditions`, `/invention-disclosure`, `/implementation`, `/ai-tutorial` | static/marketing | SEO + lead-gen | Contact form → `sales_leads` |
| `/seo/:slug` | `SeoLanding.tsx` | Programmatic SEO landing | — |
| `/auth` | `Auth.tsx` | Login/Signup/OTP tabs | Sign-in (email/phone), Sign-up, Google OAuth, OTP verify |
| `/forgot-password` | `ForgotPassword.tsx` | Email-OTP reset flow | Send OTP → verify → new password |
| `*` | `NotFound.tsx` | 404 | Go home |

### 2.2 Authenticated Student pages

| Route | File | Purpose |
|---|---|---|
| `/dashboard` | `Dashboard.tsx` | Router shell that redirects by role. |
| `/student-dashboard` | `StudentDashboard.tsx` | Home for students: enrolled courses, streaks, badges, timetable widget. |
| `/my-courses` | `MyCourses.tsx` | Enrolled course grid with progress (`get_enrolled_courses_with_progress`). |
| `/learning/:courseId/:subjectId?` | `Learning.tsx` | **Core LMS shell** — sidebar with chapters/topics + tabs: Overview / Classes (recorded) / Live / Doubts / Solutions / DPP / Assignments / Questions / Notes / Tests / PYQ. |
| `/v3-player/:jobId` | `V3PlayerPage.tsx` | Multi-section educational player with karaoke narration and chroma-key avatar. |
| `/v4-player/:jobId` | `V4PlayerPage.tsx` | Single-video (marketing) player. |
| `/live/:classId` | `Live.tsx` | BBB live class iframe wrapper. |
| `/watch-recording/:id` | `WatchRecording.tsx` | Recorded class playback with completion tracking. |
| `/recordings` | `Recordings.tsx` | Global recordings list. |
| `/mobile-reels` | `MobileReels.tsx` | Vertical Vimeo/native reels feed. |
| `/study-timetable` | `StudyTimetable.tsx` | Personal schedule generator. |
| `/my-tests`, `/my-tests/take/:id`, `/my-tests/result/:id` | test flow | Take self/auto-tests and view result. |
| `/my-rewards` | `MyRewards.tsx` | Badges, streaks, certificate download. |
| `/forum`, `/forum/:categorySlug`, `/forum/post/:postId`, `/forum/group/:groupId` | Community Q&A, groups, chat. |
| `/doubt/:doubtId` | `DoubtAnswer.tsx` | AI+admin doubt thread. |
| `/support` | `Support.tsx` | Support ticket UI (AI-first triage, escalation). |
| `/profile` | `Profile.tsx` | Personal info, phone verify, password change. |
| `/cart`, `/checkout`, `/enroll/:slug`, `/language-topup/:courseId` | commerce flow. |
| `/payment-success`, `/payment-failed`, `/payment-callback` | Razorpay result handlers (`recover-pending-payments` cron catches stragglers). |

### 2.3 Instructor pages (`role = instructor`)

| Route | File | Purpose |
|---|---|---|
| `/instructor` | `InstructorDashboard.tsx` | KPIs, upcoming classes, assigned subjects. |
| `/instructor/subjects` | `InstructorSubjects.tsx` | Subjects list + drill into chapters/topics. |
| `/instructor/live-classes` | `InstructorLiveClasses.tsx` | Create/start BBB classes, share join links. |
| `/instructor/activity-log` | `InstructorActivityLog.tsx` | Audit trail (`instructor_activity_log`). |

### 2.4 Checker pages (`role = checker`)

| Route | File | Purpose |
|---|---|---|
| `/checker` | `CheckerDashboard.tsx` | Read-only verify Classes + Questions; write to `checker_reviews`. |

### 2.5 Admin pages (`role = admin`) — under `/admin/*` wrapped in `AdminProtectedRoute + AdminLayout`

Grouped by area — every page has full CRUD unless noted.

**Overview**
- `/admin` → `AdminDashboard.tsx` — real-time DB stats via `get_admin_analytics`.
- `/admin/analytics` → `AdminAnalytics.tsx`, `/admin/visitor-analytics` → `VisitorAnalytics.tsx`.

**Catalog**
- Categories: `CategoryList`, `CategoryForm`
- Courses: `CoursesList`, `CourseForm`, `FeaturedCoursesManager`
- Subjects: `PopularSubjectsList/Form`, `SubjectForm`
- Explore-by-goal: `ExploreByGoalList/Form`
- Promo codes: `PromoCodesList`, `PromoCodeForm`

**Academics**
- `Academics.tsx` (chapters, topics, subtopics tree editor)
- `AcademicsTimetable.tsx`, `HolidaysManager.tsx`, `AssignmentManager.tsx`
- `ContentAudit.tsx` / `ContentAuditSubject.tsx` / `ContentAuditChapter.tsx` — bulk publish state.
- `AutoPipelineReports.tsx` — video-generation queue reports.

**Content Ingestion / QA**
- `UploadQuestionBank.tsx`, `VerifyUploadedQuestions.tsx`, `QuestionBank.tsx`
- `DocumentVerificationDetail.tsx`, `VerificationNotifications.tsx`
- `ProcessingJobsMonitor.tsx`, `PDFViewer.tsx`, `FileBrowser.tsx`
- `GenerateSeedImages.tsx`, `CounselorAvatars.tsx`, `RecordingsManager.tsx`
- Admin video generator: `components/admin/SubjectVideoGeneratorTab.tsx` (Standard / Auto-submission / **Marketing Videos** modes, port 5005/5006).
- `TopicVisibilityControl.tsx` — per-topic dropdown "Both / Lecture only / Marketing only / Hide all".

**People**
- Users, Parents, Instructors, Staff (create/edit/delete via `admin-delete-user` edge function).
- Batches: `BatchesList`, `BatchForm`, `BatchDetails`, `BulkAssignInstructors`.

**Commerce**
- `OrdersList.tsx`, `SalesLeads.tsx`.

**Support & Community**
- `SupportDashboard.tsx`, `ForumModeration.tsx`.

**Ops**
- `Settings.tsx`, `KieAIBalance.tsx`, `TestReplitAPI.tsx`, `Documentation.tsx`.

Each admin page follows the same shell: page header, filter/search, TanStack Query data table, "Add / Edit / Delete / Bulk" buttons — every mutation is a Supabase RPC or REST call that respects `has_role(auth.uid(),'admin')` RLS.

---

## 3. Student Flow — Start to End

1. **Land on `/`** → SEO Hero + programs.
2. Click **Explore** → `/programs/:slug` → click a course card → `/courses/:slug`.
3. Click **Enroll**:
   - If logged out → `/auth?tab=signup`.
   - Signup with **name/email/phone/password**; profile trigger `handle_new_user` inserts `profiles` + `user_roles(role=student)`.
   - OTP: SMS via **Nettyfish** or email OTP; a partial unique index prevents duplicate phone.
4. **Payment** via Razorpay (`create-payment-order` → checkout → `razorpay-webhook` → `enrollments` row + `payments` row). Free courses use `enroll-free-course`.
5. Redirect to `/student-dashboard`. Home shows: enrolled courses, streaks, timetable, notifications.
6. Enter course: **`/learning/:courseId/:subjectId`**.
   - Left sidebar: chapters → topics (auto-closes on mobile after selection).
   - Tabs:
     - **Overview** — chapter summary.
     - **Classes** — recorded AI lectures + Marketing videos (V4 player) filtered by `topic_lecture_visibility`.
     - **Live** — join BBB class.
     - **Doubts** — community Q&A + AI-similar question chips (via `find_similar_questions` RPC with `pg_trgm`).
     - **Solutions** — presentation-ready answers with "Watch Presentation".
     - **DPP** — 5-question daily practice sessions, saved to `dpp_topic_submissions`.
     - **Assignments** — 4-state pre-assigned tasks, OCR grading.
     - **Questions** — chapter questions with subjective/OCR flow.
     - **Notes** — PDFs served via B2 signed URLs.
     - **Tests** — self-tests + auto-chapter tests.
     - **PYQ** — previous-year papers.
7. Playing a lecture → **EducationalVideoPlayer** loads presentation JSON, pre-caches Phase-1 (2 sections), renders WebGL chroma-key avatar + karaoke narration. On avatar 404 → "Continue without avatar" dialog (presentation-only mode).
8. Marketing lectures → **V4 player** (single MP4 from dev-server, 10-second seek buttons).
9. Progress logged in `student_progress` (weighted per available content), badges awarded via `award-badge` edge function, streaks in `daily_login_attendance`.
10. **Certificate** downloadable when `course_complete` badge fires (html2canvas).
11. **Logout** — `queryClient.clear()` then `supabase.auth.signOut()` to avoid stale-cache crashes.

**Edge cases**
- Slow network → HLS fallback + Cloudflare + B2 Bandwidth Alliance.
- Payment redirect fail → `recover-pending-payments` cron reconciles.
- OTP resend rate-limited by `phone_otp_verifications.attempts`.

---

## 4. Teacher / Instructor Flow

1. Instructor account created by admin (`create-instructor` edge fn) → role `instructor` added in `user_roles`.
2. Login → redirected to `/instructor`.
3. Dashboard shows assigned subjects (`instructor_subjects`), upcoming classes (`instructor_timetables`), activity summary.
4. **Live Classes**:
   - Click "Schedule class" → creates `scheduled_classes` + `bbb-api` room.
   - "Start class" → opens BBB moderator URL.
   - Recording auto-uploaded to `class-recordings` bucket, stored via `bbb-webhooks`.
5. **Subjects**: view chapter/topic tree, upload notes (Datalab OCR pipeline), regenerate materials.
6. **Attendance** auto-tracked from `class_attendance` when students join.
7. **Activity Log**: every action written to `instructor_activity_log`.
8. Instructors **cannot** modify catalog, users, payments, or edit other instructors' subjects (RLS enforced).

---

## 5. Admin Flow

1. Login at `/auth`, role check → `AdminProtectedRoute` allows only `has_role('admin')`.
2. **Dashboard** — real-time users, revenue, active courses, ticket queue.
3. **Catalog management** — CRUD on categories/courses/subjects; thumbnails uploaded to `course-thumbnails` bucket.
4. **Content pipeline**:
   - Upload PDF → `uploaded_question_documents` → `analyze-document-structure` → `extract-questions-from-document` → `parsed_questions_pending` → checker verifies → `approve-and-transfer-questions` promotes to `questions`.
   - Auto chapter/topic suggestion via `ai-suggest-chapter-topic`.
5. **Video generation** (Subject → Videos tab):
   - **Standard mode**: single job → `video-generation-proxy` → GPU 5005 → `video_generation_jobs`.
   - **Auto Submission**: server-side loop via `auto-submission-tick` + `pg_cron`; resume logic in `useActiveAutoSubmissionRun`.
   - **Marketing Videos**: port 5006 through `marketing-video-proxy`; results published to `V4 player`, URLs cached in `reel_vimeo_urls` / `reel_devserver_urls`.
6. **Visibility control**: `topic_lecture_visibility` decides which cards students see (Both/Lecture-only/Marketing-only/Hide all). Uses `usePublishedAILectures({skipVisibilityFilter:true})` in admin so the dropdown never disappears.
7. **Users & Orders**: search by email/phone (`search-users-by-email`); manual enroll (`admin-enroll-user`); refund/void.
8. **Support Dashboard**: escalated tickets from AI, manual reply.
9. **Forum Moderation**: hide posts, ban users.
10. **Analytics**: `get_admin_analytics(since)` returns visits, sources, top pages, recent signups.
11. **Settings**: promo codes, holidays, timetables, featured courses, counselor avatars.

---

## 6. Frontend Code Explanation

### 6.1 Folder structure
```
src/
├── App.tsx                 # Router + providers + role guards
├── main.tsx                # createRoot + BrowserRouter bootstrap
├── contexts/               # AuthContext, AIAssistantJobContext
├── hooks/                  # 60+ TanStack Query hooks (useEnrollments, useLearningData, useActiveAutoSubmissionRun, etc.)
├── lib/                    # supabaseUrl (Cloudflare rewrite), queryClient, latexNormalizer, lazyWithRetry
├── integrations/supabase/  # generated client + types.ts (READ-ONLY)
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── learning/           # LMS tabs, players (V3/V4/Educational), AI assistant
│   ├── admin/              # Admin shell + feature tabs
│   ├── instructor/, checker/, forum/, mobile/, hr/
│   └── SEO/                # JSON-LD, canonical, RouteNoIndex
└── pages/                  # top-level routes (see §2)
```

### 6.2 Routing
`App.tsx` builds `<Routes>` with Suspense-wrapped lazy components. Role-guarded shells: `AdminProtectedRoute`, `InstructorProtectedRoute`, `CheckerProtectedRoute`. `ScrollToTop` + `RouteLogger` + `AnalyticsTracker` mount once inside `<BrowserRouter>`.

### 6.3 State management
- **Server state**: TanStack Query (`queryClient` with `retry:2`, `staleTime`). Cache cleared on user switch/sign-out via `AuthCacheManager`.
- **Auth state**: `AuthContext` subscribes to `supabase.auth.onAuthStateChange`.
- **Local UI**: React `useState`/`useReducer`.

### 6.4 Styling
Tailwind v3 with semantic tokens in `src/index.css` (light + dark), shadcn variants; **no hard-coded colors** in components. `MathText` renders KaTeX via `remark-math` + `rehype-katex`, feeding through `latexNormalizer.ts` (`/$…/$` → `$…$`).

### 6.5 Resilience patterns
- `lazyWithRetry` — sessionStorage tracker forces reload on stale-chunk errors.
- Global `ErrorBoundary` — fallback UI, prevents blank screens.
- Public queries use `.maybeSingle()` + `retry:2`.
- `queryClient.clear()` before `signOut()`.

### 6.6 Mobile
`SmartHeader` + bottom nav (`components/mobile/BottomNavigation.tsx`) with explicit route exclusions. Learning page collapses tabs into a 2-column quick-actions grid on `<md`. Reels use vertical Vimeo iframes controlled through `ReelMedia` handle (`play/pause/reset/setMuted`).

### 6.7 Analytics & Tracking
`useGoogleAnalytics`, `useFacebookPixel`, `useVisitorTracking` write into `page_visits` with source normalisation (`Direct/Testing/Instagram/Facebook/YouTube/Google/Other`).

---

## 7. Backend / Supabase / Edge Functions

### 7.1 Auth
Email/password + Phone OTP + Google OAuth. Trigger `handle_new_user` seeds `profiles` and `user_roles`. Password reset uses `send-password-reset-otp` → `reset-password-with-token`.

### 7.2 Storage buckets
`course-thumbnails`, `category-icons`, `question-images`, `chapter-pdfs`, `previous-year-papers`, `presentation-audio`, `class-recordings` (private), `blog-images`, `temp-uploads` (B2 hop), etc. Backblaze B2 (private) is proxied via `b2-proxy-file` and `b2-get-download-url` (signed).

### 7.3 Edge Functions (128 total, grouped)

| Group | Functions |
|---|---|
| **AI** | ai-teaching-assistant, ai-teaching-proxy, ai-doubts-chat, ai-doubt-clear, ai-tutor-chat, ai-sales-assistant, ai-support-assistant, ai-generate-* (assignment, curriculum, dpp, faqs, image, mcqs, podcast, solution, topic-content, video, course-content), ai-check-answer, ai-compare-math-answers, ai-grade-assignment, ai-rephrase, ai-suggest-chapter-topic |
| **Video pipeline** | video-generation-proxy, marketing-video-proxy, auto-pipeline-scanner, auto-pipeline-worker, auto-submission-tick, reconcile-video-jobs, retry-failed-job, presentation-update-worker, generate-story-video, auto-publish-story-reels, save-presentation-audio, check-replit-job-status, sync-pregen-cache |
| **OCR/Docs** | analyze-document-structure, parse-pdf-to-json, process-educational-pdfs, process-llm-extraction, extract-questions-from-document, extract-questions-preview, extract-json-to-questions, extract-pyq-questions, extract-dpp-questions, extract-dpp-answers, extract-dpp-page, extract-answer-from-image, llm-verify-questions, llm-verify-single-question, backfill-question-images, deduplicate-questions |
| **TTS** | google-tts, sarvam-tts, indic-parler-tts, bharat-tts |
| **Payments** | create-payment-order, create-topup-order, razorpay-webhook, recover-pending-payments, enroll-free-course |
| **Auth/Users** | send-email-otp, send-phone-otp, send-password-reset-otp, reset-password-with-token, admin-delete-user, create-instructor, create-single-account, create-test-accounts, create-test-admin, search-users-by-email |
| **Live/BBB** | bbb-api, bbb-webhooks, send-class-reminders |
| **Storage/B2** | b2-upload, b2-large-upload, b2-list-files, b2-proxy-file, b2-get-download-url, b2-delete-file |
| **Notifications** | send-daily-motivation-email, send-blog-notification, whatsapp (Wacto), push (FCM) |
| **Misc** | homepage-data, dynamic-sitemap, generate-blog-post, generate-seed-images, migrate-*, export-verification-report, offline-download-api, record-daily-attendance, forum-ai-reply, approve-and-transfer-questions, award-badge, check-chapter-completion, regrade-self-test, create-self-test |

Every function uses `Deno.env.get(...)` for secrets and `SUPABASE_SERVICE_ROLE_KEY` internally — never exposed to the browser.

### 7.4 Cron
`pg_cron` jobs invoke: `auto-submission-tick`, `send-class-reminders`, `send-daily-motivation-email`, `recover-pending-payments`, `dynamic-sitemap` rebuild, `record-daily-attendance`.

---

## 8. Database Documentation (highlights — ~140 tables)

Complete list is in `<supabase-tables>` context. Key domains:

**Auth/Users**: `profiles`, `user_roles` (enum `app_role`), `push_notification_tokens`, `email_otp_verifications`, `phone_otp_verifications`, `password_reset_otps`.

**Catalog**: `categories`, `courses`, `course_categories`, `course_subjects`, `course_thumbnails`, `course_faqs`, `course_teachers`, `popular_subjects`, `subject_chapters`, `subject_topics`, `subtopics`, `explore_by_goal`, `featured_courses`.

**Commerce**: `enrollments`, `cart_items`, `order_items`, `payments`, `discount_codes`, `language_topup_purchases`, `sales_leads`.

**Learning**: `student_progress`, `student_progress_2025/2026` (partitioned), `ai_video_watch_logs`, `video_watch_progress`, `daily_login_attendance`, `daily_activity_logs`, `student_badges`.

**Assessments**: `questions`, `pyq_questions`, `test_questions`, `tests`, `self_tests`, `self_test_questions`, `self_test_answers`, `auto_chapter_tests`, `dpp_documents`, `dpp_questions`, `dpp_topic_submissions`, `dpp_attempted_questions`, `test_results`, `paper_test_results`, `quiz_attempts`, `student_answers`, `assignments`, `assignment_submissions`.

**AI/Videos**: `video_generation_jobs`, `video_storyboards`, `ai_assistant_documents`, `teaching_qa_cache`, `pregen_question_cache`, `topic_lecture_visibility`, `language_generation_runs`, `language_avatar_jobs`, `topic_videos`, `auto_submission_runs`, `auto_pipeline_runs`, `auto_pipeline_reports`, `reel_jobs`, `published_reels`, `reel_vimeo_urls`, `reel_devserver_urls`, `counselor_avatars`.

**Live/Rec**: `scheduled_classes`, `class_recordings`, `class_attendance`, `batches`, `holidays`, `course_timetables`, `instructor_timetables`, `timetable_overrides`.

**Forum/Support**: `forum_categories`, `forum_posts`, `forum_replies`, `forum_upvotes`, `forum_groups`, `forum_group_members`, `forum_group_messages`, `forum_group_message_reads`, `forum_flags`, `support_tickets`, `support_messages`, `support_articles`, `support_faqs`, `support_article_feedback`, `doubt_logs`.

**Ops**: `page_visits`, `visitor_analytics`, `notices`, `notice_reads`, `blog_posts`, `documentation_pages`, `student_activity_log`, `instructor_activity_log`, `checker_reviews`, `verification_notifications`, `network_quality_logs`, `job_logs`, `jobs`, `slides`, `slide_results`, `storage_files`, `ocr_results`, `document_processing_jobs`, `image_enhancements`, `offline_downloads`.

**Key RLS pattern**: policies always use `has_role(auth.uid(),'admin')` for admin bypass; user-scoped rows use `auth.uid() = user_id`; every public table has explicit `GRANT` block.

**Notable RPCs**: `find_similar_questions`, `get_admin_analytics`, `get_enrolled_courses_with_progress`, `get_learning_course_data`, `get_subject_chapters_with_topics`, `get_published_lecture_stats`, `get_topic_lecture_durations`, `get_course_detail`, `check_course_enrollment`, `claim_auto_submission_run`, `delete_subject_cascade`, `deduplicate_questions`, `get_question_bank_page`, `refresh_student_analytics`, `has_role`.

---

## 9. Button-by-Button & Feature Audit (representative extract)

| Feature | Location | Role | On click | Backend | File |
|---|---|---|---|---|---|
| "Enroll now" | Course detail | Guest/Student | Opens Razorpay or `/auth` | `create-payment-order` → `razorpay-webhook` → `enrollments` | `pages/Enroll.tsx` |
| "Add to cart" | Course card | Any | Insert into `cart_items` | REST | `hooks/useCart.ts` |
| "Start lecture" | Classes tab | Student | Loads presentation JSON, mounts Educational Player | `video_generation_jobs` fetch + B2 media | `components/learning/RecordedVideos.tsx` |
| "Watch Presentation" | Solutions tab | Student | Injects cache + mounts AI assistant in preparing-audio state | `sync-pregen-cache` | `SolutionsTab.tsx` |
| "Ask AI" | Doubts tab | Student | Streams answer + similar chips | `ai-doubts-chat` + `find_similar_questions` | `DoubtsTab.tsx` |
| "Generate videos" | Admin → Subject → Videos | Admin | Submits jobs to GPU 5005/5006 | `video-generation-proxy` / `marketing-video-proxy` | `SubjectVideoGeneratorTab.tsx` |
| "Student visibility" | Admin → Subject → Videos | Admin | Upserts `topic_lecture_visibility` | REST | `TopicVisibilityControl.tsx` |
| "Approve" | Verify Questions | Admin/Checker | Moves rows from pending → `questions` | `approve-and-transfer-questions` | `VerifyUploadedQuestions.tsx` |
| Chapter Content button | Learning sidebar | Student | `e.preventDefault()` — intentionally disabled | — | `pages/Learning.tsx` |
| 10-sec back/forward | V4 player | Student | `video.currentTime ±= 10` | — | `V4BottomBar.tsx`, `V4MergedPlayer.tsx` |
| "Continue without avatar" | Educational Player | Student | `markAvatarUnavailable()` — presentation-only mode | — | `EducationalVideoPlayer.tsx` |
| "Publish reel" | Admin reel manager | Admin | Writes vimeo/dev URLs | edge fn + `reel_vimeo_urls`/`reel_devserver_urls` | reel components |
| "Start live class" | Instructor | Instructor | Opens BBB moderator URL | `bbb-api` | `InstructorLiveClasses.tsx` |
| "Escalate ticket" | Support | Student/Admin | Status → `ESCALATED_TO_ADMIN` | REST | `Support.tsx`, `SupportDashboard.tsx` |
| Download certificate | Rewards | Student | html2canvas → PNG/PDF | client-only | `MyRewards.tsx` |

Every button obeys role checks (client + RLS). All destructive admin buttons show a shadcn `AlertDialog`.

---

## 10. Complete QA Testing Checklist

Legend: ⬜ untested • ✅ pass • ❌ fail

### Public
- ⬜ Home loads under 2.5s LCP
- ⬜ SEO tags present (title, description, canonical, JSON-LD)
- ⬜ Sitemap resolves via `dynamic-sitemap` edge fn
- ⬜ Contact form writes `sales_leads`
- ⬜ 404 route renders `NotFound`

### Auth
- ⬜ Signup email/password
- ⬜ Signup phone + OTP (Nettyfish)
- ⬜ Google OAuth
- ⬜ Forgot password → OTP email → reset
- ⬜ Duplicate phone rejected by partial unique index
- ⬜ Role-based redirect after login

### Student LMS
- ⬜ My Courses shows correct progress
- ⬜ Lecture starts within 5s (Phase-1 preload)
- ⬜ Avatar 404 → dialog appears
- ⬜ Marketing lecture opens V4 player
- ⬜ Doubts chips render KaTeX inline (no wrap unless overflow)
- ⬜ DPP session saves with null test_id
- ⬜ Assignments OCR + grading
- ⬜ Notes PDFs load via signed URL
- ⬜ Reels play/pause via handle; mute persists
- ⬜ Certificate downloads on course completion

### Instructor
- ⬜ Only sees assigned subjects
- ⬜ Can start BBB class; recording appears in Recordings
- ⬜ Activity log entries created

### Admin
- ⬜ Dashboard counts match `get_admin_analytics`
- ⬜ CRUD on categories/courses/subjects
- ⬜ Standard + Auto + Marketing pipelines submit jobs
- ⬜ Visibility dropdown always present regardless of state
- ⬜ Support escalation queue populates
- ⬜ Question verification transfer works
- ⬜ Delete subject cascade removes children

### Payments
- ⬜ Successful Razorpay flow → enrollment created
- ⬜ Failed payment → `recover-pending-payments` cleans
- ⬜ Discount code applied

### Cross-cutting
- ⬜ Mobile responsive (Learning quick-actions, reels)
- ⬜ Browsers: Chrome / Safari / Firefox / Android WebView / iOS Safari
- ⬜ RLS: student cannot query other users' rows
- ⬜ RLS: checker cannot mutate `questions` directly
- ⬜ No console errors during main flows
- ⬜ Broken image / offline states render skeletons
- ⬜ Accessibility: focus outlines, alt text, ARIA labels

---

## 11. Bug & Risk Report

**Confirmed / historical fixes recently applied**
- Avatar 404 was blocking playback → added "Continue without avatar".
- Auto-submission runs got stuck on failed items → `useActiveAutoSubmissionRun` now resets and re-submits.
- Visibility dropdown disappeared when hiding cards → `skipVisibilityFilter` fix.
- KaTeX in Doubts suggestion chips wrapping mid-formula → now allows normal wrap with `break-words`.

**Open risks**
- **Origin server IPs** (204.12.237.78:5005/5006) reachable when proxy misroutes; ensure all traffic goes through `video-generation-proxy` / `marketing-video-proxy`.
- **B2 signed URLs** default TTL — verify not > 24h to prevent leakage.
- **User_roles table**: never store role on `profiles`; audit any code path that reads role from JWT metadata.
- **Support triage**: LLM must never answer academic questions — enforce via system prompt guardrail (already in `ai-support-assistant`).
- **Rate limits**: OTP and Ask-AI endpoints need per-user throttle to stop abuse.
- **Dead / duplicate code**: multiple test admin creation functions (`create-test-admin`, `create-test-accounts`, `create-single-account`) should be consolidated.
- **Realtime subscriptions**: verify every `.channel()` is inside `useEffect` with cleanup to avoid billing spikes.
- **Performance**: `Learning.tsx` is large — consider splitting tabs into route children instead of state tabs.
- **Accessibility**: several icon-only buttons lack `aria-label`.
- **SEO**: some admin routes render before `RouteNoIndex` — ensure noindex header present on private pages.

---

## 12. Developer Handover

### 12.1 Local run
```
bun install         # or pnpm/npm
bun dev             # Vite on http://localhost:8080
```
Env (`.env` auto-populated by Lovable):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=oxwhqvsoelqqsblmqkxx
```

### 12.2 Deployment
Lovable CI builds Vite → static assets; Supabase edge functions auto-deploy from `supabase/functions/*`. No manual `supabase functions deploy` needed.

### 12.3 Where to edit
| Area | Path |
|---|---|
| Routes | `src/App.tsx` |
| Design tokens | `src/index.css` |
| Auth logic | `src/contexts/AuthContext.tsx`, `pages/Auth.tsx` |
| Role guards | `components/admin/AdminProtectedRoute.tsx`, `components/instructor/*`, `components/checker/*` |
| LMS shell | `pages/Learning.tsx` + `components/learning/*` |
| Players | `components/learning/player/EducationalVideoPlayer.tsx`, `V3*`, `V4*` |
| AI Assistant | `components/learning/AITeachingAssistant.tsx`, `supabase/functions/ai-teaching-assistant` |
| Video pipelines | `components/admin/SubjectVideoGeneratorTab.tsx`, `supabase/functions/{video-generation-proxy,marketing-video-proxy,auto-submission-tick}` |
| DB migrations | `supabase/migrations/*` (managed by migration tool — never hand-edit) |

### 12.4 Adding a new admin page
1. Create `src/pages/admin/MyPage.tsx`.
2. Add lazy import + route in `App.tsx` under `<AdminProtectedRoute>`.
3. Add sidebar link in `components/admin/AdminSidebar.tsx`.
4. Guard data with `has_role(auth.uid(),'admin')` RLS.

---

## 13. Final Summary & Roadmap

**Working well**
- Course discovery, enrollment, payments, LMS shell, AI lecture playback, admin CRUD, video pipelines (Standard/Auto/Marketing), Support AI triage, Reels via Vimeo, Forum + Groups.

**Partially working / recently patched**
- Auto-submission resume path.
- Marketing card visibility toggle.
- KaTeX rendering in doubts chips.
- Avatar-less fallback in Educational Player.

**Missing / recommended next**
1. Consolidate duplicate test-account edge functions.
2. Add rate-limits for AI + OTP endpoints.
3. Split `Learning.tsx` tabs into nested routes for perf + shareable URLs.
4. Add e2e Playwright suite covering the 12 flows in §10.
5. Enforce origin-IP hiding — audit that no client fetches hit `204.12.237.78` directly.
6. Add WCAG 2.1 AA audit + fixes.
7. Add offline-first PWA shell for mobile students.
8. Certification: sign PDFs server-side (Edge fn) instead of html2canvas only.
9. Observability: pipe edge function logs into a dashboard (Supabase logs already available).
10. Expand `super_admin` capabilities as a distinct role in `app_role` enum.

**Priority order**
1. Security/rate-limits (#2, #5) — protect infra & spend.
2. Perf/PWA (#3, #7) — student experience.
3. Reliability (#4, #9) — CI test coverage + observability.
4. Delight (#6, #8, #10) — polish.

---

*End of report — generated for internal QA, product, and dev handover use.*
