import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeyId || !razorpaySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find payments stuck in pending for more than 15 minutes with a gateway order ID
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('payments')
      .select('id, order_id, user_id, gateway_order_id, amount_inr, created_at')
      .eq('status', 'pending')
      .not('gateway_order_id', 'is', null)
      .lt('created_at', fifteenMinutesAgo)
      .limit(200);

    if (fetchError) throw fetchError;

    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending payments to recover', recovered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingPayments.length} pending payments to check`);

    const authHeader = 'Basic ' + btoa(`${razorpayKeyId}:${razorpaySecret}`);
    let recovered = 0;
    const results: any[] = [];

    for (const payment of pendingPayments) {
      try {
        // Check Razorpay for this order's payments
        const rzpRes = await fetch(
          `https://api.razorpay.com/v1/orders/${payment.gateway_order_id}/payments`,
          { headers: { 'Authorization': authHeader } }
        );

        if (!rzpRes.ok) {
          console.warn(`Razorpay API error for order ${payment.gateway_order_id}: ${rzpRes.status}`);
          results.push({ order_id: payment.order_id, status: 'razorpay_error', code: rzpRes.status });
          continue;
        }

        const rzpData = await rzpRes.json();
        const items = rzpData.items || rzpData;
        const capturedPayment = (Array.isArray(items) ? items : []).find(
          (p: any) => p.status === 'captured'
        );

        if (!capturedPayment) {
          console.log(`No captured payment for order ${payment.gateway_order_id}, skipping`);
          results.push({ order_id: payment.order_id, status: 'no_capture' });
          continue;
        }

        console.log(`Found captured payment ${capturedPayment.id} for order ${payment.gateway_order_id}`);

        // Update payment record
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'success',
            gateway_payment_id: capturedPayment.id,
            completed_at: new Date().toISOString()
          })
          .eq('id', payment.id)
          .eq('status', 'pending'); // prevent double-processing

        if (updateError) {
          console.error(`Failed to update payment ${payment.id}:`, updateError);
          results.push({ order_id: payment.order_id, status: 'update_error' });
          continue;
        }

        // Get order items to find course IDs
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('course_id')
          .eq('payment_id', payment.id);

        if (orderItems && orderItems.length > 0) {
          const enrollments = orderItems.map((item: any) => ({
            student_id: payment.user_id,
            course_id: item.course_id,
            is_active: true,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          }));

          const { error: enrollError } = await supabase
            .from('enrollments')
            .upsert(enrollments, { onConflict: 'student_id,course_id' });

          if (enrollError) {
            console.error(`Failed to create enrollments for payment ${payment.id}:`, enrollError);
          } else {
            console.log(`Created ${enrollments.length} enrollment(s) for user ${payment.user_id}`);
          }
        }

        recovered++;
        results.push({ order_id: payment.order_id, status: 'recovered', razorpay_id: capturedPayment.id });
      } catch (err) {
        console.error(`Error processing payment ${payment.order_id}:`, err);
        results.push({ order_id: payment.order_id, status: 'error', message: err.message });
      }
    }

    console.log(`Recovery complete: ${recovered}/${pendingPayments.length} payments recovered`);

    return new Response(
      JSON.stringify({ recovered, total_checked: pendingPayments.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment recovery error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
