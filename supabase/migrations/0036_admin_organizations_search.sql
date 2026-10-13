-- Panel de Administración Global — Etapa 2 (listado de organizaciones).
--
-- Reemplaza admin_list_organizations() (que traía TODAS las organizaciones
-- sin búsqueda, filtros, orden ni paginación — SuperAdmin.jsx las cargaba
-- todas de una) por una versión que acepta búsqueda combinada con filtros,
-- ordenamiento y paginación real, y que además suma los contadores que
-- pedía el spec: comercios, sucursales, productos, y leads/clientes
-- (mostrados por separado, no como una sola métrica de "contactos").
--
-- "Existencia de reportes pendientes" (parte del spec de esta etapa) queda
-- deliberadamente afuera: no existe ninguna entidad de reportes/incidencias
-- en todo el sistema todavía — se agrega en la Etapa 5, cuando esa entidad
-- exista. Mostrar un contador en 0 ahora sería inventar un dato.

drop function if exists public.admin_list_organizations();

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
  leads_count bigint, clients_count bigint,
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

  -- Whitelist explícito: p_sort/p_sort_dir vienen del cliente y van a un
  -- ORDER BY dinámico — nunca se interpolan directo, para no abrir la
  -- puerta a SQL injection vía estos parámetros.
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
      commerces_count, branches_count, products_count, leads_count, clients_count,
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
        (select count(*) from public.clients cl where cl.organization_id = o.id)::bigint as clients_count
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

notify pgrst, 'reload schema';
