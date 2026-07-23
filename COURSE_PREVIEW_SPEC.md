# Course Preview Page — Mobile Port Spec (for Replit)

> Target screen on web: **`/course/:slug/preview`**
> Source file: `src/pages/CoursePreview.tsx`
> Audience: Replit team building the same screen inside the mobile app.

This document explains every visual element, data source, prop, dialog, tab, and edge case so the mobile app can render a 1:1 equivalent.

---

## 1. Overview

| Item | Value |
|---|---|
| Route | `/course/:slug/preview` |
| Auth required | ❌ No (fully public) |
| Purpose | Let unregistered / not-yet-paid users **try a course** for free. Admin picks which chapters are unlocked. Locked chapters show a "Purchase required" dialog. AI Assistant + Doubts tabs work, but are capped by per-course quotas. |
| Entry point | Green **"Free Preview Available"** card on `/course/:slug` (see `FREE_PREVIEW_SPEC.md`). |
| Supabase project ref | `oxwhqvsoelqqsblmqkxx` |
| Anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (same as web `VITE_SUPABASE_PUBLISHABLE_KEY`) |

---

## 2. Page state machine

```
mount
  ├─ usePreviewCourse(slug)              → course + subjects
  ├─ useCourseFreeAccess(course.id)      → unlocked chapter rows
  └─ useCourseFreePreviewLimits(course.id) → { ai, doubts }
        ↓
auto-select first subject
        ↓
useSubjectChapters(selectedSubjectId)    → chapters + nested topics
useTopicLectureDurations(subjectId)      → { topicId: minutes }
        ↓
user picks a topic in sidebar
        ↓
content panel renders 8 tabs
```

### Empty / error states

| Condition | UI |
|---|---|
| Course meta still loading | Full-page skeletons (`Skeleton h-10 w-1/3`, `Skeleton h-80 w-full`) |
| Course not found OR `is_active=false` | Centered Card: **"Course not found"** + button → `/programs` |
| Free-access rows loaded and `unlockedChapterIds.size === 0` | Centered Card with `Sparkles` icon: **"Preview not available yet"** + button → `/course/:slug` |

---

## 3. Layout

The web layout is a top bar + horizontal subject chips + a 2-column grid (sidebar | content). On mobile (`useIsMobile()` → < 768px) the sidebar is **closed by default**; the user opens it via a "Chapters" button.

```
┌────────────────────────────────────────────────────────────┐
│  ← Back    [BookOpen] Course Name  [Free Preview]  [Buy]   │  ← top bar (border-b, bg-card)
├────────────────────────────────────────────────────────────┤
│  ( Subject )( Subject )( Subject )( Subject ) →            │  ← horizontal scroll pills
├────────────────┬───────────────────────────────────────────┤
│  Chapters      │   [Classes][AI][Questions][Assignments]   │
│  ▸ Ch 1 ✓      │   [DPP][Results][Doubts][PYQ's]           │
│  🔒 Ch 2       │                                            │
│  🔒 Ch 3       │   <tab content here>                       │
└────────────────┴───────────────────────────────────────────┘
```

### 3.1 Top bar

```tsx
<Link to={`/course/${slug}`}>← Back</Link>
<BookOpen /> <span>{course.name}</span> <Badge variant="secondary">Free Preview</Badge>
<Button size="sm" onClick={() => navigate(`/course/${slug}`)}>Buy course</Button>
```

- Sticky/border-bottom card background.
- On mobile, truncate course name; keep Back + Buy always visible.

### 3.2 Subject chips

Rendered ONLY when subjects.length > 0. One pill per subject.

- Selected → `bg-primary text-primary-foreground border-primary`
- Unselected → `bg-background hover:bg-muted`
- Tapping a chip: `setSelectedSubjectId(s.id); setSelectedTopic(null)` (clears selected topic).

### 3.3 Sidebar (chapters)

State: `sidebarOpen` (boolean). Default = `!isMobile`.

- Toggle icons: `PanelLeftClose` (hide), `PanelLeftOpen` (show).
- When open: ~320px wide card with header **"Chapters"** + `FolderOpen` icon.
- When closed: a small **"Chapters"** outline button is shown at the top of the content panel that opens it again.

#### Mobile recommendation
Replace the desktop sidebar with a **bottom sheet** or **full-screen drawer** triggered by a sticky "Chapters" button. The data, locking, and tap behavior stay identical.

### 3.4 Chapter list behavior

Rendered as a shadcn `Accordion` (`type="single" collapsible`).

For each chapter (`chapters` from `useSubjectChapters`):

