import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COURSE_ID = '4c10bc8e-acbc-4b76-b7f5-54376c030cb0'; // SSLC Karnataka
const PASSWORD = 'Tester@123';
const TESTERS = [
  { email: 'tester1@simplelecture.com', full_name: 'Tester One' },
  { email: 'tester2@simplelecture.com', full_name: 'Tester Two' },
  { email: 'tester3@simplelecture.com', full_name: 'Tester Three' },
  { email: 'tester4@simplelecture.com', full_name: 'Tester Four' },
  { email: 'tester5@simplelecture.com', full_name: 'Tester Five' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Disabled after one-shot bootstrap. Re-enable manually if needed.
    return new Response(JSON.stringify({ error: 'Disabled' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const results: any[] = [];

    for (const t of TESTERS) {
      let userId: string | null = null;
      let createdNow = false;

      // Try create
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: t.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: t.full_name },
      });

      if (createErr) {
        // Likely already exists — find existing
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === t.email.toLowerCase());
        if (!existing) {
          results.push({ email: t.email, status: 'error', error: createErr.message });
          continue;
        }
        userId = existing.id;
        // Reset password to known one
        await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
      } else {
        userId = created.user!.id;
        createdNow = true;
      }

      // Ensure profile exists (trigger handles it but make sure)
      await admin.from('profiles').upsert({ id: userId, full_name: t.full_name, email: t.email }, { onConflict: 'id' });
      // Ensure student role
      await admin.from('user_roles').upsert({ user_id: userId, role: 'student' }, { onConflict: 'user_id,role' });

      // Ensure enrollment
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

      results.push({
        email: t.email,
        password: PASSWORD,
        full_name: t.full_name,
        user_id: userId,
        status: createdNow ? 'created' : 'updated',
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
