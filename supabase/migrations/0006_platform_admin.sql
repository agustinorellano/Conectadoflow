-- Conectado Flow — platform-wide super-admin.
-- A small panel for the SaaS owner to see every organization/user that
-- signs up, independent of each organization's own Team page (which only
-- ever sees members of its own org, by design — RLS keeps it that way).
-- These functions are the only place allowed to read across organizations,
-- and each one re-checks is_platform_admin() itself before returning anything.

create table public.platform_admins (
  email text primary key
);

-- Seed the platform owner. To add another platform admin later, run:
--   insert into public.platform_admins (email) values ('someone@email.com');
insert into public.platform_admins (email) values ('agustinorellanogomez@gmail.com');

alter table public.organizations add column is_active boolean not null default true;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins pa
    join auth.users u on lower(u.email) = lower(pa.email)
    where u.id = auth.uid()
  );
$$;

create or replace function public.admin_list_organizations()
returns table (
  id uuid, name text, is_active boolean, created_date timestamptz,
  member_count bigint, sales_count bigint, total_revenue numeric
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select o.id, o.name, o.is_active, o.created_date,
      (select count(*) from public.profiles p where p.organization_id = o.id)::bigint as member_count,
      (select count(*) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada')::bigint as sales_count,
      (select coalesce(sum(s.total_amount), 0) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada') as total_revenue
    from public.organizations o
    order by o.created_date desc;
end;
$$;

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, full_name text, role text,
  organization_id uuid, organization_name text, created_date timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, u.email, p.full_name, p.role, p.organization_id, o.name, p.created_date
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.organizations o on o.id = p.organization_id
    order by p.created_date desc;
end;
$$;

create or replace function public.admin_set_organization_active(org_id uuid, active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  update public.organizations set is_active = active where id = org_id;
end;
$$;
