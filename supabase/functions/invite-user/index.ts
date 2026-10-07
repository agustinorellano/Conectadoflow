// Conectado Flow — invite a team member by email.
//
// Sends a Supabase auth invite (a magic link to /reset-password where they
// set their password), then assigns the new profile to the caller's
// organization with the requested role. Only an admin of an organization
// can invite into it.
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

  const { email, role, redirectTo } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string') return json({ error: 'Falta el email' }, 400);
  if (role !== 'admin' && role !== 'user') return json({ error: 'Rol inválido' }, 400);

  const { data: invited, error: inviteErr } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo || undefined,
  });
  if (inviteErr) return json({ error: inviteErr.message }, 400);

  const newUserId = invited.user.id;
  const { error: assignErr } = await db.rpc('admin_assign_invited_profile', {
    target_user_id: newUserId, org_id: callerProfile.organization_id, new_role: role,
  });
  if (assignErr) return json({ error: assignErr.message }, 400);

  return json({ success: true, user_id: newUserId });
});
