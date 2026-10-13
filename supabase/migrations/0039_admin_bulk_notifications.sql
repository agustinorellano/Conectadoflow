-- Panel de Administración Global — Etapa 6 (notificaciones masivas).
--
-- admin_send_notification(org_id uuid, ...) solo podía mandar a "todas"
-- (org_id null) o a una sola organización — no había forma de elegir un
-- grupo armado con los filtros del listado (Etapa 2). Se reemplaza por
-- una versión que recibe un array de organization_id: null sigue siendo
-- "todas" (broadcast), un array de 1 es "una sola", y un array de varias
-- es el grupo. Además, antes de enviar de verdad, admin_count_notification_targets()
-- permite mostrar cuántas organizaciones/usuarios van a recibirla —
-- el resumen previo que pedía el spec. El envío queda auditado.

drop function if exists public.admin_send_notification(uuid, text, text);

create or replace function public.admin_count_notification_targets(org_ids uuid[] default null)
returns table (org_count bigint, user_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select
      (select count(distinct o.id) from public.organizations o
        where org_ids is null or o.id = any(org_ids))::bigint,
      (select count(*) from public.profiles p
        where p.organization_id is not null
          and (org_ids is null or p.organization_id = any(org_ids)))::bigint;
end;
$$;

create or replace function public.admin_send_notification(
  org_ids uuid[],
  notif_title text,
  notif_message text
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  created_count integer;
  caller_email text;
  org_count integer;
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
    and (org_ids is null or p.organization_id = any(org_ids));

  get diagnostics created_count = row_count;

  select count(*) into org_count from public.organizations o where org_ids is null or o.id = any(org_ids);
  select email into caller_email from auth.users where id = auth.uid();

  -- "Creada" es exacto acá: insertar la fila es lo que la hace aparecer en
  -- la campana de notificaciones del destinatario — no es una cola
  -- asincrónica que podría fallar después, así que no hay un estado
  -- "entregada" distinto para registrar.
  insert into public.platform_audit_log (actor_id, actor_email, action, details)
  values (auth.uid(), caller_email, 'send_notification',
    jsonb_build_object('title', notif_title, 'org_ids', org_ids, 'org_count', org_count, 'recipient_count', created_count));

  return created_count;
end;
$$;

notify pgrst, 'reload schema';
