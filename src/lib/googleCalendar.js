import { supabase } from '@/lib/supabaseClient';

const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

// Builds the Google OAuth consent URL. No secret involved — only the
// publicly-known client ID — so this can run entirely client-side.
export function getGoogleAuthUrl() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/calendar/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const googleCalendar = {
  connect: (code) => invoke('connect', { code }),
  syncMeeting: (meetingId, action = 'upsert') => invoke('sync_meeting', { meeting_id: meetingId, action }),
  pullEvents: () => invoke('pull_events'),
  async isConnected() {
    const { data, error } = await supabase.rpc('has_calendar_connection');
    if (error) return false;
    return !!data;
  },
  async disconnect() {
    const { error } = await supabase.rpc('disconnect_calendar');
    if (error) throw error;
  },
};
