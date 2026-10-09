// Conectado Flow — invite a team member by email.
//
// Creates the account directly with a password the admin chose (instead of
// emailing a magic link through Supabase's own mailer, which needs SMTP
// configured and is rate-limited on the free tier). The admin shares those
// credentials with the new member however they want — WhatsApp, email,
// in person — same as every other "send" action in this app, which just
// opens a prefilled wa.me/mailto link instead of relying on a backend
// mailer. The account is created already confirmed, so the member can log
// in immediately with the password they were given.
//
// Deploy with: supabase functions deploy invite-user
// No extra secrets needed — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
// SUPABASE_ANON_KEY are provided automatically by the Supabase platform.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function getCallingUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await anon.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const caller = await getCallingUser(req);
  if (!caller) return json({ error: 'No autenticado' }, 401);

  const db = admin();

  const { data: callerProfile, error: profileErr } = await db
    .from('profiles').select('role, organization_id').eq('id', caller.id).single();
  if (profileErr || !callerProfile) return json({ error: 'No se pudo verificar tu perfil' }, 403);
  if (callerProfile.role !== 'admin') return json({ error: 'Solo un administrador puede invitar miembros' }, 403);
  if (!callerProfile.organization_id) return json({ error: 'Tu cuenta todavía no pertenece a una organización' }, 403);

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // reset_password: the member lost their password and the admin needs to
  // hand them a new one — same share-by-WhatsApp/mail flow as inviting,
  // just against an existing auth user instead of creating one. We
  // deliberately do NOT expose a way to read anyone's current password
  // (Supabase never stores it in a reversible form, so there's nothing to
  // read) — only to set a brand new one.
  if (action === 'reset_password') {
    const { user_id, password } = body;
    if (!user_id || typeof user_id !== 'string') return json({ error: 'Falta el usuario' }, 400);
    if (!password || typeof password !== 'string' || password.length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
    }
    const { data: targetProfile, error: targetErr } = await db
      .from('profiles').select('organization_id').eq('id', user_id).single();
    if (targetErr || !targetProfile) return json({ error: 'Usuario no encontrado' }, 404);
    if (targetProfile.organization_id !== callerProfile.organization_id) {
      return json({ error: 'Ese usuario no pertenece a tu organización' }, 403);
    }
    const { error: updateErr } = await db.auth.admin.updateUserById(user_id, { password });
    if (updateErr) return json({ error: updateErr.message }, 400);
    return json({ success: true });
  }

  const { email, role, password, full_name } = body;
  if (!email || typeof email !== 'string') return json({ error: 'Falta el email' }, 400);
  if (!password || typeof password !== 'string' || password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
  }
  if (!['admin', 'manager', 'user', 'viewer'].includes(role)) return json({ error: 'Rol inválido' }, 400);

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: full_name ? { full_name } : undefined,
  });
  if (createErr) return json({ error: createErr.message }, 400);

  const newUserId = created.user.id;
  const { error: assignErr } = await db.rpc('admin_assign_invited_profile', {
    target_user_id: newUserId, org_id: callerProfile.organization_id, new_role: role,
  });
  if (assignErr) return json({ error: assignErr.message }, 400);

  return json({ success: true, user_id: newUserId });
});
