import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, courseId, languages } = await req.json();
    
    console.log('Create topup order request:', { userId, courseId, languages });

    if (!userId || !courseId || !languages || languages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get course pricing
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('language_topup_price')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pricePerLanguage = course.language_topup_price || 0;

    // Check if user already has any purchased languages for this course
    const { data: existingPurchase } = await supabase
      .from('language_topup_purchases')
      .select('selected_languages')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'success')
      .maybeSingle();

    const alreadyPurchased: string[] = (existingPurchase?.selected_languages as string[]) || [];
    
    // Filter out already purchased languages
    const newLanguages = languages.filter((l: string) => !alreadyPurchased.includes(l));

    if (newLanguages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'All selected languages are already purchased' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate amount based on new languages only
    const amount = pricePerLanguage * newLanguages.length;

    console.log('Calculated amount:', { newLanguages, pricePerLanguage, amount });

    // Generate order ID
    const orderId = `TOPUP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create Razorpay order
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    let razorpayOrderId = null;

    if (razorpayKeyId && razorpaySecret) {
      try {
        const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${razorpayKeyId}:${razorpaySecret}`)
          },
          body: JSON.stringify({
            amount: amount * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: orderId,
            notes: {
              type: 'language_topup',
              course_id: courseId,
              user_id: userId,
              languages: JSON.stringify(newLanguages)
            }
          })
        });

        if (razorpayResponse.ok) {
          const razorpayOrder = await razorpayResponse.json();
          razorpayOrderId = razorpayOrder.id;
          console.log('Razorpay order created:', razorpayOrderId);
        } else {
          const errorText = await razorpayResponse.text();
          console.error('Razorpay order creation failed:', errorText);
          throw new Error('Failed to create Razorpay order');
        }
      } catch (razorpayError) {
        console.error('Razorpay API error:', razorpayError);
        throw razorpayError;
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete any existing pending purchase for this user+course
    await supabase
      .from('language_topup_purchases')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'pending');

    // Create purchase record with pending status
    const { error: insertError } = await supabase
      .from('language_topup_purchases')
      .insert({
        user_id: userId,
        course_id: courseId,
        order_id: orderId,
        razorpay_order_id: razorpayOrderId,
        selected_languages: newLanguages,
        amount_paid: amount,
        status: 'pending'
      });

    if (insertError) {
      console.error('Error creating purchase record:', insertError);
      throw insertError;
    }

    console.log('Purchase record created:', orderId, 'for languages:', newLanguages);

    return new Response(
      JSON.stringify({ 
        orderId, 
        razorpayOrderId,
        razorpayKeyId,
        amount,
        languages: newLanguages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create topup order error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
