import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAuthUser } from './useCurrentAuthUser';
import { useStudentCourseIds } from './useStudentEnrollments';

export interface ContentProgress {
  lectures: { total: number; watched: number };
  dpp: { total: number; solved: number };
  pyq: { total: number; solved: number };
  proficiency: { total: number; solved: number };
  tests: { total: number; solved: number };
}

export interface SubjectWithDetails {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  chaptersTotal: number;
  chaptersCompleted: number;
  pendingAssignments: number;
  contentProgress: ContentProgress;
  overallPercentage: number;
}

export interface CourseWithSubjects {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  subjects: SubjectWithDetails[];
}

// Helper function to calculate overall percentage from content progress
const calculateOverallProgress = (content: ContentProgress): number => {
  const components: { progress: number; weight: number }[] = [];
  
  if (content.lectures.total > 0) {
    components.push({ 
      progress: (content.lectures.watched / content.lectures.total) * 100,
      weight: 1 
    });
  }
  if (content.dpp.total > 0) {
    components.push({ 
      progress: (content.dpp.solved / content.dpp.total) * 100,
      weight: 1 
    });
  }
  if (content.pyq.total > 0) {
    components.push({ 
      progress: (content.pyq.solved / content.pyq.total) * 100,
      weight: 1 
    });
  }
  if (content.proficiency.total > 0) {
    components.push({ 
      progress: (content.proficiency.solved / content.proficiency.total) * 100,
      weight: 1 
    });
  }
  if (content.tests.total > 0) {
    components.push({ 
      progress: (content.tests.solved / content.tests.total) * 100,
      weight: 1 
    });
  }
  
  if (components.length === 0) return 0;
  
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + (c.progress * c.weight), 0);
  
  return Math.round(weightedSum / totalWeight);
};

