-- Conectado Flow — richer admin org view + platform-wide notifications.

-- Replace admin_list_organizations with a version that also surfaces
-- rubro (industry), tipo de cuenta (mode), and the org admin's contact
-- info — the "estado de situación" the super-admin panel needs per account.
drop function if exists public.admin_list_organizations();

create or replace function public.admin_list_organizations()
returns table (
  id uuid, name text, is_active boolean, created_date timestamptz,
  member_count bigint, sales_count bigint, total_revenue numeric,
  industry text, mode text, billing_email text, billing_phone text,
  admin_name text, admin_email text, admin_phone text
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select
      o.id, o.name, o.is_active, o.created_date,
      (select count(*) from public.profiles p where p.organization_id = o.id)::bigint as member_count,
      (select count(*) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada')::bigint as sales_count,
      (select coalesce(sum(s.total_amount), 0) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada') as total_revenue,
      ac.industry, ac.mode, ac.billing_email, ac.billing_phone,
      admin_info.full_name as admin_name, admin_info.email as admin_email, admin_info.phone as admin_phone
    from public.organizations o
    left join public.app_config ac on ac.organization_id = o.id
    left join lateral (
      select p.full_name, u.email, u.raw_user_meta_data->>'phone' as phone
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.organization_id = o.id and p.role = 'admin'
      order by p.created_date asc
      limit 1
    ) admin_info on true
    order by o.created_date desc;
end;
$$;

-- set_tenant_id (from 0002) always forces organization_id to the CALLING
-- user's own org on insert — fine for every normal write, but it would
-- break admin_send_notification below, which inserts into other orgs on
-- the platform admin's behalf. Add an explicit bypass flag, off by default
-- for every ordinary insert/update, that only this admin function sets.
create or replace function public.set_tenant_id()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_tenant_override', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.organization_id := public.current_org_id();
  elsif tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;
  end if;
  return new;
end;
$$;

-- Sends a notification (shows up in the recipients' notification bell) to
-- every member of one organization, or to every user on the platform when
-- org_id is null. Returns how many notifications were created.
create or replace function public.admin_send_notification(
  org_id uuid,
  notif_title text,
  notif_message text
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  created_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  if coalesce(trim(notif_title), '') = '' or coalesce(trim(notif_message), '') = '' then
    raise exception 'Title and message are required';
  end if;

  perform set_config('app.allow_tenant_override', 'on', true);

  insert into public.notifications (title, message, type, owner_id, created_by_id, organization_id)
  select notif_title, notif_message, 'Sistema', p.id, auth.uid(), p.organization_id
  from public.profiles p
  where p.organization_id is not null
    and (org_id is null or p.organization_id = org_id);

  get diagnostics created_count = row_count;
  return created_count;
end;
$$;
