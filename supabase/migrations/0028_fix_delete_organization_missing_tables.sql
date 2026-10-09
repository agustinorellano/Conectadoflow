-- delete_organization() asumía que TODAS las tablas de features opcionales
-- (automation_rules, custom_field_definitions, branches, etc.) ya existían
-- en esta base — pero varias migraciones de este proyecto quedaron sin
-- aplicarse en producción en su momento, así que la tabla puede no existir
-- todavía. Reescribe el borrado como un loop dinámico que primero chequea
-- si la tabla existe (to_regclass) y si no, la saltea en silencio, en vez
-- de explotar con "relation does not exist" a mitad de camino (dejando la
-- organización a medio borrar).
create or replace function public.delete_organization(org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_profile record;
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

  foreach t in array org_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where organization_id = $1', t) using org_id;
    end if;
  end loop;

  delete from auth.users where id in (
    select id from public.profiles where organization_id = org_id
  );

  delete from public.organizations where id = org_id;
end;
$$;

notify pgrst, 'reload schema';
