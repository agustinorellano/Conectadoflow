-- "Eliminar organización" desde Configuración estaba demasiado accesible
-- (un botón rojo siempre visible) y no pedía ningún motivo de baja. Se
-- suma un parámetro opcional de motivo a delete_organization() — agregar
-- un parámetro con default al final es compatible con CREATE OR REPLACE,
-- no hace falta DROP — que queda registrado en el historial de auditoría
-- ya existente. El resto del endurecimiento (pestaña "Zona peligrosa"
-- colapsada, paso de motivo, checkbox extra) es solo de UI, en Settings.jsx
-- y DeleteOrganizationModal.jsx.
create or replace function public.delete_organization(org_id uuid, p_reason text default null)
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

  insert into public.platform_audit_log (actor_id, actor_email, action, target_organization_id, target_organization_name, details)
  values (auth.uid(), caller_email, 'delete_organization', org_id, org_name,
    case when p_reason is not null then jsonb_build_object('reason', p_reason) else null end);

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

notify pgrst, 'reload schema';
