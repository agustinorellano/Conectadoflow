-- Dos secciones nuevas pedidas por el usuario:
--   1) "Proveedores" — seguimiento día a día de pedidos, pagos y envíos.
--   2) "Costos" — gastos operativos (Alquiler, Luz, Personal, etc.) para
--      un widget de ganancia real (Ventas - gastos), separado a propósito
--      de lo que se paga a proveedores (son dos cosas distintas, no se
--      suman entre sí para no duplicar).
-- Mismo patrón de tenant que el resto de las entidades (products/leads/
-- clients): trg_tenant + RLS por organization_id. created_by_id está
-- desde el arranque en las tres tablas — makeEntity.create() siempre lo
-- manda, y faltarlo es el bug recurrente que ya pasó dos veces con
-- support_reports/support_report_messages (PGRST204).

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  contact_name text,
  phone text,
  email text,
  category text,
  notes text,
  is_active boolean not null default true,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.suppliers
  for each row execute function public.set_tenant_id();
alter table public.suppliers enable row level security;
create policy "suppliers_read" on public.suppliers for select using (organization_id = public.current_org_id());
create policy "suppliers_insert" on public.suppliers for insert with check (organization_id = public.current_org_id());
create policy "suppliers_update" on public.suppliers for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "suppliers_delete" on public.suppliers for delete using (organization_id = public.current_org_id());
create index suppliers_org_idx on public.suppliers(organization_id);

-- Pedidos a cada proveedor. status (entrega) y payment_status (pago) son
-- independientes a propósito: un pedido puede estar Recibido pero todavía
-- Pendiente de pago, o pagado por adelantado antes de llegar.
create table public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  description text not null,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Recibido')),
  payment_status text not null default 'Pendiente' check (payment_status in ('Pendiente', 'Parcial', 'Pagado')),
  paid_amount numeric not null default 0,
  order_date date not null default current_date,
  expected_date date,
  received_date timestamptz,
  tracking_info text,
  notes text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.supplier_orders
  for each row execute function public.set_tenant_id();
alter table public.supplier_orders enable row level security;
create policy "supplier_orders_read" on public.supplier_orders for select using (organization_id = public.current_org_id());
-- El WITH CHECK valida que el proveedor elegido sea de la propia
-- organización (trg_tenant solo fuerza el organization_id del pedido,
-- no cruza contra el proveedor referenciado).
create policy "supplier_orders_insert" on public.supplier_orders for insert with check (
  organization_id = public.current_org_id()
  and exists (select 1 from public.suppliers s where s.id = supplier_id and s.organization_id = public.current_org_id())
);
create policy "supplier_orders_update" on public.supplier_orders for update using (organization_id = public.current_org_id()) with check (
  organization_id = public.current_org_id()
  and exists (select 1 from public.suppliers s where s.id = supplier_id and s.organization_id = public.current_org_id())
);
create policy "supplier_orders_delete" on public.supplier_orders for delete using (organization_id = public.current_org_id());
create index supplier_orders_org_idx on public.supplier_orders(organization_id);
create index supplier_orders_supplier_idx on public.supplier_orders(supplier_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  category text not null,
  description text,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  expense_date date not null default current_date,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.expenses
  for each row execute function public.set_tenant_id();
alter table public.expenses enable row level security;
create policy "expenses_read" on public.expenses for select using (organization_id = public.current_org_id());
create policy "expenses_insert" on public.expenses for insert with check (organization_id = public.current_org_id());
create policy "expenses_update" on public.expenses for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "expenses_delete" on public.expenses for delete using (organization_id = public.current_org_id());
create index expenses_org_idx on public.expenses(organization_id);

notify pgrst, 'reload schema';
