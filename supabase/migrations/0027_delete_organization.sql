-- 1) Arreglar una condición de carrera en create_organization(): el chequeo
--    "¿ya tiene organización?" y el insert no estaban en la misma fila
--    bloqueada, así que dos llamadas simultáneas (ej. doble click en
--    "Empezar" del onboarding, o un reintento de red) podían pasar las dos
--    el chequeo antes de que cualquiera confirmara, creando dos
--    organizaciones para el mismo usuario. "select ... for update" bloquea
--    la fila del perfil durante la transacción: la segunda llamada queda
--    esperando a la primera y, al reintentar, ya ve la organización puesta.
create or replace function public.create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  existing uuid;
begin
  select organization_id into existing from public.profiles where id = auth.uid() for update;
  if existing is not null then
    raise exception 'User already belongs to an organization';
  end if;

  insert into public.organizations (name, created_by_id) values (org_name, auth.uid())
    returning id into new_org_id;

  perform set_config('app.allow_profile_org_change', 'on', true);
  update public.profiles set organization_id = new_org_id, role = 'admin' where id = auth.uid();

  return new_org_id;
end;
$$;

-- 2) Eliminar una organización completa — datos, miembros y sus cuentas de
--    login. Lo puede llamar el admin de la plataforma (cualquier
--    organización) o el admin de esa propia organización (solo la suya):
--    "elimina tu organización" es una función normal de cualquier SaaS, y
--    acá además sirve para que cada equipo pueda limpiar una cuenta de
--    prueba sin depender de vos.
--
-- Orden de borrado: sales antes que clients (sales.client_id es "on delete
-- restrict", el resto de las tablas que cuelgan de clients son cascade o
-- set null). Todo lo demás no tiene restricciones entre sí, así que el
-- orden no importa. Termina borrando auth.users de los miembros — eso
-- cascadea a profiles (profiles.id referencia auth.users on delete
-- cascade) — y por último la fila de organizations.
create or replace function public.delete_organization(org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_profile record;
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

  delete from public.payments where organization_id = org_id;
  delete from public.sales where organization_id = org_id;
  delete from public.client_documents where organization_id = org_id;
  delete from public.documents where organization_id = org_id;
  delete from public.meetings where organization_id = org_id;
  delete from public.activities where organization_id = org_id;
  delete from public.opportunities where organization_id = org_id;
  delete from public.leads where organization_id = org_id;
  delete from public.clients where organization_id = org_id;
  delete from public.products where organization_id = org_id;
  delete from public.branch_managers where organization_id = org_id;
  delete from public.branches where organization_id = org_id;
  delete from public.commerces where organization_id = org_id;
  delete from public.pipeline_stages where organization_id = org_id;
  delete from public.message_templates where organization_id = org_id;
  delete from public.document_templates where organization_id = org_id;
  delete from public.document_counters where organization_id = org_id;
  delete from public.automation_rules where organization_id = org_id;
  delete from public.custom_field_definitions where organization_id = org_id;
  delete from public.calendar_connections where organization_id = org_id;
  delete from public.payment_entities where organization_id = org_id;
  delete from public.client_payment_methods where organization_id = org_id;
  delete from public.goals where organization_id = org_id;
  delete from public.notifications where organization_id = org_id;
  delete from public.app_config where organization_id = org_id;

  -- Borra las cuentas de login de los miembros — cascadea a profiles.
  delete from auth.users where id in (
    select id from public.profiles where organization_id = org_id
  );

  delete from public.organizations where id = org_id;
end;
$$;

notify pgrst, 'reload schema';
