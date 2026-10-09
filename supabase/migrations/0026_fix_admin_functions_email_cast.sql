-- admin_list_organizations/admin_list_users leen auth.users.email, que en
-- Supabase es "character varying", no "text" — eso choca contra el "text"
-- declarado en returns table y Postgres tira "structure of query does not
-- match function result type" al ejecutarlas. Se arregla con un cast
-- explícito a text en cada lectura de auth.users.email.

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
      admin_info.full_name as admin_name, admin_info.email::text as admin_email, admin_info.phone as admin_phone
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
    select p.id, u.email::text, p.full_name, p.role, p.organization_id, o.name, p.created_date
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.organizations o on o.id = p.organization_id
    order by p.created_date desc;
end;
$$;

notify pgrst, 'reload schema';
