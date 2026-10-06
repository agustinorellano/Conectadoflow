// Conectado Flow — Google Calendar two-way sync.
//
// One Edge Function, dispatched by `action` in the POST body:
//   - connect:      exchange an OAuth `code` for tokens, store the connection
//   - sync_meeting: push a created/updated/deleted meeting to Google Calendar
//   - pull_events:  pull Google Calendar events of the next 30 days into meetings
//   - disconnect:   remove the stored connection (also exposed as the
//                    disconnect_calendar() SQL function for convenience)
//
// Deploy with: supabase functions deploy google-calendar
// Required secrets (supabase secrets set NAME=value):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are provided
// automatically by the Supabase platform — do not set those yourself.

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

// Refreshes the access token if it's expired (or about to be), persists the
// new one, and returns a valid access token to use right now.
async function getValidAccessToken(db: ReturnType<typeof admin>, conn: any) {
  const expiresInMs = new Date(conn.token_expiry).getTime() - Date.now();
  if (expiresInMs > 60_000) return conn.access_token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await db.from('calendar_connections')
    .update({ access_token: tokens.access_token, token_expiry: newExpiry, updated_date: new Date().toISOString() })
    .eq('id', conn.id);

  return tokens.access_token as string;
}

function meetingToGoogleEvent(meeting: any) {
  const start = new Date(meeting.date);
  const end = new Date(start.getTime() + (Number(meeting.duration) || 60) * 60000);
  return {
    summary: meeting.title,
    description: [meeting.client_name ? `Cliente: ${meeting.client_name}` : null, meeting.notes || null]
      .filter(Boolean).join('\n\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    status: meeting.status === 'Cancelada' ? 'cancelled' : 'confirmed',
  };
}

async function handleConnect(req: Request, db: ReturnType<typeof admin>, userId: string, orgId: string) {
  const { code } = await req.json();
  if (!code) return json({ error: 'Missing code' }, 400);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: Deno.env.get('GOOGLE_REDIRECT_URI')!,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return json({ error: `Google token exchange failed: ${await res.text()}` }, 400);
  const tokens = await res.json();
  if (!tokens.refresh_token) {
    return json({ error: 'Google no devolvió un refresh_token. Revocá el acceso en myaccount.google.com/permissions y volvé a conectar.' }, 400);
  }
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await db.from('calendar_connections').upsert({
    user_id: userId,
    organization_id: orgId,
    provider: 'google',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: expiry,
    updated_date: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return json({ error: error.message }, 500);

  return json({ connected: true });
}

async function handleSyncMeeting(req: Request, db: ReturnType<typeof admin>, userId: string) {
  const { meeting_id, action } = await req.json();
  const { data: conn } = await db.from('calendar_connections').select('*').eq('user_id', userId).maybeSingle();
  if (!conn) return json({ error: 'No hay una cuenta de Google Calendar conectada' }, 400);

  const accessToken = await getValidAccessToken(db, conn);
  const { data: meeting } = await db.from('meetings').select('*').eq('id', meeting_id).maybeSingle();
  if (!meeting) return json({ error: 'Meeting not found' }, 404);

  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events`;
  const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  if (action === 'delete') {
    if (meeting.google_event_id) {
      await fetch(`${base}/${meeting.google_event_id}`, { method: 'DELETE', headers: authHeaders });
    }
    return json({ synced: true });
  }

  const body = JSON.stringify(meetingToGoogleEvent(meeting));
  let res: Response;
  if (meeting.google_event_id) {
    res = await fetch(`${base}/${meeting.google_event_id}`, { method: 'PATCH', headers: authHeaders, body });
  } else {
    res = await fetch(base, { method: 'POST', headers: authHeaders, body });
  }
  if (!res.ok) return json({ error: `Google Calendar error: ${await res.text()}` }, 500);
  const event = await res.json();

  await db.from('meetings').update({
    google_event_id: event.id,
    calendar_synced_at: new Date().toISOString(),
  }).eq('id', meeting_id);

  return json({ synced: true, google_event_id: event.id });
}

async function handlePullEvents(db: ReturnType<typeof admin>, userId: string, orgId: string) {
  const { data: conn } = await db.from('calendar_connections').select('*').eq('user_id', userId).maybeSingle();
  if (!conn) return json({ error: 'No hay una cuenta de Google Calendar conectada' }, 400);

  const accessToken = await getValidAccessToken(db, conn);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events` +
    `?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return json({ error: `Google Calendar error: ${await res.text()}` }, 500);
  const { items = [] } = await res.json();

  let created = 0, updated = 0;
  for (const event of items) {
    if (!event.start?.dateTime || event.status === 'cancelled') continue;
    const { data: existing } = await db.from('meetings').select('id').eq('google_event_id', event.id).maybeSingle();
    const durationMin = event.end?.dateTime
      ? Math.max(15, Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000))
      : 60;
    const payload = {
      title: event.summary || '(Sin título)',
      date: event.start.dateTime,
      duration: durationMin,
      notes: event.description || null,
      google_event_id: event.id,
      calendar_synced_at: new Date().toISOString(),
    };
    if (existing) {
      await db.from('meetings').update(payload).eq('id', existing.id);
      updated++;
    } else {
      await db.from('meetings').insert({
        ...payload,
        organization_id: orgId,
        owner_id: userId,
        status: 'Programada',
        type: 'Videollamada',
      });
      created++;
    }
  }

  return json({ pulled: items.length, created, updated });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const user = await getCallingUser(req);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const db = admin();
  const { data: profile } = await db.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
  if (!profile?.organization_id) return json({ error: 'No organization' }, 400);

  let body: any = {};
  try { body = await req.clone().json(); } catch { /* no body */ }

  try {
    switch (body.action) {
      case 'connect': return await handleConnect(req, db, user.id, profile.organization_id);
      case 'sync_meeting': return await handleSyncMeeting(req, db, user.id);
      case 'pull_events': return await handlePullEvents(db, user.id, profile.organization_id);
      default: return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
