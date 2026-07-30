import { useEffect, useRef, useState } from 'react';
import { BookOpen, GripHorizontal, Trash2, X } from 'lucide-react';

interface V4NotesProps {
  notesId: string;
}

interface DragState {
  pointerX: number;
  pointerY: number;
  panelX: number;
  panelY: number;
}

const getStorageKey = (notesId: string) => `simplelecture:v4-notes:${notesId}`;

export function V4Notes({ notesId }: V4NotesProps) {
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [position, setPosition] = useState(() => ({
    x: Math.max(16, window.innerWidth - 430),
    y: 68,
  }));

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(getStorageKey(notesId)) || '');
    } catch {
      setNotes('');
    }
  }, [notesId]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const updateNotes = (value: string) => {
    setNotes(value);
    try {
      localStorage.setItem(getStorageKey(notesId), value);
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  };

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

  return (
    <>
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
              onChange={(event) => updateNotes(event.target.value)}
              placeholder="Write your notes here..."
              ref={textareaRef}
              spellCheck
              value={notes}
            />
          </div>

          <footer className="v4-notes__footer">
            <span>Saved automatically on this device</span>
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
