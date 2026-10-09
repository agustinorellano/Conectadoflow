-- Configurable automations: "cuando [Oportunidad/Cliente/Venta] pasa a
-- [valor] → crear una tarea de seguimiento en N días", definidas por el
-- usuario desde Configuración en vez de hardcodeadas en el frontend (como
-- las alertas de cliente/oportunidad estancada, que siguen siendo fijas).
--
-- La ejecución vive en un trigger de Postgres, no en el frontend: así
-- dispara sin importar desde qué pantalla (o qué cliente — web hoy, lo que
-- sea mañana) se hizo el cambio, en vez de depender de que cada lugar del
-- código que actualiza stage/status se acuerde de chequear las reglas.

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  name text not null,
  is_active boolean not null default true,
  trigger_entity text not null check (trigger_entity in ('Opportunity', 'Client', 'Sale')),
  trigger_field text not null, -- 'stage' | 'status' | 'situation_status' | 'payment_status'
  trigger_value text not null, -- the value that fires the rule
  action_task_title text not null,
  action_task_description text,
  action_days_offset integer not null default 0 check (action_days_offset >= 0),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.automation_rules for each row execute function public.set_tenant_id();
alter table public.automation_rules enable row level security;

create policy "automation_rules_read" on public.automation_rules for select using (
  organization_id = public.current_org_id()
);
create policy "automation_rules_insert" on public.automation_rules for insert with check (
  organization_id is not null and organization_id = public.current_org_id()
  and public.is_manager_or_admin()
);
create policy "automation_rules_update" on public.automation_rules for update using (
  organization_id = public.current_org_id() and public.is_manager_or_admin()
);
create policy "automation_rules_delete" on public.automation_rules for delete using (
  organization_id = public.current_org_id() and public.is_manager_or_admin()
);

-- ---------------------------------------------------------------------------
-- One generic trigger function, attached to the 3 supported tables. Reads
-- the changed field dynamically (to_jsonb(NEW) ->> field) since the field
-- name is user-chosen data, not known at function-compile time. Only fires
-- on an actual change into the target value (OLD distinct from NEW), so
-- saving an Opportunity that's already in "Propuesta" doesn't spam a new
-- task every time someone edits something else on it.
--
-- The created task is an ordinary Activity (type 'Tarea', status
-- 'Pendiente', due_date = today + offset) — reuses the table and the
-- "due today" bell notification that already exist, instead of inventing
-- a parallel task system.
-- ---------------------------------------------------------------------------

create or replace function public.run_automation_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text;
  v_client_id uuid;
  v_opportunity_id uuid;
  v_client_name text;
  r record;
  v_old_val text;
  v_new_val text;
begin
  v_entity := case TG_TABLE_NAME
    when 'opportunities' then 'Opportunity'
    when 'clients' then 'Client'
    when 'sales' then 'Sale'
    else null
  end;
  if v_entity is null or NEW.organization_id is null then
    return NEW;
  end if;

  if v_entity = 'Client' then
    v_client_id := NEW.id;
    v_opportunity_id := null;
    v_client_name := NEW.name;
  elsif v_entity = 'Opportunity' then
    v_client_id := NEW.client_id;
    v_opportunity_id := NEW.id;
    v_client_name := NEW.client_name;
  elsif v_entity = 'Sale' then
    v_client_id := NEW.client_id;
    v_opportunity_id := NEW.opportunity_id;
    v_client_name := NEW.client_name;
  end if;

  for r in
    select * from public.automation_rules
    where organization_id = NEW.organization_id
      and is_active
      and trigger_entity = v_entity
  loop
    v_old_val := to_jsonb(OLD) ->> r.trigger_field;
    v_new_val := to_jsonb(NEW) ->> r.trigger_field;
    if v_new_val is not null and v_new_val = r.trigger_value and v_new_val is distinct from v_old_val then
      insert into public.activities (
        organization_id, client_id, client_name, opportunity_id, type, title, description,
        date, due_date, owner_id, owner_name, status, created_by_id
      ) values (
        NEW.organization_id, v_client_id, v_client_name, v_opportunity_id, 'Tarea',
        r.action_task_title, r.action_task_description,
        now(), (current_date + (r.action_days_offset || ' days')::interval)::date,
        NEW.owner_id, NEW.owner_name, 'Pendiente', NEW.owner_id
      );
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_automation_rules on public.opportunities;
create trigger trg_automation_rules after update on public.opportunities for each row execute function public.run_automation_rules();

drop trigger if exists trg_automation_rules on public.clients;
create trigger trg_automation_rules after update on public.clients for each row execute function public.run_automation_rules();

drop trigger if exists trg_automation_rules on public.sales;
create trigger trg_automation_rules after update on public.sales for each row execute function public.run_automation_rules();

NOTIFY pgrst, 'reload schema';
