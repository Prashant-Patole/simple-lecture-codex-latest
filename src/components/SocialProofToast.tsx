import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { safeSessionStorage } from '@/lib/safeStorage';

const TESTIMONIAL_MESSAGES = [
  "Thank you! Great choice to choose SimpleLecture 🎉",
  "Best decision for my exam preparation! 💪",
  "SimpleLecture changed my study game completely! 📚",
  "Highly recommend to all SSLC students! ⭐",
  "The AI teaching is amazing, so glad I enrolled! 🤩",
  "My scores improved so much after joining! 📈",
  "Worth every rupee! SimpleLecture is the best! 🙏",
  "I wish I had found this earlier! 🌟",
];

const FALLBACK_ENROLLMENTS = [
  { name: "Harsha", course: "10th Boards - SSLC Karnataka" },
  { name: "Priya", course: "10th Boards - SSLC Karnataka" },
  { name: "Rahul", course: "10th Boards - SSLC Karnataka" },
  { name: "Sneha", course: "10th Boards - SSLC Karnataka" },
  { name: "Arun", course: "10th Boards - SSLC Karnataka" },
  { name: "Divya", course: "10th Boards - SSLC Karnataka" },
];

const maskName = (name: string): string => {
  if (!name || typeof name !== 'string' || name.length < 3) return name || '';
  return name.charAt(0) + '*'.repeat(Math.min(name.length - 2, 4)) + name.charAt(name.length - 1);
};

export const SocialProofToast = () => {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Check if user already purchased a course
  const { data: hasEnrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['user-has-enrollment-check'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .eq('is_active', true);
      return (count || 0) > 0;
    },
    staleTime: 60000,
  });

  // Fetch recent enrollments for social proof
  const { data: enrollments } = useQuery({
    queryKey: ['social-proof-enrollments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('enrollments')
          .select('student_id, enrolled_at, courses(name)')
          .eq('is_active', true)
          .order('enrolled_at', { ascending: false })
          .limit(50);
        if (error) throw error;

        const rows = data || [];
        const studentIds = [...new Set(rows.map(e => e.student_id))];

        // Guard: Supabase .in() throws on an empty array
        const nameMap = new Map<string, string>();
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentIds);
          (profiles || []).forEach(p => {
            if (p.id && p.full_name) nameMap.set(p.id, p.full_name);
          });
        }

        const results = rows.map(e => {
          // courses join can be object or array depending on schema; handle both
          const coursesRaw = e.courses as any;
          const courseName = Array.isArray(coursesRaw)
            ? (coursesRaw[0]?.name ?? 'a course')
            : (coursesRaw?.name ?? 'a course');
          return {
            name: String(nameMap.get(e.student_id) || 'A student'),
            course: String(courseName || 'a course'),
          };
        });

        return results.length > 0 ? results : FALLBACK_ENROLLMENTS;
      } catch {
        return FALLBACK_ENROLLMENTS;
      }
    },
    staleTime: 300000,
  });

  const displayData = (enrollments && enrollments.length > 0) ? enrollments : FALLBACK_ENROLLMENTS;

  const showNext = useCallback(() => {
    if (dismissed || hasEnrollment) return;
    const len = displayData.length;
    if (len === 0) return;
    setCurrentIndex(prev => (prev + 1) % len);
    setVisible(true);
    setTimeout(() => setVisible(false), 3500);
  }, [displayData, dismissed, hasEnrollment]);

  useEffect(() => {
    if (dismissed || hasEnrollment || enrollmentLoading) return;
    if (safeSessionStorage.getItem('social-proof-dismissed')) {
      setDismissed(true);
      return;
    }
    const initial = setTimeout(showNext, 8000);
    const interval = setInterval(showNext, 12000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [dismissed, hasEnrollment, enrollmentLoading, showNext]);

  if (dismissed || hasEnrollment || enrollmentLoading) return null;

  const len = displayData.length;
  if (len === 0) return null;
  const safeIndex = currentIndex % len;
  const enrollment = displayData[safeIndex];
  if (!enrollment || !enrollment.name || !enrollment.course) return null;
  const message = TESTIMONIAL_MESSAGES[safeIndex % TESTIMONIAL_MESSAGES.length] ?? TESTIMONIAL_MESSAGES[0];

  return (
    <div
      className={cn(
        "fixed z-40 transition-all duration-500 max-w-sm",
        isMobile ? "bottom-24 left-3 right-3 max-w-none" : "bottom-6 left-6",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"
      )}
    >
      <div className="bg-card border border-border shadow-lg rounded-xl p-4 relative">
        <button
          onClick={() => {
            setDismissed(true);
            safeSessionStorage.setItem('social-proof-dismissed', 'true');
          }}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-base font-medium text-foreground pr-5">
          {maskName(enrollment.name)} just enrolled in <span className="text-primary font-semibold">{enrollment.course}</span>
        </p>
        <p className="text-sm text-muted-foreground mt-1.5 italic">"{message}"</p>
      </div>
    </div>
  );
};
