-- Panel de Administración Global — Etapa 3 (ficha detallada de organización).
--
-- Antes de agregar nada: platform_audit_log.target_organization_id tenía
-- FK a organizations(id) sin "on delete", es decir NO ACTION — si alguna
-- vez se registra una auditoría de "se eliminó la organización X" y
-- después se borra esa fila de organizations, Postgres iba a rechazar el
-- propio delete_organization() por violar esa FK. Se cambia a "on delete
-- set null" y se agrega una columna de snapshot del nombre, para que el
-- historial siga siendo legible aunque la organización ya no exista.
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.platform_audit_log'::regclass
    and confrelid = 'public.organizations'::regclass
    and contype = 'f';
  if fk_name is not null then
    execute format('alter table public.platform_audit_log drop constraint %I', fk_name);
  end if;
end $$;

alter table public.platform_audit_log
  add constraint platform_audit_log_target_organization_id_fkey
  foreign key (target_organization_id) references public.organizations(id) on delete set null;

alter table public.platform_audit_log add column if not exists target_organization_name text;

-- A partir de ahora, las dos acciones administrativas que ya existían
-- (suspender/activar y eliminar una organización) quedan auditadas —
-- hasta ahora no escribían nada en platform_audit_log.

create or replace function public.admin_set_organization_active(org_id uuid, active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_email text;
  org_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  select email into caller_email from auth.users where id = auth.uid();
  select name into org_name from public.organizations where id = org_id;

  update public.organizations set is_active = active where id = org_id;

  insert into public.platform_audit_log (actor_id, actor_email, action, target_organization_id, target_organization_name, details)
  values (auth.uid(), caller_email, case when active then 'activate_organization' else 'suspend_organization' end,
    org_id, org_name, jsonb_build_object('is_active', active));
end;
$$;

create or replace function public.delete_organization(org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_profile record;
  caller_email text;
  org_name text;
  t text;
  org_tables text[] := array[
    'payments','sales','client_documents','documents','meetings','activities',
    'opportunities','leads','clients','products','branch_managers','branches',
    'commerces','pipeline_stages','message_templates','document_templates',
    'document_counters','automation_rules','custom_field_definitions',
    'calendar_connections','payment_entities','client_payment_methods',
    'goals','notifications','app_config'
  ];
begin
  select role, organization_id into caller_profile from public.profiles where id = auth.uid();

  if not (
    public.is_platform_admin()
    or (caller_profile.role = 'admin' and caller_profile.organization_id = org_id)
  ) then
    raise exception 'Not authorized';
  end if;

  if org_id is null then
    raise exception 'org_id is required';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select name into org_name from public.organizations where id = org_id;

  -- Se registra ANTES de borrar: después de la Etapa 3 esta fila ya no
  -- pierde la referencia (on delete set null), pero el nombre viaja
  -- aparte como snapshot para que el historial siga siendo legible.
  insert into public.platform_audit_log (actor_id, actor_email, action, target_organization_id, target_organization_name)
  values (auth.uid(), caller_email, 'delete_organization', org_id, org_name);

  foreach t in array org_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where organization_id = $1', t) using org_id;
    end if;
  end loop;

  update public.organizations set created_by_id = null where id = org_id;

  delete from auth.users where id in (
    select id from public.profiles where organization_id = org_id
  );

  delete from public.organizations where id = org_id;
end;
$$;

-- admin_list_audit_log() (Etapa 1) ya existe para el historial global;
-- esta variante filtra por organización, para la pestaña "Historial de
-- modificaciones" de la ficha.
create or replace function public.admin_list_organization_audit_log(p_org_id uuid, limit_count integer default 50)
returns table (
  id uuid, actor_email text, action text, target_user_id uuid, details jsonb, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select l.id, l.actor_email, l.action, l.target_user_id, l.details, l.created_date
    from public.platform_audit_log l
    where l.target_organization_id = p_org_id
    order by l.created_date desc
    limit limit_count;
end;
$$;

-- Ficha — pestaña "Resumen" + "Información general": una fila con todo
-- el perfil de la organización más los contadores de actividad.
create or replace function public.admin_get_organization(p_org_id uuid)
returns table (
  id uuid, name text, is_active boolean, created_date timestamptz,
  company_name text, industry text, mode text, sale_type text, sell_to text,
  currency text, tax_rate numeric, monthly_goal numeric,
  billing_name text, billing_tax_id text, billing_address text,
  billing_phone text, billing_email text, billing_type text,
  member_count bigint, sales_count bigint, total_revenue numeric,
  commerces_count bigint, branches_count bigint, products_count bigint,
  leads_count bigint, clients_count bigint
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
      (select count(*) from public.clients cl where cl.organization_id = o.id)::bigint
    from public.organizations o
    left join public.app_config ac on ac.organization_id = o.id
    where o.id = p_org_id;
end;
$$;

-- Pestaña "Usuarios y administradores": admins primero, después el resto
-- por fecha de alta. "Estado de la cuenta" no existe como campo propio en
-- profiles todavía (solo organizations.is_active a nivel organización) —
-- se deja afuera en vez de inventarlo.
create or replace function public.admin_list_organization_members(p_org_id uuid)
returns table (
  id uuid, email text, full_name text, phone text, role text, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, u.email::text, p.full_name, u.raw_user_meta_data->>'phone', p.role, p.created_date
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.organization_id = p_org_id
    order by (p.role = 'admin') desc, p.created_date asc;
end;
$$;

-- Pestaña "Comercios y sucursales".
create or replace function public.admin_list_organization_commerces(p_org_id uuid)
returns table (
  id uuid, name text, industry text, address text, phone text, email text,
  is_active boolean, branches_count bigint, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select c.id, c.name, c.industry, c.address, c.phone, c.email, c.is_active,
      (select count(*) from public.branches b where b.commerce_id = c.id)::bigint,
      c.created_date
    from public.commerces c
    where c.organization_id = p_org_id
    order by c.created_date asc;
end;
$$;

create or replace function public.admin_list_organization_branches(p_org_id uuid)
returns table (
  id uuid, name text, commerce_name text, address text, phone text, is_active boolean, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select b.id, b.name, c.name, b.address, b.phone, b.is_active, b.created_date
    from public.branches b
    left join public.commerces c on c.id = b.commerce_id
    where b.organization_id = p_org_id
    order by b.created_date asc;
end;
$$;

-- Pestaña "Productos y servicios".
create or replace function public.admin_list_organization_products(p_org_id uuid)
returns table (
  id uuid, name text, kind text, category text, price numeric, commerce_name text, is_active boolean, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select pr.id, pr.name, pr.kind, pr.category, pr.price, c.name, pr.is_active, pr.created_date
    from public.products pr
    left join public.commerces c on c.id = pr.commerce_id
    where pr.organization_id = p_org_id
    order by pr.created_date desc;
end;
$$;

-- Pestaña "Facturación": se definió que "factura emitida" = toda venta
-- registrada (sales), haya o no CAE de ARCA (la mayoría de orgs no usa
-- ARCA todavía).
create or replace function public.admin_list_organization_sales(p_org_id uuid, limit_count integer default 200)
returns table (
  id uuid, number text, client_name text, date date, total_amount numeric,
  status text, arca_status text, arca_cae text, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select s.id, s.number, s.client_name, s.date, s.total_amount, s.status, s.arca_status, s.arca_cae, s.created_date
    from public.sales s
    where s.organization_id = p_org_id
    order by s.date desc
    limit limit_count;
end;
$$;

-- Pestaña "Contactos y actividad": leads y clientes por separado, como
-- entidades distintas que son (no una sola métrica de "contactos").
create or replace function public.admin_list_organization_leads(p_org_id uuid, limit_count integer default 200)
returns table (
  id uuid, full_name text, company text, phone text, email text, source text, status text, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select l.id, trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')), l.company, l.phone, l.email, l.source, l.status, l.created_date
    from public.leads l
    where l.organization_id = p_org_id
    order by l.created_date desc
    limit limit_count;
end;
$$;

create or replace function public.admin_list_organization_clients(p_org_id uuid, limit_count integer default 200)
returns table (
  id uuid, name text, company text, phone text, email text, status text, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select cl.id, cl.name, cl.company, cl.phone, cl.email, cl.status, cl.created_date
    from public.clients cl
    where cl.organization_id = p_org_id
    order by cl.created_date desc
    limit limit_count;
end;
$$;

notify pgrst, 'reload schema';
