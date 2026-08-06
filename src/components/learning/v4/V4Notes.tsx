import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  GripHorizontal,
  LoaderCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import './v4-notes.css';

interface V4NotesProps {
  notesId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  /**
   * When provided together with `onOpenChange`, the panel becomes controlled —
   * `open` decides visibility and the internal toggle button is hidden so an
   * external trigger (e.g. a "My Notes" button on a lecture card) owns the
   * open/close lifecycle.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onVisibilityChange?: (open: boolean) => void;
}

interface DragState {
  pointerX: number;
  pointerY: number;
  panelX: number;
  panelY: number;
}

type SaveStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error';

const getStorageKey = (notesId: string, userId?: string) =>
  `simplelecture:v4-notes:${userId || 'guest'}:${notesId}`;

const matchesContext = (
  row: Record<string, unknown>,
  notesId: string,
  subjectId?: string,
  chapterId?: string,
  topicId?: string,
) =>
  row.job_id === notesId &&
  (row.subject_id || null) === (subjectId || null) &&
  (row.chapter_id || null) === (chapterId || null) &&
  (row.topic_id || null) === (topicId || null);

export function V4Notes({
  notesId,
  subjectId,
  chapterId,
  topicId,
  open,
  onOpenChange,
  onVisibilityChange,
}: V4NotesProps) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestNotesRef = useRef('');
  const hasLocalChangesRef = useRef(false);
  const persistNoteRef = useRef<(content: string) => Promise<void>>(async () => {});
  const [internalOpen, setInternalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('local');
  const [position, setPosition] = useState(() => ({
    x: Math.max(16, window.innerWidth - 430),
    y: 68,
  }));

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  useEffect(() => {
    onVisibilityChange?.(isOpen);
  }, [isOpen, onVisibilityChange]);

  const storageKey = getStorageKey(notesId, user?.id);

  const persistNote = async (content: string) => {
    if (!user) {
      setSaveStatus('local');
      return;
    }

    setSaveStatus('saving');
    const { error } = await supabase
      .from('student_lecture_notes')
      .upsert(
        {
          student_id: user.id,
          job_id: notesId,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          topic_id: topicId || null,
          content,
        },
        {
          onConflict: 'student_id,job_id,subject_id,chapter_id,topic_id',
        },
      );

    if (error) {
      console.error('[V4Notes] autosave failed', error);
      setSaveStatus('error');
      return;
    }

    hasLocalChangesRef.current = false;
    setSaveStatus('saved');
  };
  persistNoteRef.current = persistNote;

  const scheduleSave = (content: string) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus(user ? 'saving' : 'local');
    saveTimerRef.current = window.setTimeout(() => {
      persistNote(content);
    }, 450);
  };

  const updateNotes = (value: string) => {
    setNotes(value);
    latestNotesRef.current = value;
    hasLocalChangesRef.current = true;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
    scheduleSave(value);
  };

  useEffect(() => {
    let cancelled = false;
    hasLocalChangesRef.current = false;
    setSaveStatus(user ? 'loading' : 'local');

    let cached = '';
    try {
      cached =
        localStorage.getItem(storageKey) ||
        localStorage.getItem(`simplelecture:v4-notes:${notesId}`) ||
        '';
    } catch {
      cached = '';
    }
    setNotes(cached);
    latestNotesRef.current = cached;

    if (!user) return;

    const loadRemoteNote = async () => {
      let query = supabase
        .from('student_lecture_notes')
        .select('content, updated_at')
        .eq('student_id', user.id)
        .eq('job_id', notesId);

      query = subjectId ? query.eq('subject_id', subjectId) : query.is('subject_id', null);
      query = chapterId ? query.eq('chapter_id', chapterId) : query.is('chapter_id', null);
      query = topicId ? query.eq('topic_id', topicId) : query.is('topic_id', null);

      const { data, error } = await query.maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[V4Notes] load failed', error);
        setSaveStatus('error');
        return;
      }

      if (data && !hasLocalChangesRef.current) {
        setNotes(data.content);
        latestNotesRef.current = data.content;
        try {
          localStorage.setItem(storageKey, data.content);
        } catch {
          // The database copy remains available when local storage is blocked.
        }
      } else if (!data && cached) {
        await persistNote(cached);
        return;
      }
      setSaveStatus('saved');
    };

    loadRemoteNote();

    const channel = supabase
      .channel(`student-lecture-note-${user.id}-${notesId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_lecture_notes',
          filter: `student_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload.new || {}) as Record<string, unknown>;
          if (
            !hasLocalChangesRef.current &&
            matchesContext(row, notesId, subjectId, chapterId, topicId)
          ) {
            const content = String(row.content || '');
            setNotes(content);
            latestNotesRef.current = content;
            try {
              localStorage.setItem(storageKey, content);
            } catch {
              // Realtime sync still works without local storage.
            }
            setSaveStatus('saved');
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, notesId, subjectId, chapterId, topicId, storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (hasLocalChangesRef.current) {
        void persistNoteRef.current(latestNotesRef.current);
      }
    },
    [],
  );

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const panelWidth = panelRef.current?.offsetWidth || 390;
    const panelHeight = panelRef.current?.offsetHeight || 470;
    const nextX = drag.panelX + event.clientX - drag.pointerX;
    const nextY = drag.panelY + event.clientY - drag.pointerY;

    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - panelWidth - 8, nextX)),
      y: Math.max(54, Math.min(window.innerHeight - panelHeight - 8, nextY)),
    });
  };

  const saveLabel = {
    local: 'Saved on this device',
    loading: 'Loading saved notes...',
    saving: 'Saving to your account...',
    saved: 'Saved to your account',
    error: 'Saved locally - cloud sync will retry',
  }[saveStatus];

  return (
    <>
      {!isControlled && (
        <button
          aria-expanded={isOpen}
          className={`v4-notes-button${isOpen ? ' is-active' : ''}`}
          onClick={() => setIsOpen((open) => !open)}
          title="Open lecture notes"
          type="button"
        >
          <BookOpen size={15} />
          <span>Notes</span>
        </button>
      )}

      {isOpen && (
        <aside
          aria-label="Lecture notes"
          aria-modal="false"
          className="v4-notes"
          ref={panelRef}
          role="dialog"
          style={{ left: position.x, top: position.y }}
        >
          <div
            className="v4-notes__handle"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerX: event.clientX,
                pointerY: event.clientY,
                panelX: position.x,
                panelY: position.y,
              };
            }}
            onPointerMove={handlePointerMove}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            onPointerUp={(event) => {
              dragRef.current = null;
              event.currentTarget.releasePointerCapture?.(event.pointerId);
            }}
          >
            <GripHorizontal size={18} />
            <div>
              <strong>Lecture notes</strong>
              <span>Drag to move</span>
            </div>
            <button
              aria-label="Close notes"
              onClick={() => setIsOpen(false)}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              <X size={17} />
            </button>
          </div>

          <div className="v4-notes__paper">
            <textarea
              aria-label="Write your lecture notes"
              autoCapitalize="sentences"
              autoCorrect="on"
              onChange={(event) => updateNotes(event.target.value)}
              placeholder="Write your notes here..."
              ref={textareaRef}
              spellCheck
              value={notes}
            />
          </div>

          <footer className="v4-notes__footer">
            <span className={`v4-notes__save-status is-${saveStatus}`}>
              {saveStatus === 'saving' && <LoaderCircle className="is-spinning" size={12} />}
              {saveStatus === 'saved' && <Check size={12} />}
              {saveLabel}
            </span>
            {notes && (
              <button onClick={() => updateNotes('')} title="Clear notes" type="button">
                <Trash2 size={14} />
                Clear
              </button>
            )}
          </footer>
        </aside>
      )}
    </>
  );
}
