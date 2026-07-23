import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, courses, customerInfo, promoCode, userId } = await req.json();
    
    console.log('Payment order request:', { amount, courses, customerInfo, promoCode, userId });

    if (!userId || !courses || courses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate discount if promo code provided
    let discountAmount = 0;
    let promoCodeId = null;

    if (promoCode) {
      const { data: discount } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', promoCode.toUpperCase())
        .single();

      if (discount && discount.is_active) {
        promoCodeId = discount.id;
        if (discount.discount_percent) {
          discountAmount = Math.round((amount * discount.discount_percent) / 100);
        } else if (discount.discount_amount) {
          discountAmount = discount.discount_amount;
        }
      }
    }

    const finalAmount = Math.max(0, amount - discountAmount);

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
            amount: finalAmount * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: orderId,
            notes: {
              customer_name: customerInfo?.fullName || '',
              customer_email: customerInfo?.email || '',
              customer_phone: customerInfo?.phone || ''
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
        }
      } catch (razorpayError) {
        console.error('Razorpay API error:', razorpayError);
      }
    }

    // Create payment record with pending status
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        user_id: userId,
        amount_inr: amount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        status: 'pending',
        payment_gateway: 'razorpay',
        gateway_order_id: razorpayOrderId,
        metadata: { customerInfo, promoCode: promoCode || null }
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      throw paymentError;
    }

    console.log('Payment record created:', payment.id);

    // Create order items
    const orderItems = courses.map((course: any) => ({
      payment_id: payment.id,
      course_id: course.id,
      price_inr: course.price || 0
    }));

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (orderItemsError) {
      console.error('Error creating order items:', orderItemsError);
      throw orderItemsError;
    }

    console.log('Order items created');

    // Increment promo code usage
    if (promoCodeId) {
      const { data: currentCode } = await supabase
        .from('discount_codes')
        .select('times_used')
        .eq('id', promoCodeId)
        .single();

      if (currentCode) {
        await supabase
          .from('discount_codes')
          .update({ times_used: (currentCode.times_used || 0) + 1 })
          .eq('id', promoCodeId);
      }

      console.log('Promo code usage incremented');
    }

    return new Response(
      JSON.stringify({ 
        orderId, 
        amount: finalAmount, 
        status: 'created',
        paymentId: payment.id,
        razorpayOrderId,
        razorpayKeyId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment order error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
