import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderItem {
  id: string;
  order_id: string;
  user_id: string;
  student_name: string | null;
  student_email: string | null;
  student_phone: string | null;
  amount_inr: number;
  discount_amount: number | null;
  final_amount: number;
  status: string;
  payment_gateway: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: {
    customerInfo?: {
      fullName?: string;
      email?: string;
      phone?: string;
      state?: string;
      city?: string;
    };
    promoCode?: string;
  } | null;
  courses: {
    id: string;
    name: string;
    price: number;
  }[];
}

export const useAdminOrders = () => {
  return useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      // Get payments with order items and course details
      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          id,
          order_id,
          user_id,
          amount_inr,
          discount_amount,
          final_amount,
          status,
          payment_gateway,
          gateway_order_id,
          gateway_payment_id,
          created_at,
          completed_at,
          metadata,
          order_items (
            id,
            course_id,
            price_inr,
            courses (
              id,
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user profiles for names
      const userIds = [...new Set(payments?.map(p => p.user_id).filter(Boolean))];
      
      let profilesMap: Record<string, { full_name: string | null; phone_number: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .in('id', userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name, phone_number: p.phone_number };
          return acc;
        }, {} as Record<string, { full_name: string | null; phone_number: string | null }>);
      }

      const orders: OrderItem[] = (payments || []).map(payment => {
        const profile = payment.user_id ? profilesMap[payment.user_id] : null;
        const metadata = payment.metadata as OrderItem['metadata'];
        
        return {
          id: payment.id,
          order_id: payment.order_id,
          user_id: payment.user_id,
          student_name: profile?.full_name || metadata?.customerInfo?.fullName || null,
          student_email: metadata?.customerInfo?.email || null,
          student_phone: profile?.phone_number || metadata?.customerInfo?.phone || null,
          amount_inr: payment.amount_inr,
          discount_amount: payment.discount_amount,
          final_amount: payment.final_amount,
          status: payment.status,
          payment_gateway: payment.payment_gateway,
          created_at: payment.created_at,
          completed_at: payment.completed_at,
          metadata,
          courses: (payment.order_items || []).map((item: any) => ({
            id: item.course_id,
            name: item.courses?.name || 'Unknown Course',
            price: item.price_inr
          }))
        };
      });

      return orders;
    }
  });
};
