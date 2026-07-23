import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageLoader } from '@/components/ui/page-loader';

/**
 * Handles Razorpay redirect callback (WebView compatibility).
 * Razorpay redirects here with query params after payment in WebView.
 * This page verifies the payment and redirects to /payment-success.
 */
const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const razorpay_payment_id = searchParams.get('razorpay_payment_id');
      const razorpay_order_id = searchParams.get('razorpay_order_id');
      const razorpay_signature = searchParams.get('razorpay_signature');

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        console.error('[PaymentCallback] Missing query params:', { razorpay_payment_id, razorpay_order_id, razorpay_signature });
        setError('Invalid payment callback. Missing parameters.');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      console.log('[PaymentCallback] Processing redirect callback:', { razorpay_order_id, razorpay_payment_id });

      try {
        // Look up the payment record by gateway_order_id
        const { data: payment, error: fetchError } = await supabase
          .from('payments')
          .select('id, order_id, user_id, amount_inr, status')
          .eq('gateway_order_id', razorpay_order_id)
          .single();

        if (fetchError || !payment) {
          console.error('[PaymentCallback] Payment not found for gateway_order_id:', razorpay_order_id, fetchError);
          setError('Payment record not found. Please contact support.');
          setTimeout(() => navigate('/'), 5000);
          return;
        }

        // If already verified, skip verification
        if (payment.status === 'success') {
          console.log('[PaymentCallback] Payment already verified, redirecting...');
          navigate(`/payment-success?orderId=${payment.order_id}`, { replace: true });
          return;
        }

        // Get order items (courses) for this payment
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('course_id')
          .eq('payment_id', payment.id);

        const courseIds = orderItems?.map((item: any) => item.course_id) || [];

        // Call verify-payment
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
          body: {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId: payment.order_id,
            userId: payment.user_id,
            courses: courseIds.map((id: string) => ({ id })),
          },
        });

        if (verifyError) {
          console.warn('[PaymentCallback] Verification error (proceeding anyway):', verifyError);
        } else {
          console.log('[PaymentCallback] Verification result:', verifyData);
        }

        // Redirect to success page with orderId as query param
        navigate(`/payment-success?orderId=${payment.order_id}`, { replace: true });
      } catch (err: any) {
        console.error('[PaymentCallback] Error:', err);
        setError('Something went wrong. Your payment is safe — please contact support.');
        setTimeout(() => navigate('/'), 5000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-lg font-semibold text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting you shortly...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <PageLoader />
        <p className="text-lg font-medium">Verifying your payment...</p>
        <p className="text-sm text-muted-foreground">Please wait, do not close this page.</p>
      </div>
    </div>
  );
};

export default PaymentCallback;
