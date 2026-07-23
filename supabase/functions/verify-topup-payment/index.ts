import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      orderId,
      userId,
      courseId,
      languages 
    } = await req.json();
    
    console.log('Verify topup payment request:', { razorpay_order_id, orderId, userId, courseId, languages });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (!razorpaySecret) {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = createHmac('sha256', razorpaySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Payment verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature verified successfully');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the pending purchase to get the new languages
    const { data: pendingPurchase } = await supabase
      .from('language_topup_purchases')
      .select('selected_languages')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    const newLanguages: string[] = (pendingPurchase?.selected_languages as string[]) || languages || [];

    // Check if user already has a successful purchase (for merging)
    const { data: existingPurchase } = await supabase
      .from('language_topup_purchases')
      .select('id, selected_languages')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'success')
      .maybeSingle();

    if (existingPurchase) {
      // Merge languages with existing purchase
      const existingLanguages: string[] = (existingPurchase.selected_languages as string[]) || [];
      const mergedLanguages = [...new Set([...existingLanguages, ...newLanguages])];

      // Update existing successful purchase with merged languages
      const { error: mergeError } = await supabase
        .from('language_topup_purchases')
        .update({
          selected_languages: mergedLanguages,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingPurchase.id);

      if (mergeError) {
        console.error('Error merging languages:', mergeError);
        throw mergeError;
      }

      // Delete the pending purchase record
      await supabase
        .from('language_topup_purchases')
        .delete()
        .eq('order_id', orderId);

      console.log('Languages merged successfully:', mergedLanguages);
    } else {
      // No existing purchase, just update the pending one to success
      const { error: updateError } = await supabase
        .from('language_topup_purchases')
        .update({
          status: 'success',
          razorpay_payment_id,
          completed_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating purchase record:', updateError);
        throw updateError;
      }

      console.log('Purchase completed successfully:', orderId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Payment verified and languages unlocked'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify topup payment error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
