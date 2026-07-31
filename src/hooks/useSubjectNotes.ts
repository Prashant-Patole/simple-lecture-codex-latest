import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SubjectChapter {
  id: string;
  subject_id: string;
  chapter_number: number;
  title: string;
  sequence_order: number | null;
  description: string | null;
}

export interface ChapterNoteGroup {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  notes: {
    job_id: string;
    topic_id: string | null;
    content: string;
    created_at: string;
    updated_at: string;
  }[];
  totalNotes: number;
}

export const useSubjectChapters = (subjectId: string | undefined) => {
  return useQuery({
    queryKey: ['subject-chapters', subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      
      const { data, error } = await supabase
        .from('subject_chapters')
        .select('id, subject_id, chapter_number, title, sequence_order, description')
        .eq('subject_id', subjectId)
        .order('chapter_number', { ascending: true });

      if (error) throw error;
      return data as SubjectChapter[];
    },
    enabled: !!subjectId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useSubjectNotes = (subjectId: string | undefined, studentId: string | undefined) => {
  return useQuery({
    queryKey: ['subject-notes', subjectId, studentId],
    queryFn: async () => {
      if (!subjectId || !studentId) return [];

      // Fetch all notes for this student + subject
      const { data: notes, error } = await supabase
        .from('student_lecture_notes')
        .select('job_id, chapter_id, topic_id, content, created_at, updated_at')
        .eq('student_id', studentId)
        .eq('subject_id', subjectId)
        .not('chapter_id', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (!notes || notes.length === 0) return [];

      // Get unique chapter IDs
      const chapterIds = [...new Set(notes.map(n => n.chapter_id).filter((id): id is string => !!id))];

      // Fetch chapter metadata
      const { data: chapters, error: chaptersError } = await supabase
        .from('subject_chapters')
        .select('id, chapter_number, title')
        .in('id', chapterIds);

      if (chaptersError) throw chaptersError;

      const chapterMap = new Map<string, { chapter_number: number; title: string }>();
      (chapters || []).forEach(ch => {
        chapterMap.set(ch.id, { chapter_number: ch.chapter_number, title: ch.title });
      });

      // Group notes by chapter_id
      const groups = new Map<string, ChapterNoteGroup['notes']>();
      notes.forEach(note => {
        if (!note.chapter_id) return;
        const existing = groups.get(note.chapter_id) || [];
        existing.push({
          job_id: note.job_id,
          topic_id: note.topic_id,
          content: note.content,
          created_at: note.created_at,
          updated_at: note.updated_at,
        });
        groups.set(note.chapter_id, existing);
      });

      // Build result sorted by chapter number
      const result: ChapterNoteGroup[] = [];
      groups.forEach((groupNotes, chapterId) => {
        const meta = chapterMap.get(chapterId);
        if (meta) {
          result.push({
            chapterId,
            chapterNumber: meta.chapter_number,
            chapterTitle: meta.title,
            notes: groupNotes.sort((a, b) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            ),
            totalNotes: groupNotes.length,
          });
        }
      });

      return result.sort((a, b) => a.chapterNumber - b.chapterNumber);
    },
    enabled: !!subjectId && !!studentId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
};
