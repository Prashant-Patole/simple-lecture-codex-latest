import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CartItem {
  id: string;
  course_id: string;
  course_name: string;
  course_price: number;
  course_thumbnail?: string;
  added_at: string;
}

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          course_id,
          added_at,
          courses (
            name,
            price_inr,
            thumbnail_url
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const cartItems: CartItem[] = data?.map((item: any) => ({
        id: item.id,
        course_id: item.course_id,
        course_name: item.courses.name,
        course_price: item.courses.price_inr,
        course_thumbnail: item.courses.thumbnail_url,
        added_at: item.added_at,
      })) || [];

      setItems(cartItems);
    } catch (error: any) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (courseId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please login to add items to cart',
          variant: 'destructive',
        });
        return false;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert({ user_id: user.id, course_id: courseId });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already in Cart',
            description: 'This course is already in your cart',
          });
          return false;
        }
        throw error;
      }

      toast({
        title: 'Added to Cart',
        description: 'Course added successfully',
      });

      await fetchCart();
      return true;
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to add to cart',
        variant: 'destructive',
      });
      return false;
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);

      if (error) throw error;

      toast({
        title: 'Removed',
        description: 'Course removed from cart',
      });

      await fetchCart();
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from cart',
        variant: 'destructive',
      });
    }
  };

  const clearCart = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setItems([]);
    } catch (error: any) {
      console.error('Error clearing cart:', error);
    }
  };

  const total = items.reduce((sum, item) => sum + item.course_price, 0);

  return {
    items,
    loading,
    addToCart,
    removeFromCart,
    clearCart,
    fetchCart,
    total,
    itemCount: items.length,
  };
};
