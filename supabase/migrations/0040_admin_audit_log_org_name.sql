-- Panel de Administración Global — Etapa 7 (permisos globales).
--
-- admin_list_audit_log() (Etapa 1) no devolvía target_organization_name
-- (esa columna se agregó recién en la Etapa 3, en la tabla, no en esta
-- función) — la pestaña "Permisos" la necesita para mostrar a qué
-- organización corresponde cada entrada del historial sin una consulta
-- aparte.
drop function if exists public.admin_list_audit_log(integer);

create or replace function public.admin_list_audit_log(limit_count integer default 100)
returns table (
  id uuid, actor_email text, action text, target_organization_id uuid,
  target_organization_name text, target_user_id uuid, details jsonb, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select l.id, l.actor_email, l.action, l.target_organization_id, l.target_organization_name,
      l.target_user_id, l.details, l.created_date
    from public.platform_audit_log l
    order by l.created_date desc
    limit limit_count;
end;
$$;

notify pgrst, 'reload schema';
