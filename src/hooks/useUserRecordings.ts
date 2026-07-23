import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserRecording {
  id: string;
  scheduled_class_id: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  processing_status: string | null;
  available_qualities: string[] | null;
  default_quality: string | null;
  created_at: string | null;
  processed_at: string | null;
  // New columns for topic-based recordings
  course_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  recording_title: string | null;
  recording_type: string | null;
  // Related data for new columns
  course?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  chapter?: { id: string; title: string; chapter_number: number } | null;
  topic?: { id: string; title: string; topic_number: string } | null;
  // Backward compatibility for class-based recordings
  scheduled_class?: {
    id: string;
    scheduled_at: string;
    subject: string | null;
    course_id: string | null;
    course?: { id: string; name: string } | null;
    teacher?: { id: string; full_name: string } | null;
  } | null;
}

export interface UserRecordingFilters {
  courseId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export const useUserRecordings = (filters?: UserRecordingFilters) => {
  return useQuery({
    queryKey: ['user-recordings', filters],
    queryFn: async () => {
      let query = supabase
        .from('class_recordings')
        .select(`
          id,
          scheduled_class_id,
          duration_seconds,
          file_size_bytes,
          processing_status,
          available_qualities,
          default_quality,
          created_at,
          processed_at,
          course_id,
          subject_id,
          chapter_id,
          topic_id,
          recording_title,
          recording_type,
          course:courses!course_id(id, name),
          subject:popular_subjects!subject_id(id, name),
          chapter:subject_chapters!chapter_id(id, title, chapter_number),
          topic:subject_topics!topic_id(id, title, topic_number),
          scheduled_class:scheduled_classes(
            id,
            scheduled_at,
            course_id,
            subject,
            course:courses(id, name),
            teacher:teacher_profiles(id, full_name)
          )
        `)
        .in('processing_status', ['ready', 'uploaded', 'processing'])
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];

      // Filter by course (support both topic-based and class-based)
      if (filters?.courseId) {
        filteredData = filteredData.filter(r => 
          (r as any).course?.id === filters.courseId ||
          (r.scheduled_class as any)?.course?.id === filters.courseId
        );
      }

      // Filter by subject ID
      if (filters?.subjectId) {
        filteredData = filteredData.filter(r => 
          (r as any).subject?.id === filters.subjectId
        );
      }

      // Filter by chapter ID
      if (filters?.chapterId) {
        filteredData = filteredData.filter(r => 
          (r as any).chapter?.id === filters.chapterId
        );
      }

      // Filter by topic ID
      if (filters?.topicId) {
        filteredData = filteredData.filter(r => 
          (r as any).topic?.id === filters.topicId
        );
      }

      // Filter by date range (use created_at for topic recordings)
      if (filters?.dateFrom) {
        filteredData = filteredData.filter(r => {
          const scheduledAt = (r.scheduled_class as any)?.scheduled_at || r.created_at;
          return scheduledAt && new Date(scheduledAt) >= filters.dateFrom!;
        });
      }

      if (filters?.dateTo) {
        filteredData = filteredData.filter(r => {
          const scheduledAt = (r.scheduled_class as any)?.scheduled_at || r.created_at;
          return scheduledAt && new Date(scheduledAt) <= filters.dateTo!;
        });
      }

      // General search (support both types)
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(r => {
          const title = (r as any).recording_title || '';
          const subject = (r as any).subject?.name || (r.scheduled_class as any)?.subject || '';
          const courseName = (r as any).course?.name || (r.scheduled_class as any)?.course?.name || '';
          const teacherName = (r.scheduled_class as any)?.teacher?.full_name || '';
          const topicTitle = (r as any).topic?.title || '';
          const chapterTitle = (r as any).chapter?.title || '';
          return (
            title.toLowerCase().includes(searchLower) ||
            subject.toLowerCase().includes(searchLower) ||
            courseName.toLowerCase().includes(searchLower) ||
            teacherName.toLowerCase().includes(searchLower) ||
            topicTitle.toLowerCase().includes(searchLower) ||
            chapterTitle.toLowerCase().includes(searchLower)
          );
        });
      }

      return filteredData as unknown as UserRecording[];
    },
  });
};

export const useRecordingSubjects = () => {
  return useQuery({
    queryKey: ['recording-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_recordings')
        .select(`
          subject:popular_subjects!subject_id(id, name)
        `)
        .in('processing_status', ['ready', 'uploaded', 'processing']);

      if (error) throw error;

      // Extract unique subjects
      const subjectsMap = new Map<string, { id: string; name: string }>();
      data?.forEach(r => {
        const subject = (r as any).subject;
        if (subject?.id && subject?.name) {
          subjectsMap.set(subject.id, { id: subject.id, name: subject.name });
        }
      });

      return Array.from(subjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
};

export const useRecordingChapters = (subjectId?: string) => {
  return useQuery({
    queryKey: ['recording-chapters', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_recordings')
        .select(`
          chapter:subject_chapters!chapter_id(id, title, chapter_number),
          subject_id
        `)
        .not('chapter_id', 'is', null)
        .in('processing_status', ['ready', 'uploaded', 'processing']);

      if (error) throw error;

      // Extract unique chapters, optionally filtered by subject
      const chaptersMap = new Map<string, { id: string; title: string; chapter_number: number }>();
      data?.forEach(r => {
        const chapter = (r as any).chapter;
        if (chapter?.id && (!subjectId || (r as any).subject_id === subjectId)) {
          chaptersMap.set(chapter.id, chapter);
        }
      });

      return Array.from(chaptersMap.values()).sort((a, b) => a.chapter_number - b.chapter_number);
    },
    enabled: true,
  });
};

export const useRecordingTopics = (chapterId?: string) => {
  return useQuery({
    queryKey: ['recording-topics', chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_recordings')
        .select(`
          topic:subject_topics!topic_id(id, title, topic_number, chapter_id)
        `)
        .not('topic_id', 'is', null)
        .in('processing_status', ['ready', 'uploaded', 'processing']);

      if (error) throw error;

      // Extract unique topics, optionally filtered by chapter
      const topicsMap = new Map<string, { id: string; title: string; topic_number: string; chapter_id: string }>();
      data?.forEach(r => {
        const topic = (r as any).topic;
        if (topic?.id && (!chapterId || topic.chapter_id === chapterId)) {
          topicsMap.set(topic.id, topic);
        }
      });

      return Array.from(topicsMap.values()).sort((a, b) => 
        Number(a.topic_number) - Number(b.topic_number)
      );
    },
    enabled: true,
  });
};

export const useRecordingCourses = () => {
  return useQuery({
    queryKey: ['recording-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_recordings')
        .select(`
          scheduled_class:scheduled_classes(
            course:courses(id, name)
          ),
          course:courses!course_id(id, name)
        `)
        .in('processing_status', ['ready', 'uploaded', 'processing']);

      if (error) throw error;

      // Extract unique courses from both types
      const coursesMap = new Map<string, string>();
      data?.forEach(r => {
        const classCourse = (r.scheduled_class as any)?.course;
        const topicCourse = (r as any).course;
        if (classCourse?.id && classCourse?.name) {
          coursesMap.set(classCourse.id, classCourse.name);
        }
        if (topicCourse?.id && topicCourse?.name) {
          coursesMap.set(topicCourse.id, topicCourse.name);
        }
      });

      return Array.from(coursesMap.entries()).map(([id, name]) => ({ id, name }));
    },
  });
};
