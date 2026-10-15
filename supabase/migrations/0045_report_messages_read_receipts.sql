-- Confirmación de lectura para el chat de reportes/incidencias: cada
-- mensaje suma read_at (null hasta que el destinatario lo lee). No se
-- expone un UPDATE genérico desde el cliente (dejaría que un usuario de
-- la organización reescriba is_admin/message de cualquier fila con
-- organization_id = la suya) — dos funciones puntuales, cada una solo
-- toca read_at y solo del lado que le corresponde.
alter table public.support_report_messages add column if not exists read_at timestamptz;

-- Lado organización: marca como leídos los mensajes del soporte
-- (is_admin = true) de un reporte propio.
create or replace function public.mark_report_messages_read(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.support_report_messages
  set read_at = now()
  where report_id = p_report_id
    and organization_id = public.current_org_id()
    and is_admin = true
    and read_at is null;
end;
$$;

-- Lado superadmin: marca como leídos los mensajes que mandó la
-- organización (is_admin = false) en ese reporte.
create or replace function public.admin_mark_report_messages_read(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  update public.support_report_messages
  set read_at = now()
  where report_id = p_report_id
    and is_admin = false
    and read_at is null;
end;
$$;

-- admin_list_report_messages ahora también devuelve read_at, para pintar
-- el doble check en el panel del superadmin — cambia las columnas de
-- salida, así que hace falta el DROP antes del CREATE OR REPLACE.
drop function if exists public.admin_list_report_messages(uuid);

create or replace function public.admin_list_report_messages(p_report_id uuid)
returns table (id uuid, sender_name text, is_admin boolean, message text, created_date timestamptz, read_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select m.id, m.sender_name, m.is_admin, m.message, m.created_date, m.read_at
    from public.support_report_messages m
    where m.report_id = p_report_id
    order by m.created_date asc;
end;
$$;

notify pgrst, 'reload schema';
