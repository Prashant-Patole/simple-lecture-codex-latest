import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupportFAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  display_order: number;
  helpful_count: number;
}

export const useSupportFAQs = (category?: string) => {
  return useQuery({
    queryKey: ['support-faqs', category],
    queryFn: async () => {
      let query = supabase
        .from('support_faqs')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching FAQs:", error);
        throw error;
      }

      return data as SupportFAQ[];
    },
  });
};

export const useSearchFAQs = (searchTerm: string) => {
  return useQuery({
    queryKey: ['support-faqs-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from('support_faqs')
        .select('*')
        .eq('is_active', true)
        .or(`question.ilike.%${searchTerm}%,answer.ilike.%${searchTerm}%`)
        .order('display_order', { ascending: true });

      if (error) {
        console.error("Error searching FAQs:", error);
        throw error;
      }

      return data as SupportFAQ[];
    },
    enabled: searchTerm.length >= 2,
  });
};

export const FAQ_CATEGORIES = [
  { value: 'all', label: 'All Topics' },
  { value: 'account', label: 'Account' },
  { value: 'payment', label: 'Payment' },
  { value: 'technical', label: 'Technical' },
  { value: 'courses', label: 'Courses' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'general', label: 'General' },
];
