-- Reportes e incidencias — ronda 2:
--   1) Notificar a la organización que reportó cuando el superadmin
--      cambia el estado (no existía ningún aviso, había que entrar al
--      panel para enterarse).
--   2) Chat por reporte entre esa organización y el superadmin.
--   3) Contador de pendientes para el globito de la pestaña "Reportes".

-- 1) admin_update_report_status ahora también notifica al que reportó
-- (si existe reported_by_id) cuando el nuevo estado es "En revisión" o
-- "Resuelto" — volver a "Pendiente" no genera aviso, es un caso raro de
-- revertir por error.
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

  if rep.reported_by_id is not null and p_status in ('En revisión', 'Resuelto') then
    insert into public.notifications (title, message, type, owner_id, created_by_id, organization_id)
    values (
      case when p_status = 'Resuelto' then 'Tu reporte fue resuelto' else 'Tu reporte está en revisión' end,
      rep.title || case when p_resolution_notes is not null then ': ' || p_resolution_notes else '' end,
      'Sistema', rep.reported_by_id, auth.uid(), rep.organization_id
    );
  end if;
end;
$$;

-- 2) Chat por reporte. Misma forma de tenant que support_reports — se lee
-- y se escribe normal desde el cliente si sos de esa organización
-- (base44.entities.SupportReportMessage), pero is_admin=true solo lo
-- puede setear admin_send_report_message() del lado del superadmin.
create table public.support_report_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.support_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  sender_id uuid references auth.users(id),
  sender_name text,
  is_admin boolean not null default false,
  message text not null,
  created_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.support_report_messages
  for each row execute function public.set_tenant_id();
alter table public.support_report_messages enable row level security;

create policy "support_report_messages_read" on public.support_report_messages for select using (
  organization_id = public.current_org_id()
);
-- El WITH CHECK valida que el report_id realmente pertenezca a tu propia
-- organización (trg_tenant ya fuerza organization_id, pero no cruza eso
-- contra el reporte) y que nadie se autoetiquete is_admin desde el cliente.
create policy "support_report_messages_insert" on public.support_report_messages for insert with check (
  organization_id = public.current_org_id()
  and is_admin = false
  and exists (select 1 from public.support_reports r where r.id = report_id and r.organization_id = public.current_org_id())
);

create or replace function public.admin_list_report_messages(p_report_id uuid)
returns table (id uuid, sender_name text, is_admin boolean, message text, created_date timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select m.id, m.sender_name, m.is_admin, m.message, m.created_date
    from public.support_report_messages m
    where m.report_id = p_report_id
    order by m.created_date asc;
end;
$$;

-- Responde como superadmin y avisa a quien reportó (notificación), para
-- no obligarlo a entrar a revisar si hay respuesta nueva.
create or replace function public.admin_send_report_message(p_report_id uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare
  rep record;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  if coalesce(trim(p_message), '') = '' then
    raise exception 'El mensaje no puede estar vacío';
  end if;

  select * into rep from public.support_reports where id = p_report_id;
  if rep.id is null then
    raise exception 'Reporte no encontrado';
  end if;

  insert into public.support_report_messages (report_id, organization_id, sender_id, sender_name, is_admin, message)
  values (p_report_id, rep.organization_id, auth.uid(), 'Soporte de Conectado Flow', true, p_message);

  if rep.reported_by_id is not null then
    insert into public.notifications (title, message, type, owner_id, created_by_id, organization_id)
    values ('Nueva respuesta en tu reporte', left(p_message, 200), 'Sistema', rep.reported_by_id, auth.uid(), rep.organization_id);
  end if;
end;
$$;

-- 3) Para el globito de la pestaña "Reportes" del panel global.
create or replace function public.admin_count_pending_reports()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  cnt bigint;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  select count(*) into cnt from public.support_reports where status = 'Pendiente';
  return cnt;
end;
$$;

notify pgrst, 'reload schema';