**Unlocked chapter** (in `unlockedChapterIds`):
```tsx
<AccordionItem className="border rounded-md bg-primary/5">
  <AccordionTrigger>Ch {chapter_number}: {title}</AccordionTrigger>
  <AccordionContent>
    <ul>
      {topics.map(t => (
        <button onClick={() => setSelectedTopic({ ...t, chapter_id })}>
          <Circle /> <span>{t.title}</span>
          {duration > 0 && <span>{duration}m</span>}
        </button>
      ))}
    </ul>
  </AccordionContent>
</AccordionItem>
```
Active topic gets `bg-primary text-primary-foreground`.
Duration source: `lectureDurations?.[t.id] || t.estimated_duration_minutes || 0`.

**Locked chapter** (NOT in `unlockedChapterIds`):
```tsx
<button onClick={() => setLockOpen(true)} className="opacity-60">
  Ch {chapter_number}: {title}  <Lock />
</button>
```
Does **NOT** expand. Tap opens `PurchaseRequiredDialog`.

### 3.5 Content panel (right side)

- Before topic selected → empty state with `Sparkles` icon and:
  > "Pick a topic to start your free preview. Locked chapters require purchasing the course."
- After topic selected → 8 tabs (see §4).

Tabs use shadcn `Tabs` with classes:
```
TabsList: "p-1.5 h-auto bg-muted/80 rounded-xl border shadow-sm grid w-full grid-cols-4 lg:grid-cols-8"
TabsTrigger: "py-2 rounded-lg font-medium text-sm"
```
On mobile, drop the 8-column grid and use a **horizontal scrollable row** of pill triggers.

---

## 4. Tabs — components, props, behavior

> Every tab below receives `selectedTopic` and `selectedSubjectId`. The first 6 tabs are read-only data viewers. Two tabs (AI, Doubts) operate in **preview mode** with quota enforcement.

### 4.1 Classes — `RecordedVideos`
File: `src/components/learning/RecordedVideos.tsx`

```tsx
<RecordedVideos
  topicId={selectedTopic.id}
  chapterId={selectedTopic.chapter_id}
  subjectId={selectedSubjectId}
  topicVideoId={selectedTopic.video_id}
  topicVideoPlatform={selectedTopic.video_platform}
  topicTitle={selectedTopic.title}
  aiGeneratedVideoUrl={selectedTopic.ai_generated_video_url}
  aiPresentationJson={selectedTopic.ai_presentation_json}
  courseId={course.id}
  availableLanguages={course.available_languages}
  languageTopupPrice={course.language_topup_price}
  languageTopupOriginalPrice={course.language_topup_original_price}
/>
```
Behavior: plays the AI-generated lecture (V3 player) and any uploaded recorded videos for the topic. Language top-up upsell appears if `available_languages` includes locked languages.

### 4.2 AI — `AITeachingAssistant` (preview mode)
File: `src/components/learning/AITeachingAssistant.tsx`

```tsx
<AITeachingAssistant
  key={selectedTopic.id}                  // remount on topic switch
  topicId={selectedTopic.id}
  chapterId={selectedTopic.chapter_id}
  topicTitle={selectedTopic.title}
  subjectName={selectedSubject?.name}
  availableLanguages={course.available_languages}
  aiPresentationJson={selectedTopic.ai_presentation_json}
  aiGeneratedVideoUrl={selectedTopic.ai_generated_video_url}
  isActive
  previewMode
  previewCourseId={course.id}
  previewLimit={previewLimits?.ai ?? 0}
  onPreviewQuotaExceeded={() => setQuotaDialog({ open: true, tab: "AI" })}
/>
```
Behavior:
- Loads the lecture's presentation JSON and answers free-form student questions about it.
- **Quota:** counted in `localStorage` under key `preview:{courseId}:AI`. After each successful question send, increment by 1. When count ≥ `previewLimit`, block further sends and fire `onPreviewQuotaExceeded` → `QuotaExhaustedDialog`.
- `previewLimit === 0` ⇒ feature blocked from the start.

### 4.3 Questions — `QuestionsTab`
File: `src/components/learning/QuestionsTab.tsx`
```tsx
<QuestionsTab topicId={selectedTopic.id} subjectId={selectedSubjectId} />
```
Read-only MCQ + subjective question bank for the topic.

### 4.4 Assignments — `AssignmentViewer`
File: `src/components/learning/AssignmentViewer.tsx`
```tsx
<AssignmentViewer
  topicId={selectedTopic.id}
  chapterId={selectedTopic.chapter_id}
  subjectId={selectedSubjectId}
/>
```
Shows assignment text + attachments. Submission requires login (preview users see read-only).

### 4.5 DPP — `DPPTab`
File: `src/components/learning/DPPTab.tsx`
```tsx
<DPPTab subjectId={selectedSubjectId} topicId={selectedTopic.id} />
```
Daily Practice Problems — dynamic 5-question session.

