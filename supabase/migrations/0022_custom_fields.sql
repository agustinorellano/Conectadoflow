-- Campos personalizados por organización: cada negocio define sus propios
-- datos extra en Clientes, Leads y Productos (ej. "talle preferido" en
-- indumentaria, "apto celíaco" en gastronomía) sin que haga falta tocar el
-- schema. Mismo criterio que automation_rules/document_templates: una
-- tabla de "definiciones" (qué campos existen) + los valores reales viven
-- en una columna jsonb en la fila dueña, para heredar automáticamente la
-- RLS que ya protege esa fila en vez de inventar una tabla EAV con
-- políticas propias.
--
-- Los valores se guardan en custom_fields con clave = custom_field_definitions.id
-- (no el label) — así renombrar un campo no pierde ni reescribe los datos
-- ya cargados.

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  entity text not null check (entity in ('Client', 'Lead', 'Product')),
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'select', 'boolean')),
  options jsonb not null default '[]', -- array of strings, only used when field_type = 'select'
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order numeric not null default 0,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.custom_field_definitions for each row execute function public.set_tenant_id();
alter table public.custom_field_definitions enable row level security;

create policy "custom_field_definitions_read" on public.custom_field_definitions for select using (
  organization_id = public.current_org_id()
);
create policy "custom_field_definitions_insert" on public.custom_field_definitions for insert with check (
  organization_id is not null and organization_id = public.current_org_id()
  and public.is_manager_or_admin()
);
create policy "custom_field_definitions_update" on public.custom_field_definitions for update using (
  organization_id = public.current_org_id() and public.is_manager_or_admin()
);
create policy "custom_field_definitions_delete" on public.custom_field_definitions for delete using (
  organization_id = public.current_org_id() and public.is_manager_or_admin()
);

alter table public.clients add column if not exists custom_fields jsonb not null default '{}';
alter table public.leads add column if not exists custom_fields jsonb not null default '{}';
alter table public.products add column if not exists custom_fields jsonb not null default '{}';

NOTIFY pgrst, 'reload schema';
