-- Add admin RLS policies for discount_codes table

-- Allow admins to view all promo codes
CREATE POLICY "Admins can view all promo codes"
ON public.discount_codes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert promo codes
CREATE POLICY "Admins can create promo codes"
ON public.discount_codes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update promo codes
CREATE POLICY "Admins can update promo codes"
ON public.discount_codes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete promo codes
CREATE POLICY "Admins can delete promo codes"
ON public.discount_codes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));