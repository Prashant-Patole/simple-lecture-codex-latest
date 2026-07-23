import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth } from 'date-fns';

interface Last7DaysEntry {
  date: string;
  present: boolean;
}

interface AttendanceStats {
  current_streak: number;
  monthly_attendance_percentage: number;
  days_present_this_month: number;
  total_days_this_month: number;
  last_7_days: Last7DaysEntry[];
}

interface DailyAttendanceResponse {
  success: boolean;
  today: {
    marked: boolean;
    first_login_at: string;
    login_count: number;
  };
  stats: AttendanceStats;
}

interface UseDailyAttendanceReturn {
  percentage: number;
  streak: number;
  last7Days: Last7DaysEntry[];
  daysPresent: number;
  totalDays: number;
  isLoading: boolean;
  isMarked: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useDailyAttendance = (
  deviceType: 'web' | 'mobile' = 'web'
): UseDailyAttendanceReturn => {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarked, setIsMarked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCalledRef = useRef(false);

  // Defer execution: wait 3s or first user interaction
  const deferredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || deferredRef.current) return;
    
    const trigger = () => {
      if (!deferredRef.current) {
        deferredRef.current = true;
        recordAttendance();
      }
    };

    const timer = setTimeout(trigger, 3000);
    const events = ['click', 'touchstart', 'scroll'] as const;
    events.forEach(e => document.addEventListener(e, trigger, { once: true, passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach(e => document.removeEventListener(e, trigger));
    };
  }, [isAuthenticated]);

  const recordAttendance = useCallback(async () => {
    if (!isAuthenticated || hasCalledRef.current) return;
    
    hasCalledRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('No active session');
        return;
      }

      const response = await supabase.functions.invoke('record-daily-attendance', {
        body: null,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error('[DailyAttendance] Error:', response.error);
        setError(response.error.message);
        return;
      }

      const data = response.data as DailyAttendanceResponse;
      
      if (data.success) {
        setStats(data.stats);
        setIsMarked(data.today.marked);
        console.log('[DailyAttendance] Recorded successfully, streak:', data.stats.current_streak);
      }
    } catch (err: any) {
      console.error('[DailyAttendance] Exception:', err);
      setError(err.message || 'Failed to record attendance');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, deviceType]);

  const refetch = useCallback(async () => {
    hasCalledRef.current = false;
    await recordAttendance();
  }, [recordAttendance]);

  // Original eager useEffect removed - deferred execution handles this above

  return {
    percentage: stats?.monthly_attendance_percentage || 0,
    streak: stats?.current_streak || 0,
    last7Days: stats?.last_7_days || [],
    daysPresent: stats?.days_present_this_month || 0,
    totalDays: stats?.total_days_this_month || 0,
    isLoading,
    isMarked,
    error,
    refetch,
  };
};

// Hook to fetch daily attendance history for the calendar
export const useDailyAttendanceHistory = (month?: Date) => {
  return useQuery({
    queryKey: ['daily-attendance-history', month?.toISOString()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const targetMonth = month || new Date();
      const monthStart = startOfMonth(targetMonth);
      const monthEnd = endOfMonth(targetMonth);

      const { data, error } = await supabase
        .from('daily_login_attendance')
        .select('attendance_date, device_type, login_count')
        .eq('student_id', user.id)
        .gte('attendance_date', monthStart.toISOString().split('T')[0])
        .lte('attendance_date', monthEnd.toISOString().split('T')[0])
        .order('attendance_date', { ascending: true });

      if (error) throw error;

      return data.map(record => ({
        date: record.attendance_date,
        status: 'present' as const,
        subject: `Logged in ${record.login_count} time(s) via ${record.device_type}`
      }));
    },
  });
};
