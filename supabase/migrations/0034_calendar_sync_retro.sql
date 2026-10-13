-- La migración 0007_calendar_sync.sql nunca se aplicó en esta base (se
-- confirmó con: select to_regclass('public.calendar_connections') -> null,
-- igual que pasó antes con automation_rules/calendar_connections durante el
-- trabajo de delete_organization()). Esta migración hace lo mismo que la
-- 0007 pero con guards para poder correrla sin romper nada si alguna parte
-- ya existiera a medias.

do $$
begin
  if to_regclass('public.calendar_connections') is null then
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
    -- Sin policies a propósito: con RLS prendido y cero policies, nadie
    -- autenticado puede leer/escribir — solo la service role (Edge
    -- Function) puede, porque esa bypassea RLS. Los tokens nunca deben
    -- llegar al navegador.
    alter table public.calendar_connections enable row level security;
  end if;
end $$;

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

alter table public.meetings add column if not exists google_event_id text;
alter table public.meetings add column if not exists calendar_synced_at timestamptz;

notify pgrst, 'reload schema';
