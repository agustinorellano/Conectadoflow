-- Panel de Administración Global — Etapa 5 (reportes e incidencias).
--
-- No existía ninguna entidad de soporte/incidencias en todo el sistema —
-- se crea de cero, como entidad normal con tenant (misma forma que
-- leads/clients/etc), para que cualquier usuario pueda reportar un
-- problema desde su propia organización, y el panel global pueda verlos
-- todos y cambiarles el estado.
create table public.support_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  reported_by_id uuid references auth.users(id),
  reported_by_name text,
  title text not null,
  description text not null,
  status text not null default 'Pendiente' check (status in ('Pendiente', 'En revisión', 'Resuelto')),
  resolution_notes text,
  resolved_by_id uuid references auth.users(id),
  resolved_date timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.support_reports
  for each row execute function public.set_tenant_id();
alter table public.support_reports enable row level security;

-- Cualquier miembro de la organización puede ver y crear los reportes de
-- SU organización (para saber si ya se resolvió lo que reportó un
-- compañero). Nadie puede cambiar el estado desde el cliente — eso es
-- solo del superadmin, vía admin_update_report_status() más abajo, así
-- queda auditado y no se puede "autorresolver" un reporte.
create policy "support_reports_read" on public.support_reports for select using (
  organization_id = public.current_org_id()
);
create policy "support_reports_insert" on public.support_reports for insert with check (
  organization_id = public.current_org_id()
);

