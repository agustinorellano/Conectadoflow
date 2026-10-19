-- Gastos recurrentes: el usuario arma una "plantilla" (categoría, monto,
-- día del mes) para costos que se repiten todos los meses (alquiler,
-- luz, sueldos, etc.) en vez de cargarlos a mano cada vez. El monto de
-- la plantilla se puede actualizar cuando cambia el precio — eso no
-- toca los gastos ya cargados de meses anteriores, solo los que se
-- generen de ahí en adelante. No hay cron: cada gasto real del mes se
-- genera con un click desde la UI cuando el usuario entra a Costos y
-- todavía no se cargó ese mes (ver recurring_expense_id en expenses).
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  category text not null,
  description text,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  day_of_month integer not null default 1 check (day_of_month between 1 and 28),
  is_active boolean not null default true,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.recurring_expenses
  for each row execute function public.set_tenant_id();
alter table public.recurring_expenses enable row level security;
create policy "recurring_expenses_read" on public.recurring_expenses for select using (organization_id = public.current_org_id());
create policy "recurring_expenses_insert" on public.recurring_expenses for insert with check (organization_id = public.current_org_id());
create policy "recurring_expenses_update" on public.recurring_expenses for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "recurring_expenses_delete" on public.recurring_expenses for delete using (organization_id = public.current_org_id());
create index recurring_expenses_org_idx on public.recurring_expenses(organization_id);

-- Vínculo opcional: qué plantilla generó cada gasto real, para saber
-- qué meses ya se cargaron y no duplicar/repetir el aviso.
alter table public.expenses add column if not exists recurring_expense_id uuid references public.recurring_expenses(id) on delete set null;

notify pgrst, 'reload schema';
