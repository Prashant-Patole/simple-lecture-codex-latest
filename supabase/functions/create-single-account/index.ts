import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const email = 'prashantpatole3015@gmail.com';
    const password = 'prashant213!!';
    const full_name = 'Prashant Patole';
    const COURSE_ID = '4c10bc8e-acbc-4b76-b7f5-54376c030cb0';

    let userId: string | null = null;
    let createdNow = false;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
      createdNow = true;
    }

    await admin.from('profiles').upsert({ id: userId, full_name, email }, { onConflict: 'id' });
    await admin.from('user_roles').upsert({ user_id: userId, role: 'student' }, { onConflict: 'user_id,role' });

    const { data: existingEnroll } = await admin
      .from('enrollments')
      .select('id')
      .eq('student_id', userId)
      .eq('course_id', COURSE_ID)
      .maybeSingle();

    if (existingEnroll) {
      await admin.from('enrollments').update({
        is_active: true,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', existingEnroll.id);
    } else {
      await admin.from('enrollments').insert({
        student_id: userId,
        course_id: COURSE_ID,
        is_active: true,
        enrolled_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, email, status: createdNow ? 'created' : 'updated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
