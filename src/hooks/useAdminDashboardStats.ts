import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminDashboardStats {
  totalCourses: number;
  totalSubjects: number;
  activeEnrollments: number;
  totalUsers: number;
  totalIncome: number;
  totalSales: number;
  todayIncome: number;
  todaySales: number;
  monthIncome: number;
  monthSales: number;
  yearIncome: number;
  yearSales: number;
  totalVisitors: number;
  todayVisitors: number;
  monthVisitors: number;
  yearVisitors: number;
}

export const useAdminDashboardStats = () => {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async (): Promise<AdminDashboardStats> => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      const [
        coursesRes,
        subjectsRes,
        enrollmentsRes,
        usersRes,
        allPaymentsRes,
        todayPaymentsRes,
        monthPaymentsRes,
        yearPaymentsRes,
        allVisitorsRes,
        todayVisitorsRes,
        monthVisitorsRes,
        yearVisitorsRes,
      ] = await Promise.all([
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('popular_subjects').select('*', { count: 'exact', head: true }),
        supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('final_amount').eq('status', 'success'),
        supabase.from('payments').select('final_amount').eq('status', 'success').gte('created_at', todayStart),
        supabase.from('payments').select('final_amount').eq('status', 'success').gte('created_at', monthStart),
        supabase.from('payments').select('final_amount').eq('status', 'success').gte('created_at', yearStart),
        (supabase as any).from('page_visits').select('*', { count: 'exact', head: true }),
        (supabase as any).from('page_visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
        (supabase as any).from('page_visits').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        (supabase as any).from('page_visits').select('*', { count: 'exact', head: true }).gte('created_at', yearStart),
      ]);

      const sumAmounts = (data: any[] | null) =>
        (data || []).reduce((sum, p) => sum + (p.final_amount || 0), 0);

      return {
        totalCourses: coursesRes.count || 0,
        totalSubjects: subjectsRes.count || 0,
        activeEnrollments: enrollmentsRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalIncome: sumAmounts(allPaymentsRes.data),
        totalSales: allPaymentsRes.data?.length || 0,
        todayIncome: sumAmounts(todayPaymentsRes.data),
        todaySales: todayPaymentsRes.data?.length || 0,
        monthIncome: sumAmounts(monthPaymentsRes.data),
        monthSales: monthPaymentsRes.data?.length || 0,
        yearIncome: sumAmounts(yearPaymentsRes.data),
        yearSales: yearPaymentsRes.data?.length || 0,
        totalVisitors: allVisitorsRes.count || 0,
        todayVisitors: todayVisitorsRes.count || 0,
        monthVisitors: monthVisitorsRes.count || 0,
        yearVisitors: yearVisitorsRes.count || 0,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
};
