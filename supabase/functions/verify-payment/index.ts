import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      orderId,
      userId,
      courses 
    } = await req.json();
    
    console.log('Verify payment request:', { razorpay_order_id, razorpay_payment_id, orderId });

    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpaySecret) {
      throw new Error('Razorpay secret not configured');
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(razorpaySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Payment verification failed', verified: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature verified successfully');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update payment status
    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        status: 'success',
        gateway_payment_id: razorpay_payment_id,
        gateway_order_id: razorpay_order_id,
        completed_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (paymentError) {
      console.error('Error updating payment:', paymentError);
      throw paymentError;
    }

    // Create enrollments for each course
    if (courses && courses.length > 0) {
      const enrollments = courses.map((course: any) => ({
        student_id: userId,
        course_id: course.id,
        is_active: true,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }));

      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .upsert(enrollments, { onConflict: 'student_id,course_id' });

      if (enrollmentError) {
        console.error('Error creating enrollments:', enrollmentError);
        throw enrollmentError;
      }

      console.log('Enrollments created successfully');
    }

    return new Response(
      JSON.stringify({ verified: true, message: 'Payment verified and enrollment created' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment verification error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred', verified: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
