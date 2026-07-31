import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookMarked,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Loader2,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Trash2,
} from 'lucide-react';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCourseSubjects } from '@/hooks/useCourseSubjects';
import { useEnrolledCoursesWithCategories } from '@/hooks/useEnrolledCoursesWithCategories';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSubjectChapters } from '@/hooks/useSubjectNotes';
import { supabase } from '@/integrations/supabase/client';
import './my-notes/my-notes.css';

const SEO_TITLE = 'My Notes | SimpleLecture';

const getAggregatedJobId = (subjectId: string, chapterId: string) =>
  `notebook-${subjectId}-${chapterId}`;

const getStorageKey = (subjectId: string, chapterId: string, userId: string) =>
  `simplelecture:my-notes:${userId}:${subjectId}:${chapterId}`;

const formatTopicSections = (content: string) =>
  content
    .replace(/^---\s*(.+?)\s*---$/gm, 'Topic: $1')
    .replace(/^(Topic:[^\n]+)\n+(?=\S)/gm, '$1\n\n\n');

type SaveStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error';

const MyNotesChapters = () => {
  const { courseId, subjectId } = useParams<{
    courseId: string;
    subjectId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notebookRef = useRef<HTMLElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestNotesRef = useRef('');
  const hasLocalChangesRef = useRef(false);
  const persistNoteRef = useRef<(content: string) => Promise<void>>(async () => {});

  const { data: enrolledCourses = [] } = useEnrolledCoursesWithCategories();
  const { data: subjects, isLoading: subjectsLoading } = useCourseSubjects(courseId);
  const { data: chapters, isLoading: chaptersLoading } = useSubjectChapters(subjectId);

  const course = useMemo(
    () => enrolledCourses.find((item) => item.id === courseId),
    [enrolledCourses, courseId],
  );

  const currentSubject = useMemo(() => {
    if (!subjects) return null;
    const index = subjects.findIndex(
      (item: any) => (item.subject?.id || item.subject_id) === subjectId,
    );
    if (index < 0) return null;

    const subject = subjects[index];
    return {
      name: subject.subject?.name || 'Unknown',
      thumbnail: subject.subject?.thumbnail_url,
      displayOrder: subject.display_order ?? index,
    };
  }, [subjects, subjectId]);

  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('local');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const activeChapter = chapters?.[activeChapterIndex];

  useEffect(() => {
    if (chapters?.length) setActiveChapterIndex(0);
  }, [subjectId, chapters]);

  const storageKey = useMemo(
    () =>
      user
        ? getStorageKey(
            subjectId || '',
            chapters?.[activeChapterIndex]?.id || '',
            user.id,
          )
        : '',
    [user, subjectId, chapters, activeChapterIndex],
  );

  const persistNote = useCallback(
    async (content: string) => {
      if (!user || !subjectId || !activeChapter) {
        setSaveStatus('local');
        return;
      }

      setSaveStatus('saving');
      const syntheticJobId = getAggregatedJobId(subjectId, activeChapter.id);
      const { error } = await supabase.from('student_lecture_notes').upsert(
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
        },
      );

      if (error) {
        console.error('[MyNotesChapters] autosave failed', error);
        setSaveStatus('error');
        return;
      }

      hasLocalChangesRef.current = false;
      setSaveStatus('saved');
    },
    [user, subjectId, activeChapter],
  );

  persistNoteRef.current = persistNote;

  const scheduleSave = useCallback(
    (content: string) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      setSaveStatus(user ? 'saving' : 'local');
      saveTimerRef.current = window.setTimeout(() => {
        void persistNote(content);
      }, 450);
    },
    [user, persistNote],
  );

  const updateNotes = useCallback(
    (value: string) => {
      setNotes(value);
      latestNotesRef.current = value;
      hasLocalChangesRef.current = true;
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // Local storage is a best-effort fallback.
      }
      scheduleSave(value);
    },
    [storageKey, scheduleSave],
  );

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
      if (!user || !subjectId) {
        setNotes(cached);
        latestNotesRef.current = cached;
        setSaveStatus('local');
        return;
      }

      const syntheticJobId = getAggregatedJobId(subjectId, activeChapter.id);
      const [{ data: aggregateNote }, { data: topicNotes }] = await Promise.all([
        supabase
          .from('student_lecture_notes')
          .select('content, updated_at')
          .eq('student_id', user.id)
          .eq('job_id', syntheticJobId)
          .eq('subject_id', subjectId)
          .eq('chapter_id', activeChapter.id)
          .maybeSingle(),
        supabase
          .from('student_lecture_notes')
          .select('content, topic_id, updated_at')
          .eq('student_id', user.id)
          .eq('subject_id', subjectId)
          .eq('chapter_id', activeChapter.id)
          .not('topic_id', 'is', null)
          .order('updated_at', { ascending: true }),
      ]);

      if (cancelled) return;

      const latestTopicUpdate = Math.max(
        0,
        ...(topicNotes || []).map((note) => new Date(note.updated_at).getTime()),
      );
      const aggregateUpdate = aggregateNote?.updated_at
        ? new Date(aggregateNote.updated_at).getTime()
        : 0;
      const shouldRebuildFromTopics =
        !!topicNotes?.length && (!aggregateNote?.content || latestTopicUpdate > aggregateUpdate);

      if (aggregateNote?.content && !shouldRebuildFromTopics) {
        const normalizedContent = formatTopicSections(aggregateNote.content);
        setNotes(normalizedContent);
        latestNotesRef.current = normalizedContent;
        try {
          localStorage.setItem(storageKey, normalizedContent);
        } catch {
          // Local storage is a best-effort fallback.
        }
        setSaveStatus('saved');
        return;
      }

      if (topicNotes?.length) {
        const topicIds = topicNotes
          .map((note) => note.topic_id)
          .filter((id): id is string => !!id);
        const { data: topics } = topicIds.length
          ? await supabase.from('subject_topics').select('id, title').in('id', topicIds)
          : { data: [] as any[] };

        const topicMap = new Map<string, string>();
        (topics || []).forEach((topic) => topicMap.set(topic.id, topic.title));
        const existingAggregate = formatTopicSections(aggregateNote?.content || '').trim();
        const notesByTopic = new Map<string, string[]>();
        topicNotes.forEach((note) => {
          const noteContent = note.content.trim();
          if (!noteContent || existingAggregate.includes(noteContent)) return;
          const topicId = note.topic_id || 'unassigned';
          const existing = notesByTopic.get(topicId) || [];
          existing.push(noteContent);
          notesByTopic.set(topicId, existing);
        });
        const newTopicSections = Array.from(notesByTopic.entries())
          .map(([topicId, topicContents]) => {
            const topicTitle = topicMap.get(topicId) || 'Lecture notes';
            return `Topic: ${topicTitle}\n\n\n${topicContents.join('\n\n')}`;
          });
        const aggregated = [existingAggregate, ...newTopicSections]
          .filter(Boolean)
          .join('\n\n');

        setNotes(aggregated);
        latestNotesRef.current = aggregated;
        try {
          localStorage.setItem(storageKey, aggregated);
        } catch {
          // Local storage is a best-effort fallback.
        }
        setSaveStatus('saved');
        void persistNote(aggregated);
        return;
      }

      setNotes(cached);
      latestNotesRef.current = cached;
      setSaveStatus(cached ? 'saved' : 'local');
    };

    void loadNote();
    return () => {
      cancelled = true;
    };
  }, [activeChapter?.id, subjectId, user, storageKey, persistNote]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (hasLocalChangesRef.current) {
        void persistNoteRef.current(latestNotesRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === notebookRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const saveLabel = {
    local: 'Saved on this device',
    loading: 'Loading saved notes...',
    saving: 'Saving to your account...',
    saved: 'Saved',
    error: 'Saved locally - cloud sync will retry',
  }[saveStatus];

  const clearNotes = async () => {
    if (!activeChapter || isClearing) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    setIsClearing(true);
    setSaveStatus('saving');

    if (user && subjectId) {
      const { error } = await supabase
        .from('student_lecture_notes')
        .delete()
        .eq('student_id', user.id)
        .eq('subject_id', subjectId)
        .eq('chapter_id', activeChapter.id);

      if (error) {
        console.error('[MyNotesChapters] clear failed', error);
        setSaveStatus('error');
        setIsClearing(false);
        return;
      }
    }

    setNotes('');
    latestNotesRef.current = '';
    hasLocalChangesRef.current = false;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Local storage is a best-effort fallback.
    }

    setSaveStatus(user ? 'saved' : 'local');
    setIsClearing(false);
    void queryClient.invalidateQueries({ queryKey: ['subject-note-counts'] });
    void queryClient.invalidateQueries({ queryKey: ['subject-notes', subjectId, user?.id] });
  };

  const goToChapter = (index: number) => {
    if (index < 0 || index >= (chapters?.length ?? 0)) return;
    setActiveChapterIndex(index);
    setNotes('');
    latestNotesRef.current = '';
  };

  const isNotebookReady =
    !subjectsLoading && !chaptersLoading && !!activeChapter && !!chapters;
  const wordCount = useMemo(
    () => notes.trim().split(/\s+/).filter(Boolean).length,
    [notes],
  );
  const saveStatusClass =
    saveStatus === 'saved'
      ? 'is-saved'
      : saveStatus === 'saving' || saveStatus === 'loading'
        ? 'is-saving'
        : saveStatus === 'error'
          ? 'is-error'
          : '';

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }

    try {
      await notebookRef.current?.requestFullscreen();
    } catch {
      setIsFullscreen(true);
    }
  };

  return (
    <>
      <SEOHead
        title={`${currentSubject?.name || 'Notes'} | My Notes | SimpleLecture`}
        description={SEO_TITLE}
      />
      {!isMobile && <DashboardHeader />}

      <main
        ref={notebookRef}
        className={`notes-app ${isFullscreen ? 'notes-app-fullscreen' : ''}`}
      >
        {!isNotebookReady ? (
          <div className="grid min-h-[70vh] place-items-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                Opening your notebook...
              </p>
            </div>
          </div>
        ) : (
          <div className="notes-workspace">
            <aside className="notes-chapter-rail">
              <div className="notes-rail-head">
                <button
                  className="notes-breadcrumb !mb-0"
                  onClick={() => navigate(`/my-notes/${courseId}`)}
                >
                  <ArrowLeft size={14} />
                  Back to subjects
                </button>
                <h1>{currentSubject?.name}</h1>
                <p>{course?.name}</p>
              </div>
              <div className="notes-rail-label">Chapter index</div>
              <div className="notes-chapter-list">
                {chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    className={`notes-chapter-button ${
                      index === activeChapterIndex ? 'is-active' : ''
                    }`}
                    onClick={() => goToChapter(index)}
                  >
                    <span className="notes-chapter-number">{chapter.chapter_number}</span>
                    <strong>{chapter.title}</strong>
                  </button>
                ))}
              </div>
            </aside>

            <section className="notes-editor-area">
              <div className="notes-editor-topbar">
                <div className="notes-editor-leading">
                  <button
                    className="flex-shrink-0 md:hidden"
                    onClick={() => navigate(`/my-notes/${courseId}`)}
                    aria-label="Back to subjects"
                  >
                    <ArrowLeft size={19} />
                  </button>
                </div>
                <div className="notes-editor-title">
                  <h2>
                    Chapter {activeChapter.chapter_number}: {activeChapter.title}
                  </h2>
                  <p>
                    {currentSubject?.name} / {course?.name}
                  </p>
                </div>
                <div className="notes-editor-actions">
                  <div className={`notes-save-status ${saveStatusClass}`} title={saveLabel}>
                    {saveStatus === 'saving' || saveStatus === 'loading' ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : saveStatus === 'saved' ? (
                      <Check size={14} />
                    ) : (
                      <Cloud size={14} />
                    )}
                    <span>{saveLabel}</span>
                  </div>
                  <button
                    className="notes-fullscreen-button"
                    onClick={() => void toggleFullscreen()}
                    title={isFullscreen ? 'Exit full screen' : 'Open full screen'}
                    aria-label={isFullscreen ? 'Exit full screen' : 'Open full screen'}
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    <span>{isFullscreen ? 'Exit' : 'Full screen'}</span>
                  </button>
                </div>
              </div>

              <div className="notes-mobile-chapters">
                {chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    className={`notes-mobile-chapter ${
                      index === activeChapterIndex ? 'is-active' : ''
                    }`}
                    onClick={() => goToChapter(index)}
                  >
                    {chapter.chapter_number}. {chapter.title}
                  </button>
                ))}
              </div>

              <div className="notes-editor-stage">
                <article className="notes-paper">
                  <header className="notes-paper-head">
                    <div className="notes-paper-icon">
                      <BookMarked size={18} />
                    </div>
                    <div className="min-w-0">
                      <strong>
                        {currentSubject?.name} - Chapter {activeChapter.chapter_number}
                      </strong>
                      <span className="truncate">{activeChapter.title}</span>
                    </div>
                  </header>

                  <div className="notes-paper-body">
                    <textarea
                      ref={textareaRef}
                      value={notes}
                      onChange={(event) => updateNotes(event.target.value)}
                      placeholder="Start writing what you want to remember..."
                      className="notes-paper-textarea"
                      spellCheck
                    />
                  </div>

                  <footer className="notes-paper-foot">
                    <div className="notes-paper-meta">
                      <span>{wordCount} words</span>
                      <span>Autosave is on</span>
                    </div>
                    {notes && (
                      <button
                        className="notes-clear-button"
                        onClick={() => void clearNotes()}
                        disabled={isClearing}
                      >
                        {isClearing ? (
                          <LoaderCircle size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        {isClearing ? 'Clearing...' : 'Clear page'}
                      </button>
                    )}
                  </footer>
                </article>
              </div>

              <nav className="notes-editor-navigation" aria-label="Chapter navigation">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activeChapterIndex === 0}
                  onClick={() => goToChapter(activeChapterIndex - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous chapter
                </Button>
                <span className="notes-page-count">
                  {activeChapterIndex + 1} of {chapters.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activeChapterIndex === chapters.length - 1}
                  onClick={() => goToChapter(activeChapterIndex + 1)}
                >
                  Next chapter
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </nav>
            </section>
          </div>
        )}
      </main>

      {isMobile && <BottomNav />}
    </>
  );
};

export default MyNotesChapters;
