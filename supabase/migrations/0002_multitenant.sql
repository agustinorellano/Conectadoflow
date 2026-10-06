-- Conectado Flow — multi-tenant isolation.
-- Turns the single-workspace schema from 0001 into a real multi-tenant SaaS:
-- any business ("organization") can sign up and gets a fully isolated space.
-- Run this AFTER 0001_init.sql, in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- organizations (the tenant). Distinct from `commerces`, which stays meaning
-- "branch/location within an organization" — an org can have 1..N commerces.
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- profiles: add tenant membership. A profile with organization_id = null
-- hasn't finished onboarding yet (no org created/joined).
alter table public.profiles add column organization_id uuid references public.organizations(id);

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "organizations_read" on public.organizations for select using (id = public.current_org_id());

-- Self-serve signup: creates a new organization and makes the calling user
-- its admin. SECURITY DEFINER so it can set profiles.organization_id/role
-- even though the ordinary profiles RLS policy (below) blocks a user from
-- changing those columns directly.
create or replace function public.create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
begin
  if (select organization_id from public.profiles where id = auth.uid()) is not null then
    raise exception 'User already belongs to an organization';
  end if;

  insert into public.organizations (name, created_by_id) values (org_name, auth.uid())
    returning id into new_org_id;

  perform set_config('app.allow_profile_org_change', 'on', true);
  update public.profiles set organization_id = new_org_id, role = 'admin' where id = auth.uid();

  return new_org_id;
end;
$$;

-- Guard: organization_id and role on profiles can only change through the
-- function above (or by an admin of the row's own org), never by a plain
-- self-update — otherwise a user could grant themselves admin of any org.
create or replace function public.guard_profile_tenant_fields()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_profile_org_change', true), '') = 'on' then
    return new;
  end if;
  if public.is_admin() and new.organization_id is not distinct from old.organization_id then
    -- an org admin may change another member's role within the same org
    return new;
  end if;
  new.organization_id := old.organization_id;
  new.role := old.role;
  return new;
end;
$$;

create trigger trg_guard_profile_tenant before update on public.profiles
  for each row execute function public.guard_profile_tenant_fields();

-- Replace the old open policies from 0001 with tenant-scoped ones.
drop policy if exists "profiles_read" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_read" on public.profiles for select
  using (id = auth.uid() or organization_id = public.current_org_id());
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid() or (public.is_admin() and organization_id = public.current_org_id()));

-- first-signup-becomes-admin no longer applies globally; role starts as
-- 'user' and is upgraded to 'admin' by create_organization() above.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'user');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Add organization_id to every business table and auto-populate it from the
-- inserting user's profile (never trust a client-supplied value).
-- ---------------------------------------------------------------------------
create or replace function public.set_tenant_id()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.organization_id := public.current_org_id();
  elsif tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  all_tables text[] := array[
    'app_config','commerces','clients','leads','opportunities','products','sales',
    'payments','activities','meetings','documents','client_payment_methods',
    'payment_entities','pipeline_stages','message_templates','goals','notifications'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I add column organization_id uuid references public.organizations(id)', t);
    execute format('create trigger trg_tenant before insert or update on public.%I for each row execute function public.set_tenant_id()', t);

    -- Drop the single-tenant policies from 0001 and replace with tenant-scoped ones.
    execute format('drop policy if exists "%1$s_read" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_write" on public.%1$s', t); -- app_config's special insert policy name

    execute format('create policy "%1$s_read" on public.%1$s for select using (organization_id = public.current_org_id())', t);
    execute format('create policy "%1$s_insert" on public.%1$s for insert with check (organization_id is not null and organization_id = public.current_org_id())', t);
    execute format('create policy "%1$s_update" on public.%1$s for update using (organization_id = public.current_org_id())', t);
    execute format('create policy "%1$s_delete" on public.%1$s for delete using (organization_id = public.current_org_id() and (created_by_id = auth.uid() or public.is_admin()))', t);
  end loop;
end $$;

-- app_config and commerces had extra admin-only write rules in 0001; reapply
-- them on top of (narrower than) the tenant-scoped ones just created.
drop policy if exists "app_config_update" on public.app_config;
drop policy if exists "app_config_delete" on public.app_config;
create policy "app_config_update" on public.app_config for update
  using (organization_id = public.current_org_id() and public.is_admin());
create policy "app_config_delete" on public.app_config for delete
  using (organization_id = public.current_org_id() and public.is_admin());

drop policy if exists "commerces_insert" on public.commerces;
create policy "commerces_insert" on public.commerces for insert
  with check (organization_id = public.current_org_id() and owner_id = auth.uid());

-- notifications keep their extra "only the recipient" restriction, now also tenant-scoped.
drop policy if exists "notifications_read" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_read" on public.notifications for select
  using (organization_id = public.current_org_id() and (owner_id = auth.uid() or public.is_admin()));
create policy "notifications_update" on public.notifications for update
  using (organization_id = public.current_org_id() and (owner_id = auth.uid() or public.is_admin()));
create policy "notifications_delete" on public.notifications for delete
  using (organization_id = public.current_org_id() and (owner_id = auth.uid() or public.is_admin()));
