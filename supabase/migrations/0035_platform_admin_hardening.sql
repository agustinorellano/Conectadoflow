-- Panel de Administración Global — Etapa 1 (acceso y permisos).
--
-- Hallazgo de seguridad: platform_admins se creó en 0006 SIN "enable row
-- level security". A diferencia de todas las demás tablas del sistema
-- (que sí lo tienen), eso la deja expuesta por la API REST de PostgREST a
-- cualquier usuario autenticado con los grants default de Supabase — en
-- teoría, cualquiera podría insertarse a sí mismo y otorgarse acceso de
-- superadministrador. Se cierra con RLS + cero policies (mismo patrón ya
-- usado en calendar_connections/arca_tokens): ningún cliente puede
-- leer/escribir esta tabla directo, solo las funciones SECURITY DEFINER
-- de abajo (que corren con los privilegios de quien las definió, no del
-- usuario que las llama, y por eso sí pueden tocarla).
alter table public.platform_admins enable row level security;

-- Historial de auditoría de acciones administrativas sensibles del panel
-- global. Nunca se escribe desde el cliente: cada función admin_* de este
-- archivo (y las que se agreguen en etapas futuras) escribe aquí ella
-- misma. Expresamente sin columnas para contraseñas/tokens/secretos.
create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_email text not null,
  action text not null,
  target_organization_id uuid references public.organizations(id),
  target_user_id uuid references auth.users(id),
  details jsonb,
  created_date timestamptz not null default now()
);
alter table public.platform_audit_log enable row level security;
-- Sin policies: se lee únicamente a través de admin_list_audit_log().

create or replace function public.admin_list_platform_admins()
returns table (email text, granted boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query select pa.email, true from public.platform_admins pa order by pa.email;
end;
$$;

-- Otorga el rol global a un email. Reemplaza el INSERT manual por SQL que
-- se usaba hasta ahora — ya queda auditado y restringido a quien ya es
-- superadmin.
create or replace function public.admin_grant_platform_admin(target_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_email text;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  select email into caller_email from auth.users where id = auth.uid();

  insert into public.platform_admins (email) values (lower(trim(target_email)))
  on conflict (email) do nothing;

  insert into public.platform_audit_log (actor_id, actor_email, action, details)
  values (auth.uid(), caller_email, 'grant_platform_admin', jsonb_build_object('target_email', lower(trim(target_email))));
end;
$$;

-- Revoca el rol global. Nunca deja la plataforma sin ningún
-- superadministrador: si target_email es el último que queda, rechaza la
-- operación en vez de ejecutarla.
create or replace function public.admin_revoke_platform_admin(target_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_email text;
  remaining integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select count(*) into remaining from public.platform_admins where email <> lower(trim(target_email));
  if remaining = 0 then
    raise exception 'No se puede quitar: quedaría la plataforma sin ningún superadministrador';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  delete from public.platform_admins where email = lower(trim(target_email));

  insert into public.platform_audit_log (actor_id, actor_email, action, details)
  values (auth.uid(), caller_email, 'revoke_platform_admin', jsonb_build_object('target_email', lower(trim(target_email))));
end;
$$;

create or replace function public.admin_list_audit_log(limit_count integer default 100)
returns table (
  id uuid, actor_email text, action text, target_organization_id uuid,
  target_user_id uuid, details jsonb, created_date timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select l.id, l.actor_email, l.action, l.target_organization_id, l.target_user_id, l.details, l.created_date
    from public.platform_audit_log l
    order by l.created_date desc
    limit limit_count;
end;
$$;

notify pgrst, 'reload schema';
