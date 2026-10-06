-- Conectado Flow — Google Calendar two-way sync.
-- Each user connects their own Google Calendar (OAuth). Meetings created,
-- edited or deleted in Conectado Flow push to Google Calendar, and a
-- "Sincronizar ahora" pull brings changes made directly in Google back in.

-- OAuth tokens live here, and ONLY here. This table intentionally has NO
-- RLS policies: with RLS enabled and zero policies, no authenticated or
-- anon client can read/write a row — only the service-role key (used
-- exclusively inside the google-calendar Edge Function) can, since the
-- service role bypasses RLS entirely. Tokens must never reach the browser.
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id) unique,
  provider text not null default 'google' check (provider in ('google')),
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  calendar_id text not null default 'primary',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
alter table public.calendar_connections enable row level security;

-- Safe, token-free ways for the client to check/clear its own connection.
create or replace function public.has_calendar_connection()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.calendar_connections where user_id = auth.uid() and provider = 'google');
$$;

create or replace function public.disconnect_calendar()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.calendar_connections where user_id = auth.uid() and provider = 'google';
end;
$$;

-- Tracks the linked Google Calendar event per meeting, so updates/deletes
-- know which remote event to touch, and pulls can match instead of duplicate.
alter table public.meetings add column google_event_id text;
alter table public.meetings add column calendar_synced_at timestamptz;