### 4.6 Results — `PaperTestResults`
File: `src/components/learning/PaperTestResults.tsx`
```tsx
<PaperTestResults
  subjectId={selectedSubjectId}
  subjectName={selectedSubject?.name}
  topicId={selectedTopic.id}
  chapterId={selectedTopic.chapter_id}
/>
```
Past test results for the topic (empty for preview users with no history).

### 4.7 Doubts — `DoubtsTab` (preview mode)
File: `src/components/learning/DoubtsTab.tsx`
```tsx
<DoubtsTab
  subjectId={selectedSubjectId}
  subjectName={selectedSubject?.name}
  previewMode
  previewCourseId={course.id}
  previewLimit={previewLimits?.doubts ?? 0}
  onPreviewQuotaExceeded={() => setQuotaDialog({ open: true, tab: "Doubts" })}
/>
```
Quota key: `preview:{courseId}:Doubts`. Same enforcement pattern as the AI tab.

### 4.8 PYQ's — `PYQsStudentTab`
File: `src/components/learning/PYQsStudentTab.tsx`
```tsx
<PYQsStudentTab subjectId={selectedSubjectId} />
```
Previous-year papers' questions for the subject.

---

## 5. Dialogs

### 5.1 `PurchaseRequiredDialog`
File: `src/components/course/PurchaseRequiredDialog.tsx`
```tsx
<PurchaseRequiredDialog
  open={lockOpen}
  onOpenChange={setLockOpen}
  courseSlug={course.slug}
/>
```
- Triggered by tapping a **locked chapter**.
- Primary CTA navigates to `/course/{slug}` to start checkout.

### 5.2 `QuotaExhaustedDialog`
File: `src/components/course/QuotaExhaustedDialog.tsx`
```tsx
<QuotaExhaustedDialog
  open={quotaDialog.open}
  onOpenChange={(o) => setQuotaDialog(p => ({ ...p, open: o }))}
  courseSlug={course.slug}
  tab={quotaDialog.tab}   // "AI" | "Doubts"
/>
```
- Triggered when AI or Doubts preview quota is exhausted.
- Message references the specific tab.
- Primary CTA → `/course/{slug}`.

On mobile, both dialogs should be rendered as **native bottom sheets** for better ergonomics.

---

## 6. Supabase API contracts

All requests use the public anon key. No service-role logic needed for this screen.

### 6.1 Course meta + subjects (`usePreviewCourse`)
```
GET /rest/v1/courses
  ?select=id,name,slug,available_languages,language_topup_price,language_topup_original_price
  &slug=eq.{slug}
  &is_active=eq.true
  → .maybeSingle()
```
Then:
```
GET /rest/v1/course_subjects
  ?select=display_order,subject:popular_subjects(id,name,slug)
  &course_id=eq.{course.id}
  &order=display_order.asc
```
Map → `subjects: [{ id, name, slug, display_order }]`.

### 6.2 Free-access chapters (`useCourseFreeAccess`)
```
GET /rest/v1/course_free_access_chapters
  ?select=id,course_id,subject_id,chapter_id
  &course_id=eq.{course.id}
```
Build `unlockedChapterIds: Set<string>` from `chapter_id` values.

### 6.3 Preview quotas (`useCourseFreePreviewLimits`)
```
GET /rest/v1/courses
  ?select=free_preview_ai_limit,free_preview_doubts_limit
  &id=eq.{course.id}
  → .maybeSingle()
```
Return `{ ai: row.free_preview_ai_limit ?? 0, doubts: row.free_preview_doubts_limit ?? 0 }`.

### 6.4 Chapters + topics for the selected subject
The web uses `useSubjectChapters(subjectId)` which calls the RPC:
```
POST /rest/v1/rpc/get_subject_chapters_with_topics
  body: { p_subject_id: "<subject uuid>" }
```
Returns rows of:
```ts
{
  chapter_id: uuid,
  chapter_number: number,
  title: string,
  description: string | null,
  ai_generated_video_url: string | null,
  topics: Array<{
    id: uuid,
    title: string,
    topic_number: number,
    estimated_duration_minutes: number | null,
    video_id: string | null,
    video_platform: string | null,
    ai_generated_video_url: string | null
  }>
}
```
Map to UI: `chapter.id = chapter_id`. Topics are pre-sorted by `topic_number`.

### 6.5 Topic lecture durations (`useTopicLectureDurations`)
```
POST /rest/v1/rpc/get_topic_lecture_durations
  body: { p_subject_id: "<subject uuid>" }
```
Returns `[{ topic_id, total_duration_minutes }]`. Convert to a map for O(1) lookup.

---

## 7. Quota tracking contract (mobile)

