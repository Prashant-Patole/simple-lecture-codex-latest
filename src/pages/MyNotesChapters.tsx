import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, ChevronLeft, ChevronRight, GripHorizontal,
  Loader2, LoaderCircle, Check, Trash2, FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubjectChapters } from '@/hooks/useSubjectNotes';
import { useCourseSubjects } from '@/hooks/useCourseSubjects';
import { useEnrolledCoursesWithCategories } from '@/hooks/useEnrolledCoursesWithCategories';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNav } from '@/components/mobile/BottomNav';

const SEO_TITLE = "My Notes | SimpleLecture";

// Load notebook fonts once
const getAggregatedJobId = (subjectId: string, chapterId: string) =>
  `notebook-${subjectId}-${chapterId}`;

const getStorageKey = (subjectId: string, chapterId: string, userId: string) =>
  `simplelecture:my-notes:${userId}:${subjectId}:${chapterId}`;

type SaveStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error';

const MyNotesChapters = () => {
  const { courseId, subjectId } = useParams<{ courseId: string; subjectId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestNotesRef = useRef('');
  const hasLocalChangesRef = useRef(false);
  const persistNoteRef = useRef<(content: string) => Promise<void>>(async () => {});

  const { data: enrolledCourses } = useEnrolledCoursesWithCategories();
  const { data: subjects, isLoading: subjectsLoading } = useCourseSubjects(courseId);
  const { data: chapters, isLoading: chaptersLoading } = useSubjectChapters(subjectId);

  const course = useMemo(
    () => enrolledCourses?.find(c => c.id === courseId),
    [enrolledCourses, courseId]
  );

  const currentSubject = useMemo(() => {
    if (!subjects) return null;
    const idx = subjects.findIndex((s: any) => (s.subject?.id || s.subject_id) === subjectId);
    if (idx >= 0) {
      const s = subjects[idx];
      return {
        name: s.subject?.name || 'Unknown',
        thumbnail: s.subject?.thumbnail_url,
        displayOrder: s.display_order ?? idx,
      };
    }
    return null;
  }, [subjects, subjectId]);

  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  useEffect(() => {
    if (chapters && chapters.length > 0) {
      setActiveChapterIndex(0);
    }
  }, [subjectId, chapters]);

  const storageKey = useMemo(
    () => user ? getStorageKey(subjectId || '', chapters?.[activeChapterIndex]?.id || '', user.id) : '',
    [user, subjectId, chapters, activeChapterIndex]
  );

  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('local');

  const activeChapter = chapters?.[activeChapterIndex];

  const persistNote = useCallback(async (content: string) => {
    if (!user || !subjectId || !activeChapter) {
      setSaveStatus('local');
      return;
    }

    setSaveStatus('saving');
    const syntheticJobId = getAggregatedJobId(subjectId, activeChapter.id);

    const { error } = await supabase
      .from('student_lecture_notes')
      .upsert(
        {
          student_id: user.id,
          job_id: syntheticJobId,
          subject_id: subjectId,
          chapter_id: activeChapter.id,
          topic_id: null,
          content,
        },
        {
          onConflict: 'student_id,job_id,subject_id,chapter_id,topic_id',
        }
      );

    if (error) {
      console.error('[MyNotesChapters] autosave failed', error);
      setSaveStatus('error');
      return;
    }

    hasLocalChangesRef.current = false;
    setSaveStatus('saved');
  }, [user, subjectId, activeChapter]);

  persistNoteRef.current = persistNote;

  const scheduleSave = useCallback((content: string) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus(user ? 'saving' : 'local');
    saveTimerRef.current = window.setTimeout(() => {
      persistNote(content);
    }, 450);
  }, [user, persistNote]);

  const updateNotes = useCallback((value: string) => {
    setNotes(value);
    latestNotesRef.current = value;
    hasLocalChangesRef.current = true;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // ignore
    }
    scheduleSave(value);
  }, [storageKey, scheduleSave]);

  // Load notes when chapter changes
  useEffect(() => {
    if (!activeChapter) return;

    let cancelled = false;
    hasLocalChangesRef.current = false;
    setSaveStatus(user ? 'loading' : 'local');

    let cached = '';
    try {
      cached = localStorage.getItem(storageKey) || '';
    } catch {
      cached = '';
    }

    const loadNote = async () => {
      if (!user || !subjectId) return;

      const syntheticJobId = getAggregatedJobId(subjectId, activeChapter.id);

      // Try loading the aggregated note first
      const { data: aggNote } = await supabase
        .from('student_lecture_notes')
        .select('content, updated_at')
        .eq('student_id', user.id)
        .eq('job_id', syntheticJobId)
        .eq('subject_id', subjectId)
        .eq('chapter_id', activeChapter.id)
        .maybeSingle();

      if (cancelled) return;

      if (aggNote?.content) {
        setNotes(aggNote.content);
        latestNotesRef.current = aggNote.content;
        try {
          localStorage.setItem(storageKey, aggNote.content);
        } catch {
          // ignore
        }
        setSaveStatus('saved');
        return;
      }

      // No aggregated note — build from individual topic notes
      const { data: topicNotes } = await supabase
        .from('student_lecture_notes')
        .select('content, topic_id, updated_at')
        .eq('student_id', user.id)
        .eq('subject_id', subjectId)
        .eq('chapter_id', activeChapter.id)
        .not('topic_id', 'is', null)
        .order('updated_at', { ascending: false });

      if (cancelled) return;

      if (topicNotes && topicNotes.length > 0) {
        const topicIds = topicNotes.map(n => n.topic_id).filter((id): id is string => !!id);
        const { data: topics } = topicIds.length > 0
          ? await supabase.from('subject_topics').select('id, title').in('id', topicIds)
          : { data: [] as any[] };

        const topicMap = new Map<string, string>();
        (topics || []).forEach(t => topicMap.set(t.id, t.title));

        const aggregated = topicNotes.map(n => {
          const topicTitle = topicMap.get(n.topic_id || '') || 'Notes';
          return `--- ${topicTitle} ---\n${n.content}`;
        }).join('\n\n');

        setNotes(aggregated);
        latestNotesRef.current = aggregated;
        try {
          localStorage.setItem(storageKey, aggregated);
        } catch {
          // ignore
        }
        setSaveStatus('saved');

        // Save as aggregated note for next time
        void persistNote(aggregated);
        return;
      }

      setNotes(cached);
      latestNotesRef.current = cached;
      setSaveStatus(cached ? 'saved' : 'local');
    };

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [activeChapter?.id, subjectId, user, storageKey, persistNote]);

  // Unmount flush
  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (hasLocalChangesRef.current) {
      void persistNoteRef.current(latestNotesRef.current);
    }
  }, []);

  // Load fonts
  useEffect(() => {
    const id = 'my-notes-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=JetBrains+Mono:wght@400;600&family=Sora:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  const saveLabel = {
    local: 'Saved on this device',
    loading: 'Loading saved notes...',
    saving: 'Saving to your account...',
    saved: 'Saved to your account',
    error: 'Saved locally - cloud sync will retry',
  }[saveStatus];

  const goToChapter = (index: number) => {
    if (index >= 0 && index < (chapters?.length ?? 0)) {
      setActiveChapterIndex(index);
      setNotes('');
      latestNotesRef.current = '';
    }
  };

  const isNotebookReady = !subjectsLoading && !chaptersLoading && activeChapter;

  const notebookPaperStyle = useMemo(() => ({
    background: `
      linear-gradient(90deg, transparent 29px, rgba(201, 77, 72, 0.28) 30px, transparent 31px),
      repeating-linear-gradient(180deg, #fbf4dc 0, #fbf4dc 29px, rgba(84, 126, 157, 0.22) 30px)
    `,
  }), []);

  // MOBILE VIEW
  if (isMobile) {
    return (
      <>
        <SEOHead title={`${currentSubject?.name || 'Notes'} | My Notes | SimpleLecture`} description={SEO_TITLE} />
        <div className="min-h-screen bg-muted/30 pb-24">
          <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-5 pt-12 pb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(`/my-notes/${courseId}`)} className="flex-shrink-0" aria-label="Go back">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold truncate">{currentSubject?.name || 'My Notes'}</h1>
                <p className="text-primary-foreground/70 text-xs mt-0.5">{course?.name || ''}</p>
              </div>
            </div>

            {chapters && chapters.length > 0 && (
              <ScrollArea className="w-full mt-3">
                <div className="flex gap-2 w-max pb-1">
                  {chapters.map((ch, idx) => (
                    <button
                      key={ch.id}
                      onClick={() => goToChapter(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        idx === activeChapterIndex
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {ch.chapter_number}. {ch.title}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {!isNotebookReady ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-[50vh] w-full rounded-xl" />
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">
                  Ch {activeChapter.chapter_number}: {activeChapter.title}
                </h2>
                <div className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                  saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
                  saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
                  saveStatus === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {saveStatus === 'saving' && <LoaderCircle className="h-3 w-3 inline animate-spin mr-1" />}
                  {saveStatus === 'saved' && <Check className="h-3 w-3 inline mr-1" />}
                  {saveLabel}
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden shadow-lg" style={{ background: '#f8efcf' }}>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: 'linear-gradient(180deg, #efe1b2, #e7d49b)' }}>
                  <FileText className="h-4 w-4 text-amber-700" />
                  <div className="flex-1 min-w-0">
                    <strong className="text-sm text-amber-900">Chapter {activeChapter.chapter_number}</strong>
                    <p className="text-[10px] text-amber-700/60 truncate">{activeChapter.title}</p>
                  </div>
                </div>

                <div className="p-3 pt-2 pb-2" style={{ ...notebookPaperStyle, minHeight: '45vh' }}>
                  <textarea
                    ref={textareaRef}
                    value={notes}
                    onChange={(e) => updateNotes(e.target.value)}
                    placeholder="Write your notes here..."
                    className="w-full h-full min-h-[40vh] resize-none border-0 outline-0 bg-transparent text-[#293743]"
                    style={{ fontFamily: "'Caveat', cursive", fontSize: '18px', lineHeight: '28px', caretColor: '#a3413c' }}
                  />
                </div>

                <div className="flex items-center justify-between px-3 py-2 border-t text-[10px]" style={{ background: '#efe1b2', color: 'rgba(61,45,31,0.58)', fontFamily: "'JetBrains Mono', monospace" }}>
                  <span className={`flex items-center gap-1 ${saveStatus === 'saved' ? 'text-green-700' : saveStatus === 'error' ? 'text-red-700' : ''}`}>
                    {saveLabel}
                  </span>
                  {notes && (
                    <button onClick={() => updateNotes('')} className="flex items-center gap-1 text-[#91453f] font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" disabled={activeChapterIndex === 0} onClick={() => goToChapter(activeChapterIndex - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">{activeChapterIndex + 1} / {chapters.length}</span>
                <Button variant="outline" size="sm" disabled={activeChapterIndex === chapters.length - 1} onClick={() => goToChapter(activeChapterIndex + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <BottomNav />
      </>
    );
  }

  // DESKTOP VIEW
  return (
    <>
      <SEOHead title={`${currentSubject?.name || 'Notes'} | My Notes | SimpleLecture`} description={SEO_TITLE} />
      <DashboardHeader />

      <div className="min-h-[calc(100vh-64px)] flex">
        {!isNotebookReady ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Left sidebar - Chapter Index */}
            <aside className="w-64 border-r bg-card/50 flex-shrink-0 hidden md:flex flex-col">
              <div className="p-4 border-b">
                <button onClick={() => navigate(`/my-notes/${courseId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                  Back to subjects
                </button>
                <h2 className="font-bold text-lg leading-tight">{currentSubject?.name}</h2>
                <p className="text-xs text-muted-foreground truncate">{course?.name}</p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2">
                    Table of Contents
                  </p>
                  {chapters?.map((ch, idx) => (
                    <button
                      key={ch.id}
                      onClick={() => goToChapter(idx)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-colors flex items-start gap-2.5 ${
                        idx === activeChapterIndex
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className={`text-xs font-mono mt-0.5 w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                        idx === activeChapterIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {ch.chapter_number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight line-clamp-2">{ch.title}</p>
                      </div>
                      {idx === activeChapterIndex && (
                        <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </aside>

            {/* Main notebook area */}
            <main className="flex-1 flex flex-col min-w-0 bg-muted/20">
              {!isNotebookReady ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Notebook header bar */}
                  <div className="flex items-center justify-between px-6 py-3 border-b bg-background/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="md:hidden">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/my-notes/${courseId}`)}>
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                      </div>
                      <div>
                        <h2 className="font-semibold text-sm">
                          Chapter {activeChapter.chapter_number}: {activeChapter.title}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {currentSubject?.name} · {course?.name}
                        </p>
                      </div>
                    </div>
                    <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
                      saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
                      saveStatus === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {saveStatus === 'saving' && <LoaderCircle className="h-3 w-3 inline animate-spin mr-1" />}
                      {saveStatus === 'saved' && <Check className="h-3 w-3 inline mr-1" />}
                      {saveLabel}
                    </div>
                  </div>

                  {/* Notebook body */}
                  <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center">
                    <div className="w-full max-w-3xl rounded-xl border overflow-hidden shadow-xl" style={{ background: '#f8efcf' }}>
                      {/* Handle bar */}
                      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ background: 'linear-gradient(180deg, #efe1b2, #e7d49b)' }}>
                        <GripHorizontal className="h-4 w-4 text-amber-700/50" />
                        <div className="flex-1 min-w-0">
                          <strong className="text-sm text-amber-900" style={{ fontFamily: "'Sora', sans-serif" }}>
                            {currentSubject?.name} — Chapter {activeChapter.chapter_number}
                          </strong>
                          <p className="text-[10px] text-amber-700/60 truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {activeChapter.title}
                          </p>
                        </div>
                      </div>

                      {/* Paper with lined background */}
                      <div className="p-6 pt-5 pb-5" style={{ ...notebookPaperStyle, minHeight: '60vh' }}>
                        <textarea
                          ref={textareaRef}
                          value={notes}
                          onChange={(e) => updateNotes(e.target.value)}
                          placeholder="Write your notes here..."
                          className="w-full h-full min-h-[55vh] resize-none border-0 outline-0 bg-transparent"
                          style={{
                            fontFamily: "'Caveat', cursive",
                            fontSize: '22px',
                            lineHeight: '30px',
                            color: '#293743',
                            caretColor: '#a3413c',
                          }}
                        />
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between px-5 py-2.5 border-t" style={{ background: '#efe1b2', color: 'rgba(61,45,31,0.58)', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                        <span className={`flex items-center gap-1 ${saveStatus === 'saved' ? 'text-green-700' : saveStatus === 'error' ? 'text-red-700' : ''}`}>
                          {saveLabel}
                        </span>
                        {notes && (
                          <button onClick={() => updateNotes('')} className="flex items-center gap-1.5 text-[#91453f] font-bold hover:text-red-700 transition-colors" style={{ fontFamily: "'Sora', sans-serif", fontSize: '10px' }}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chapter navigation */}
                  <div className="flex items-center justify-center gap-4 px-6 py-4 border-t bg-background/50">
                    <Button variant="outline" size="sm" disabled={activeChapterIndex === 0} onClick={() => goToChapter(activeChapterIndex - 1)} className="gap-1">
                      <ChevronLeft className="h-4 w-4" />
                      Previous Chapter
                    </Button>
                    <span className="text-sm text-muted-foreground font-medium min-w-[80px] text-center">
                      {activeChapterIndex + 1} / {chapters.length}
                    </span>
                    <Button variant="outline" size="sm" disabled={activeChapterIndex === chapters.length - 1} onClick={() => goToChapter(activeChapterIndex + 1)} className="gap-1">
                      Next Chapter
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </main>
          </>
        )}
      </div>

      <Footer />
    </>
  );
};

export default MyNotesChapters;
