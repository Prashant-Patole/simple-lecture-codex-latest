import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { instructorData } = await req.json();

    // Validate required fields
    if (!instructorData.email || !instructorData.full_name || !instructorData.password) {
      return new Response(
        JSON.stringify({ error: 'Email, full name, and password are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: instructorData.email,
      password: instructorData.password,
      email_confirm: true,
      user_metadata: {
        full_name: instructorData.full_name,
      },
    });

    if (authError) {
      // Handle specific error cases
      if (authError.message?.includes('email') || authError.status === 422) {
        return new Response(
          JSON.stringify({ error: 'A user with this email address already exists. Please use a different email.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }
      throw authError;
    }
    
    if (!authData.user) throw new Error('Failed to create user account');

    const userId = authData.user.id;

    try {
      // Step 2: Assign teacher role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'teacher',
        });

      if (roleError) throw roleError;

      // Step 3: Create teacher profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('teacher_profiles')
        .insert({
          id: userId,
          full_name: instructorData.full_name,
          email: instructorData.email,
          phone_number: instructorData.phone_number || null,
          employee_id: instructorData.employee_id || null,
          date_of_joining: instructorData.date_of_joining || null,
          department_id: instructorData.department_id || null,
          qualification: instructorData.qualification || null,
          experience_years: instructorData.experience_years || null,
          bio: instructorData.bio || null,
          avatar_url: instructorData.avatar_url || null,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      return new Response(JSON.stringify({ success: true, profile }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      // Cleanup: delete auth user if role or profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error;
    }
  } catch (error) {
    console.error('Error creating instructor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
