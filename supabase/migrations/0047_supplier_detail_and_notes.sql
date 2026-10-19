-- Ficha de proveedor, al estilo de la ficha de Cliente: datos fiscales
-- (razón social / CUIT, mismos nombres de columna que clients.company /
-- clients.tax_id) y un historial de notas de lo que se va conversando
-- con cada proveedor.
alter table public.suppliers add column if not exists company text;
alter table public.suppliers add column if not exists tax_id text;

-- Tabla propia (no se reusa "activities", que es de clientes y además
-- nunca tuvo organization_id/RLS por tenant — no vale la pena heredar
-- ese hueco acá). Mismo patrón de tenant que suppliers/supplier_orders.
create table public.supplier_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  note text not null,
  created_by_id uuid references auth.users(id),
  created_by_name text,
  created_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.supplier_notes
  for each row execute function public.set_tenant_id();
alter table public.supplier_notes enable row level security;
create policy "supplier_notes_read" on public.supplier_notes for select using (organization_id = public.current_org_id());
create policy "supplier_notes_insert" on public.supplier_notes for insert with check (
  organization_id = public.current_org_id()
  and exists (select 1 from public.suppliers s where s.id = supplier_id and s.organization_id = public.current_org_id())
);
create policy "supplier_notes_delete" on public.supplier_notes for delete using (organization_id = public.current_org_id());
create index supplier_notes_supplier_idx on public.supplier_notes(supplier_id);

notify pgrst, 'reload schema';
