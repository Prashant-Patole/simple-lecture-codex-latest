import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return new Response('Server misconfigured', { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      console.warn('Missing x-razorpay-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    // Verify HMAC SHA-256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== signature) {
      console.warn('Webhook signature verification failed');
      return new Response('Invalid signature', { status: 400 });
    }

    const payload = JSON.parse(body);
    const event = payload.event;

    // Only handle payment.captured
    if (event !== 'payment.captured') {
      console.log(`Ignoring event: ${event}`);
      return new Response(JSON.stringify({ status: 'ignored', event }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      console.error('No payment entity in payload');
      return new Response('Invalid payload', { status: 400 });
    }

    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    console.log(`Processing payment.captured: order=${razorpayOrderId}, payment=${razorpayPaymentId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up payment by gateway_order_id
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('id, user_id, status')
      .eq('gateway_order_id', razorpayOrderId)
      .single();

    if (fetchError || !payment) {
      console.error('Payment not found for order:', razorpayOrderId, fetchError);
      return new Response(JSON.stringify({ status: 'not_found' }), {
        status: 200, // Return 200 so Razorpay doesn't retry
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only process if still pending
    if (payment.status !== 'pending') {
      console.log(`Payment ${payment.id} already ${payment.status}, skipping`);
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update payment to success
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'success',
        gateway_payment_id: razorpayPaymentId,
        completed_at: new Date().toISOString()
      })
      .eq('id', payment.id)
      .eq('status', 'pending'); // Prevent race conditions

    if (updateError) {
      console.error('Failed to update payment:', updateError);
      return new Response(JSON.stringify({ status: 'update_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Payment ${payment.id} updated to success`);

    // Fetch order items and create enrollments
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
        console.error('Failed to create enrollments:', enrollError);
      } else {
        console.log(`Created ${enrollments.length} enrollment(s) for user ${payment.user_id}`);
      }
    }

    return new Response(JSON.stringify({ status: 'processed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