export const useDashboardCourseDetails = () => {
  const { data: user } = useCurrentAuthUser();
  const { courseIds, isLoading: enrollmentsLoading } = useStudentCourseIds();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['dashboard-course-details-v4', user?.id, courseIds],
    queryFn: async () => {
      if (!user || courseIds.length === 0) return [];

      // Batch 1: Get all courses
      const { data: courses } = await supabase
        .from('courses')
        .select('id, name, slug, thumbnail_url')
        .in('id', courseIds);

      if (!courses?.length) return [];

      // Batch 2: Get all course subjects at once
      const { data: courseSubjects } = await supabase
        .from('course_subjects')
        .select(`
          course_id,
          subject_id,
          display_order,
          popular_subjects:subject_id (
            id,
            name,
            description,
            thumbnail_url
          )
        `)
        .in('course_id', courseIds)
        .order('display_order');

      const allSubjectIds = [...new Set(courseSubjects?.map(cs => cs.subject_id) || [])];
      
      if (allSubjectIds.length === 0) {
        return courses.map(course => ({
          id: course.id,
          name: course.name,
          slug: course.slug,
          thumbnail_url: course.thumbnail_url,
          subjects: [],
        }));
      }

      // Batch 3: Get all chapters (without ai_presentation_json blob)
      const { data: allChapters } = await supabase
        .from('subject_chapters')
        .select('id, subject_id, video_id, video_platform, ai_generated_video_url')
        .in('subject_id', allSubjectIds);

      // Batch 3b: Get IDs of chapters that have ai_presentation_json (lightweight)
      const { data: chaptersWithPresentation } = await supabase
        .from('subject_chapters')
        .select('id')
        .in('subject_id', allSubjectIds)
        .not('ai_presentation_json', 'is', null);

      const chapterHasPresentation = new Set((chaptersWithPresentation || []).map(c => c.id));

      const chaptersBySubject = new Map<string, string[]>();
      allChapters?.forEach(ch => {
        const existing = chaptersBySubject.get(ch.subject_id) || [];
        existing.push(ch.id);
        chaptersBySubject.set(ch.subject_id, existing);
      });

      // Create a map by ID for quick lookup (to access video fields)
      const chaptersById = new Map(allChapters?.map(c => [c.id, c]) || []);

      const allChapterIds = allChapters?.map(c => c.id) || [];

      // Batch 4: Get all student progress at once
      let completedChaptersSet = new Set<string>();
      if (allChapterIds.length > 0) {
        const { data: progress } = await supabase
          .from('student_progress')
          .select('chapter_id')
          .eq('student_id', user.id)
          .eq('is_completed', true)
          .in('chapter_id', allChapterIds);

        completedChaptersSet = new Set(progress?.map(p => p.chapter_id) || []);
      }

      // Batch 5: Get all assignments at once
      const { data: allAssignments } = await supabase
        .from('assignments')
        .select('id, chapter_id, course_id')
        .in('course_id', courseIds)
        .eq('is_active', true);

      const assignmentIds = allAssignments?.map(a => a.id) || [];

      // Batch 6: Get all submissions at once
      let submittedAssignmentIds = new Set<string>();
      if (assignmentIds.length > 0) {
        const { data: submissions } = await supabase
          .from('assignment_submissions')
          .select('assignment_id')
          .eq('student_id', user.id)
          .in('assignment_id', assignmentIds);

        submittedAssignmentIds = new Set(submissions?.map(s => s.assignment_id) || []);
      }

      // ======== NEW: Content Progress Queries ========

      // Batch 7: Get all topics for subjects (without ai_presentation_json blob)
      const { data: allTopics } = await supabase
        .from('subject_topics')
        .select('id, chapter_id, video_id, video_platform, ai_generated_video_url, video_url')
        .in('chapter_id', allChapterIds);

      // Batch 7b: Get IDs of topics that have ai_presentation_json (lightweight)
      const { data: topicsWithPresentation } = await supabase
        .from('subject_topics')
        .select('id')
        .in('chapter_id', allChapterIds)
        .not('ai_presentation_json', 'is', null);

      const topicHasPresentation = new Set((topicsWithPresentation || []).map(t => t.id));

      // Map topics by chapter for easy lookup
      const topicsByChapter = new Map<string, typeof allTopics>();
      allTopics?.forEach(topic => {
        if (topic.chapter_id) {
          const existing = topicsByChapter.get(topic.chapter_id) || [];
          existing.push(topic);
          topicsByChapter.set(topic.chapter_id, existing);
        }
      });

      const allTopicIds = allTopics?.map(t => t.id) || [];

      // Batch 8: Get additional videos from topic_videos table (only active)
      const { data: topicVideos } = await supabase
        .from('topic_videos')
        .select('id, topic_id')
        .in('topic_id', allTopicIds)
        .eq('is_active', true);

      // Batch 8b: Get published AI lectures from video_generation_jobs
      const { data: publishedAILectures } = await supabase
        .from('video_generation_jobs')
        .select(`
          id,
          ai_assistant_documents!inner(topic_id, chapter_id, subject_id)
        `)
        .eq('is_published', true)
        .eq('status', 'completed');

      // Build lookup maps for published AI lectures by topic/chapter
      const publishedByTopicId = new Map<string, number>();
      const publishedByChapterId = new Map<string, number>();
      publishedAILectures?.forEach((job: any) => {
        const doc = job.ai_assistant_documents;
        if (doc?.topic_id) {
          publishedByTopicId.set(doc.topic_id, (publishedByTopicId.get(doc.topic_id) || 0) + 1);
        } else if (doc?.chapter_id) {
          publishedByChapterId.set(doc.chapter_id, (publishedByChapterId.get(doc.chapter_id) || 0) + 1);
        }
      });

      // Batch 9: Get student's watched videos
      const { data: watchedVideos } = await supabase
        .from('ai_video_watch_logs')
        .select('video_title, subject_id, topic_id, completion_percentage')
        .eq('student_id', user.id)
        .gte('completion_percentage', 80);

      const watchedBySubject = new Map<string, Set<string>>();
      watchedVideos?.forEach(w => {
        if (w.subject_id) {
          if (!watchedBySubject.has(w.subject_id)) {
            watchedBySubject.set(w.subject_id, new Set());
          }
          watchedBySubject.get(w.subject_id)!.add(w.video_title);
        }
      });

      // Batch 10: Get DPP questions count by subject
      const { data: dppQuestions } = await supabase
        .from('dpp_questions')
        .select('id, subject_id, topic_id')
        .in('subject_id', allSubjectIds)
        .eq('is_active', true);

      // Batch 11: Get student's DPP submissions
      const { data: dppSubmissions } = await supabase
        .from('dpp_topic_submissions')
        .select('topic_id')
        .eq('student_id', user.id);

      const solvedDppTopics = new Set(dppSubmissions?.map(s => s.topic_id) || []);

      // Batch 12: Get PYQ and Proficiency papers
      const { data: papers } = await supabase
        .from('subject_previous_year_papers')
        .select('id, subject_id, paper_category')
        .in('subject_id', allSubjectIds);

      // Batch 13: Get student's paper test results
      const paperIds = papers?.map(p => p.id) || [];
      let solvedPaperIds = new Set<string>();
      if (paperIds.length > 0) {
        const { data: paperResults } = await supabase
          .from('paper_test_results')
          .select('paper_id')
          .eq('student_id', user.id)
          .in('paper_id', paperIds);
        
        solvedPaperIds = new Set(paperResults?.map(r => r.paper_id) || []);
      }

      // Batch 14: Get practice tests (excluding DPP)
      const { data: tests } = await supabase
        .from('tests')
        .select('id, subject_id, title')
        .in('subject_id', allSubjectIds)
        .eq('test_type', 'practice')
        .eq('is_active', true);

      // Filter out DPP tests (those with "DPP" in title)
      const nonDppTests = tests?.filter(t => !t.title?.toLowerCase().includes('dpp')) || [];

      // Batch 15: Get student's test results
      const testIds = nonDppTests.map(t => t.id);
      let solvedTestIds = new Set<string>();
      if (testIds.length > 0) {
        const { data: testResults } = await supabase
          .from('test_results')
          .select('test_id')
          .eq('student_id', user.id)
          .in('test_id', testIds);
        
        solvedTestIds = new Set(testResults?.map(r => r.test_id) || []);
      }

      // ======== Process all data in memory ========
      const coursesWithSubjects: CourseWithSubjects[] = courses.map(course => {
        const subjects = (courseSubjects || [])
          .filter(cs => cs.course_id === course.id)
          .map(cs => {
            const subject = Array.isArray(cs.popular_subjects)
              ? cs.popular_subjects[0]
              : cs.popular_subjects;

            if (!subject) return null;

            const subjectChapterIds = chaptersBySubject.get(subject.id) || [];
            const chaptersTotal = subjectChapterIds.length;
            const chaptersCompleted = subjectChapterIds.filter(id => completedChaptersSet.has(id)).length;

            // Count pending assignments for this subject's chapters
            const subjectAssignments = (allAssignments || []).filter(
              a => a.course_id === course.id && a.chapter_id && subjectChapterIds.includes(a.chapter_id)
            );
            const pendingAssignments = subjectAssignments.filter(
              a => !submittedAssignmentIds.has(a.id)
            ).length;

            // Calculate content progress for this subject
            let lecturesTotal = 0;
            const subjectTopicIds: string[] = [];

            // 1. Count chapter-level content (mutually exclusive: jobs OR legacy, not both)
            subjectChapterIds.forEach(chapterId => {
              const chapter = chaptersById.get(chapterId);
              const jobsCount = publishedByChapterId.get(chapterId) || 0;
              
              // AI Lectures: If published jobs exist, count those; otherwise count legacy fields
              if (jobsCount > 0) {
                lecturesTotal += jobsCount;
              } else if (chapter?.ai_generated_video_url || chapterHasPresentation.has(chapterId)) {
                lecturesTotal += 1;
              }
              
              // Regular Video (independent, requires both video_id and video_platform)
              if (chapter?.video_id && chapter?.video_platform) {
                lecturesTotal += 1;
              }
            });

            // 2. Count topic-level content (mutually exclusive: jobs OR legacy)
            subjectChapterIds.forEach(chapterId => {
              const chapterTopics = topicsByChapter.get(chapterId) || [];
              chapterTopics.forEach(topic => {
                subjectTopicIds.push(topic.id);
                const jobsCount = publishedByTopicId.get(topic.id) || 0;
                
                // AI Lectures: If published jobs exist, count those; otherwise count legacy fields
                if (jobsCount > 0) {
                  lecturesTotal += jobsCount;
                } else if (topic.ai_generated_video_url || topicHasPresentation.has(topic.id)) {
                  lecturesTotal += 1;
                }
                
                // Regular Video (independent, requires both video_id and video_platform)
                if (topic.video_id && topic.video_platform) {
                  lecturesTotal += 1;
                }
              });
            });
            
            // 3. Add active topic_videos table entries
            const additionalVideos = topicVideos?.filter(v => subjectTopicIds.includes(v.topic_id)) || [];
            lecturesTotal += additionalVideos.length;

            const watchedSet = watchedBySubject.get(subject.id) || new Set();
            const lecturesWatched = Math.min(watchedSet.size, lecturesTotal);

            // DPP: Count distinct topics with DPP questions
            const subjectDppQuestions = dppQuestions?.filter(q => q.subject_id === subject.id) || [];
            const dppTopicsWithQuestions = new Set(subjectDppQuestions.map(q => q.topic_id).filter(Boolean));
            const dppTotal = dppTopicsWithQuestions.size;
            const dppSolved = [...dppTopicsWithQuestions].filter(topicId => solvedDppTopics.has(topicId!)).length;

            // PYQ: Papers with category 'previous_year'
            const subjectPyq = papers?.filter(p => p.subject_id === subject.id && p.paper_category === 'previous_year') || [];
            const pyqTotal = subjectPyq.length;
            const pyqSolved = subjectPyq.filter(p => solvedPaperIds.has(p.id)).length;

            // Proficiency: Papers with category 'proficiency'
            const subjectProficiency = papers?.filter(p => p.subject_id === subject.id && p.paper_category === 'proficiency') || [];
            const proficiencyTotal = subjectProficiency.length;
            const proficiencySolved = subjectProficiency.filter(p => solvedPaperIds.has(p.id)).length;

            // Tests: Practice tests (excluding DPP)
            const subjectTests = nonDppTests.filter(t => t.subject_id === subject.id);
            const testsTotal = subjectTests.length;
            const testsSolved = subjectTests.filter(t => solvedTestIds.has(t.id)).length;

            const contentProgress: ContentProgress = {
              lectures: { total: lecturesTotal, watched: lecturesWatched },
              dpp: { total: dppTotal, solved: dppSolved },
              pyq: { total: pyqTotal, solved: pyqSolved },
              proficiency: { total: proficiencyTotal, solved: proficiencySolved },
              tests: { total: testsTotal, solved: testsSolved },
            };

            const overallPercentage = calculateOverallProgress(contentProgress);

            return {
              id: subject.id,
              name: subject.name,
              description: subject.description,
              thumbnail_url: subject.thumbnail_url,
              chaptersTotal,
              chaptersCompleted,
              pendingAssignments,
              contentProgress,
              overallPercentage,
            } as SubjectWithDetails;
          })
          .filter(Boolean) as SubjectWithDetails[];

        return {
          id: course.id,
          name: course.name,
          slug: course.slug,
          thumbnail_url: course.thumbnail_url,
          subjects,
        };
      });

      return coursesWithSubjects;
    },
    enabled: !!user && courseIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    data: data || [],
    isLoading: enrollmentsLoading || queryLoading,
  };
};
