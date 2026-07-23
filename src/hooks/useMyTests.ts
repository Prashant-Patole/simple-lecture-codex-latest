import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface TestSubmission {
  id: string;
  result_id?: string | null;
  type: 'dpp' | 'paper';
  score: number;
  total_questions: number;
  percentage: number;
  date: string;
  time_taken_seconds: number;
  category?: string;
}


export const useMyTests = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['my-tests'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Fetch DPP submissions
      const { data: dppSubmissions, error: dppError } = await supabase
        .from('dpp_topic_submissions')
        .select('id, score, total_questions, test_date, time_taken_seconds, dpp_type')
        .eq('student_id', user.id)
        .order('test_date', { ascending: false });

      if (dppError) throw dppError;

      // Fetch Paper test results (previous year papers)
      const { data: paperResults, error: paperError } = await supabase
        .from('paper_test_results')
        .select('id, score, total_questions, percentage, paper_category, created_at, time_taken_seconds')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (paperError) throw paperError;

      // Fetch test_results (proficiency, mock, exam tests)
      const { data: testResults, error: testResultsError } = await supabase
        .from('test_results')
        .select('id, score, total_questions, percentage, test_type, submitted_at, time_taken_seconds')
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false });

      if (testResultsError) throw testResultsError;

      // Combine and normalize submissions
      const dppTests: TestSubmission[] = (dppSubmissions || []).map(s => ({
        id: s.id,
        type: 'dpp' as const,
        score: s.score || 0,
        total_questions: s.total_questions || 0,
        percentage: s.total_questions > 0 ? Math.round((s.score / s.total_questions) * 100) : 0,
        date: s.test_date,
        time_taken_seconds: s.time_taken_seconds || 0,
        category: s.dpp_type || 'DPP',
      }));

      const paperTests: TestSubmission[] = (paperResults || []).map(s => ({
        id: s.id,
        type: 'paper' as const,
        score: s.score || 0,
        total_questions: s.total_questions || 0,
        percentage: Math.round(s.percentage || 0),
        date: format(new Date(s.created_at), 'yyyy-MM-dd'),
        time_taken_seconds: s.time_taken_seconds || 0,
        category: s.paper_category || 'Paper',
      }));

      // Map test_results (proficiency, mock, exam, practice) to the same format
      const testsFromTestResults: TestSubmission[] = (testResults || []).map(s => ({
        id: s.id,
        result_id: s.id, // test_results.id — used for the Review page
        type: 'paper' as const, // Treat as paper type for display consistency
        score: s.score || 0,
        total_questions: s.total_questions || 0,
        percentage: Math.round(Number(s.percentage) || 0),
        date: format(new Date(s.submitted_at), 'yyyy-MM-dd'),
        time_taken_seconds: s.time_taken_seconds || 0,
        category: s.test_type || 'Test',
      }));


      const allTests = [...dppTests, ...paperTests, ...testsFromTestResults].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Calculate stats
      const totalTests = allTests.length;
      const averageScore = totalTests > 0
        ? Math.round(allTests.reduce((acc, t) => acc + t.percentage, 0) / totalTests)
        : 0;

      // Calculate by type
      const dppStats = {
        total: dppTests.length,
        avgScore: dppTests.length > 0 
          ? Math.round(dppTests.reduce((acc, t) => acc + t.percentage, 0) / dppTests.length) 
          : 0,
        totalCorrect: dppTests.reduce((acc, t) => acc + t.score, 0),
        totalQuestions: dppTests.reduce((acc, t) => acc + t.total_questions, 0),
      };

      // Combine paper_test_results and test_results for paper stats
      const allPaperTypeTests = [...paperTests, ...testsFromTestResults];
      const paperStats = {
        total: allPaperTypeTests.length,
        avgScore: allPaperTypeTests.length > 0
          ? Math.round(allPaperTypeTests.reduce((acc, t) => acc + t.percentage, 0) / allPaperTypeTests.length)
          : 0,
        totalCorrect: allPaperTypeTests.reduce((acc, t) => acc + t.score, 0),
        totalQuestions: allPaperTypeTests.reduce((acc, t) => acc + t.total_questions, 0),
      };

      return {
        allTests,
        dppTests,
        paperTests: allPaperTypeTests, // Include both paper_test_results and test_results
        totalTests,
        averageScore,
        dppStats,
        paperStats,
      };
    },
  });

  return {
    allTests: data?.allTests || [],
    dppTests: data?.dppTests || [],
    paperTests: data?.paperTests || [],
    totalTests: data?.totalTests || 0,
    averageScore: data?.averageScore || 0,
    dppStats: data?.dppStats || { total: 0, avgScore: 0, totalCorrect: 0, totalQuestions: 0 },
    paperStats: data?.paperStats || { total: 0, avgScore: 0, totalCorrect: 0, totalQuestions: 0 },
    isLoading,
  };
};