```ts
const KEY = (courseId, tab) => `preview:${courseId}:${tab}`; // tab = "AI" | "Doubts"

function readCount(courseId, tab) {
  return parseInt(localStorage.getItem(KEY(courseId, tab)) ?? "0", 10);
}
function increment(courseId, tab) {
  const next = readCount(courseId, tab) + 1;
  localStorage.setItem(KEY(courseId, tab), String(next));
  return next;
}
function isExhausted(courseId, tab, limit) {
  if (limit <= 0) return true;
  return readCount(courseId, tab) >= limit;
}
```
Rules:
- Increment **only on successful** AI / doubt send.
- If `isExhausted(...)` before send → block UI and open `QuotaExhaustedDialog`.
- Quotas are per-device (localStorage). Resetting the app clears them — acceptable for a preview feature.

---

## 8. Mobile adaptation guidance

| Web behavior | Mobile equivalent |
|---|---|
| 320px sidebar Card with chapters | Bottom sheet / full-screen drawer triggered by sticky "Chapters" button |
| Subject chip horizontal scroll | Same — keep horizontal scroll |
| 8-column tab grid | Horizontal scrollable pill row (no grid) |
| Shadcn `Dialog` modals | Native bottom sheets |
| `useIsMobile()` defaulting sidebar closed | Always-closed; user must open the drawer |
| `Sparkles`/`Lock`/`BookOpen` etc. lucide icons | Reuse `lucide-react-native` (same icon names) |
| Tailwind theme tokens (`primary`, `muted`, `card`) | Mirror with platform theme tokens to keep contrast in light/dark mode |

Keep the Supabase URL and anon key identical to the web app so the mobile shares the same backend.

---

## 9. Edge cases checklist

- [ ] **No free chapters configured** → show "Preview not available yet" card; do not render sidebar/tabs.
- [ ] **Locked chapter tap** → only opens `PurchaseRequiredDialog`; never expands.
- [ ] **Quota = 0** → AI / Doubts blocked from the first attempt.
- [ ] **Course `is_active=false` or wrong slug** → "Course not found" card.
- [ ] **Subject change** → reset `selectedTopic` to `null` so the empty state re-appears.
- [ ] **Topic with no AI lecture (`ai_generated_video_url` null)** → Classes tab still works; it shows the uploaded recording if any.
- [ ] **Network failure** → React Query retries with `retry: 2` on the three preview hooks. Mobile should mirror this.
- [ ] **Multiple tabs in browser/app** → quota localStorage is shared on web; mobile equivalent uses app-scoped storage.

---

## 10. File / component map

### Page
- `src/pages/CoursePreview.tsx`

### Hooks
- `src/hooks/useCourseFreeAccess.ts` → `useCourseFreeAccess`, `useCourseFreePreviewLimits` (+ admin `useSaveCourseFreeAccess` — not needed in mobile)
- `src/hooks/useLearningCourse.ts` → `useSubjectChapters`
- `src/hooks/useTopicLectureDurations.ts`
- `src/hooks/use-mobile.tsx` → `useIsMobile`

### Dialogs
- `src/components/course/PurchaseRequiredDialog.tsx`
- `src/components/course/QuotaExhaustedDialog.tsx`

### Tab components
- `src/components/learning/RecordedVideos.tsx`
- `src/components/learning/AITeachingAssistant.tsx`
- `src/components/learning/QuestionsTab.tsx`
- `src/components/learning/AssignmentViewer.tsx`
- `src/components/learning/DPPTab.tsx`
- `src/components/learning/PaperTestResults.tsx`
- `src/components/learning/DoubtsTab.tsx`
- `src/components/learning/PYQsStudentTab.tsx`

### Shared UI primitives (shadcn)
- `Accordion`, `Card`, `Button`, `Badge`, `Skeleton`, `Tabs`, `Dialog`
- Lucide icons: `ArrowLeft`, `BookOpen`, `Circle`, `Lock`, `FolderOpen`, `Sparkles`, `PanelLeftClose`, `PanelLeftOpen`

### Database tables touched (read-only for this screen)
- `courses` (incl. `free_preview_ai_limit`, `free_preview_doubts_limit`)
- `course_subjects` + `popular_subjects`
- `course_free_access_chapters`
- `subject_chapters` + `subject_topics` (via RPC)
- `video_generation_jobs` + `ai_assistant_documents` (via durations RPC)

---

## 11. Quick build checklist for Replit

1. Add screen route: `CoursePreviewScreen` taking `slug`.
2. Fetch course meta + subjects, free-access rows, quotas in parallel.
3. Render top bar (Back / name / Free Preview badge / Buy CTA).
4. Render horizontal subject chips.
5. Render "Chapters" trigger → drawer/sheet with the accordion logic (locked vs unlocked).
6. On topic select, close the sheet and render the 8 tabs (horizontal pill row).
7. Wire the 6 read-only tabs to their data hooks.
8. Implement AI + Doubts tabs with the localStorage quota contract.
9. Add `PurchaseRequiredDialog` (locked tap) and `QuotaExhaustedDialog` (quota hit) as bottom sheets.
10. QA against every edge case in §9.
