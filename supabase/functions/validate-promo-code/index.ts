import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, course_id } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Promo code is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the discount code
    const { data: discount, error: discountError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (discountError || !discount) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Invalid promo code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if active
    if (!discount.is_active) {
      return new Response(
        JSON.stringify({ valid: false, message: 'This promo code is no longer active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check date validity
    const now = new Date();
    const validFrom = discount.valid_from ? new Date(discount.valid_from) : null;
    const validUntil = discount.valid_until ? new Date(discount.valid_until) : null;

    if (validFrom && now < validFrom) {
      return new Response(
        JSON.stringify({ valid: false, message: 'This promo code is not yet valid' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (validUntil && now > validUntil) {
      return new Response(
        JSON.stringify({ valid: false, message: 'This promo code has expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check course restriction (course-specific promo codes)
    if (discount.course_id && discount.course_id !== course_id) {
      return new Response(
        JSON.stringify({ valid: false, message: 'This promo code is not valid for this course' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check usage limit
    if (discount.max_uses && discount.times_used >= discount.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, message: 'This promo code has reached its usage limit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return valid discount details
    return new Response(
      JSON.stringify({
        valid: true,
        id: discount.id,
        code: discount.code,
        description: discount.description,
        discount_percent: discount.discount_percent,
        discount_amount: discount.discount_amount,
        message: 'Promo code applied successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating promo code:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'Failed to validate promo code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