-- Panel global: todos los reportes de todas las organizaciones, con
-- filtro de estado opcional — para la pestaña "Reportes e incidencias".
create or replace function public.admin_list_reports(p_status text default null, limit_count integer default 200)
returns table (
  id uuid, organization_id uuid, organization_name text, reported_by_name text,
  title text, description text, status text, resolution_notes text, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select r.id, r.organization_id, o.name, r.reported_by_name, r.title, r.description, r.status, r.resolution_notes, r.created_date
    from public.support_reports r
    left join public.organizations o on o.id = r.organization_id
    where p_status is null or r.status = p_status
    order by (r.status = 'Pendiente') desc, r.created_date desc
    limit limit_count;
end;
$$;

-- Ficha de organización — pestaña "Reportes e incidencias".
create or replace function public.admin_list_organization_reports(p_org_id uuid)
returns table (
  id uuid, reported_by_name text, title text, description text,
  status text, resolution_notes text, created_date timestamptz, resolved_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select r.id, r.reported_by_name, r.title, r.description, r.status, r.resolution_notes, r.created_date, r.resolved_date
    from public.support_reports r
    where r.organization_id = p_org_id
    order by (r.status = 'Pendiente') desc, r.created_date desc;
end;
$$;

-- Único camino para cambiar el estado de un reporte — queda auditado.
create or replace function public.admin_update_report_status(p_report_id uuid, p_status text, p_resolution_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_email text;
  rep record;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('Pendiente', 'En revisión', 'Resuelto') then
    raise exception 'Estado inválido';
  end if;

  select * into rep from public.support_reports where id = p_report_id;
  if rep.id is null then
    raise exception 'Reporte no encontrado';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  update public.support_reports set
    status = p_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    resolved_by_id = case when p_status = 'Resuelto' then auth.uid() else resolved_by_id end,
    resolved_date = case when p_status = 'Resuelto' then now() else null end,
    updated_date = now()
  where id = p_report_id;

  insert into public.platform_audit_log (actor_id, actor_email, action, target_organization_id, target_organization_name, details)
  values (auth.uid(), caller_email, 'update_report_status', rep.organization_id,
    (select name from public.organizations where id = rep.organization_id),
    jsonb_build_object('report_id', p_report_id, 'new_status', p_status));
end;
$$;

-- Contador de reportes pendientes por organización, para mostrar la
-- alerta visual que pedía el spec en el listado general y en la ficha.
-- Reemplaza admin_list_organizations/admin_get_organization para agregar
-- la columna sin duplicar las funciones.

drop function if exists public.admin_list_organizations(text, text, text, integer, text, text, integer, integer);

create or replace function public.admin_list_organizations(
  p_search text default null,
  p_industry text default null,
  p_mode text default null,
  p_min_users integer default null,
  p_sort text default 'created_date',
  p_sort_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid, name text, is_active boolean, created_date timestamptz,
  member_count bigint, sales_count bigint, total_revenue numeric,
  industry text, mode text, billing_email text, billing_phone text,
  admin_name text, admin_email text, admin_phone text,
  commerces_count bigint, branches_count bigint, products_count bigint,
  leads_count bigint, clients_count bigint, pending_reports_count bigint,
  total_count bigint
)
language plpgsql security definer set search_path = public as $$
declare
  sort_col text;
  sort_dir text;
  offset_rows integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  sort_col := case p_sort
    when 'name' then 'o.name'
    when 'member_count' then 'member_count'
    when 'sales_count' then 'sales_count'
    when 'total_revenue' then 'total_revenue'
    else 'o.created_date'
  end;
  sort_dir := case when lower(p_sort_dir) = 'asc' then 'asc' else 'desc' end;
  offset_rows := greatest(0, (greatest(1, p_page) - 1) * greatest(1, p_page_size));

  return query execute format($q$
    select
      o.id, o.name, o.is_active, o.created_date,
      member_count, sales_count, total_revenue,
      ac.industry, ac.mode, ac.billing_email, ac.billing_phone,
      admin_info.full_name, admin_info.email, admin_info.phone,
      commerces_count, branches_count, products_count, leads_count, clients_count, pending_reports_count,
      count(*) over() as total_count
    from public.organizations o
    left join public.app_config ac on ac.organization_id = o.id
    left join lateral (
      select p.full_name, u.email::text as email, u.raw_user_meta_data->>'phone' as phone
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.organization_id = o.id and p.role = 'admin'
      order by p.created_date asc
      limit 1
    ) admin_info on true
    left join lateral (
      select (select count(*) from public.profiles p where p.organization_id = o.id)::bigint as member_count,
        (select count(*) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada')::bigint as sales_count,
        (select coalesce(sum(s.total_amount), 0) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada') as total_revenue,
        (select count(*) from public.commerces c where c.organization_id = o.id)::bigint as commerces_count,
        (select count(*) from public.branches b where b.organization_id = o.id)::bigint as branches_count,
        (select count(*) from public.products pr where pr.organization_id = o.id)::bigint as products_count,
        (select count(*) from public.leads l where l.organization_id = o.id)::bigint as leads_count,
        (select count(*) from public.clients cl where cl.organization_id = o.id)::bigint as clients_count,
        (select count(*) from public.support_reports r where r.organization_id = o.id and r.status = 'Pendiente')::bigint as pending_reports_count
    ) counts on true
    where
      ($1 is null or o.name ilike '%%' || $1 || '%%'
        or ac.billing_email ilike '%%' || $1 || '%%'
        or admin_info.full_name ilike '%%' || $1 || '%%'
        or admin_info.email ilike '%%' || $1 || '%%')
      and ($2 is null or ac.industry = $2)
      and ($3 is null or ac.mode = $3)
      and ($4 is null or member_count >= $4)
    order by %s %s
    limit %s offset %s
  $q$, sort_col, sort_dir, greatest(1, p_page_size), offset_rows)
  using p_search, p_industry, p_mode, p_min_users;
end;
$$;

create or replace function public.admin_get_organization(p_org_id uuid)
returns table (
  id uuid, name text, is_active boolean, created_date timestamptz,
  company_name text, industry text, mode text, sale_type text, sell_to text,
  currency text, tax_rate numeric, monthly_goal numeric,
  billing_name text, billing_tax_id text, billing_address text,
  billing_phone text, billing_email text, billing_type text,
  member_count bigint, sales_count bigint, total_revenue numeric,
  commerces_count bigint, branches_count bigint, products_count bigint,
  leads_count bigint, clients_count bigint, pending_reports_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select
      o.id, o.name, o.is_active, o.created_date,
      ac.company_name, ac.industry, ac.mode, ac.sale_type, ac.sell_to,
      ac.currency, ac.tax_rate, ac.monthly_goal,
      ac.billing_name, ac.billing_tax_id, ac.billing_address,
      ac.billing_phone, ac.billing_email, ac.billing_type,
      (select count(*) from public.profiles p where p.organization_id = o.id)::bigint,
      (select count(*) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada')::bigint,
      (select coalesce(sum(s.total_amount), 0) from public.sales s where s.organization_id = o.id and s.status <> 'Cancelada'),
      (select count(*) from public.commerces c where c.organization_id = o.id)::bigint,
      (select count(*) from public.branches b where b.organization_id = o.id)::bigint,
      (select count(*) from public.products pr where pr.organization_id = o.id)::bigint,
      (select count(*) from public.leads l where l.organization_id = o.id)::bigint,
      (select count(*) from public.clients cl where cl.organization_id = o.id)::bigint,
      (select count(*) from public.support_reports r where r.organization_id = o.id and r.status = 'Pendiente')::bigint
    from public.organizations o
    left join public.app_config ac on ac.organization_id = o.id
    where o.id = p_org_id;
end;
$$;

notify pgrst, 'reload schema';
