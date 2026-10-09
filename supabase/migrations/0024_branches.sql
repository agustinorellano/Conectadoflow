-- Sucursales: un comercio puede tener más de una sucursal. Admin ve y
-- gestiona todas las sucursales de la organización; un gerente solo ve
-- las que se le asignaron explícitamente en branch_managers.

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid references public.commerces(id) on delete cascade not null,
  name text not null,
  address text,
  phone text,
  is_active boolean default true,
  organization_id uuid references public.organizations(id),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger trg_tenant before insert or update on public.branches
  for each row execute function public.set_tenant_id();

alter table public.branches enable row level security;

-- Lectura abierta a toda la organización: un vendedor necesita poder
-- elegir la sucursal al cargar una venta, no solo admin/gerente.
create policy "branches_read" on public.branches for select using (
  organization_id = public.current_org_id()
);
create policy "branches_insert" on public.branches for insert with check (
  organization_id = public.current_org_id() and public.is_admin()
);
create policy "branches_update" on public.branches for update using (
  organization_id = public.current_org_id() and public.is_admin()
);
create policy "branches_delete" on public.branches for delete using (
  organization_id = public.current_org_id() and public.is_admin()
);

-- Asignación de gerentes a sucursales (una sucursal puede tener varios
-- gerentes, un gerente puede tener varias sucursales).
create table public.branch_managers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete cascade not null,
  manager_id uuid references auth.users(id) not null,
  organization_id uuid references public.organizations(id),
  created_date timestamptz not null default now(),
  unique (branch_id, manager_id)
);

create trigger trg_tenant before insert or update on public.branch_managers
  for each row execute function public.set_tenant_id();

alter table public.branch_managers enable row level security;

-- Un gerente solo puede leer sus propias filas de asignación (para saber
-- qué sucursales ve); admin ve todas las de la organización.
create policy "branch_managers_read" on public.branch_managers for select using (
  organization_id = public.current_org_id() and (public.is_admin() or manager_id = auth.uid())
);
create policy "branch_managers_insert" on public.branch_managers for insert with check (
  organization_id = public.current_org_id() and public.is_admin()
);
create policy "branch_managers_update" on public.branch_managers for update using (
  organization_id = public.current_org_id() and public.is_admin()
);
create policy "branch_managers_delete" on public.branch_managers for delete using (
  organization_id = public.current_org_id() and public.is_admin()
);

-- Las ventas pueden atribuirse a una sucursal puntual (opcional: un
-- comercio sin sucursales cargadas sigue funcionando igual que antes).
alter table public.sales add column branch_id uuid references public.branches(id) on delete set null;

notify pgrst, 'reload schema';
