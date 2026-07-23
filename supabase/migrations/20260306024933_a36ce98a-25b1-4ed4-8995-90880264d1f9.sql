-- Add admin SELECT policy on payments table
CREATE POLICY "Admins can view all payments"
ON public.payments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin SELECT policy on order_items table
CREATE POLICY "Admins can view all order_items"
ON public.order_items FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));