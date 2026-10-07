-- Real 4-role permission model: Administrador / Gerente / Vendedor /
-- Consulta, replacing the old admin/user-only distinction with actual
-- RLS enforcement (not just hiding things in the UI).
--
--   admin   (Administrador): full access, same as before.
--   manager (Gerente):       sees/manages the whole org like admin, but
--                             can't touch billing-sensitive config or
--                             invite/change roles.
--   user    (Vendedor):      only sees their OWN leads/clients/
--                             opportunities/sales/meetings/activities/
--                             documents (owner_id = auth.uid()), not the
--                             whole org's. No access to Cobros beyond
--                             payments tied to their own sales (so their
--                             own Ventas page keeps showing payment
--                             plans), and can't write to products.
--   viewer  (Consulta):      reads everything org-wide like admin/
--                             manager, but can never insert/update/
--                             delete anything.
--
-- Analytics/Reportes/Equipo/Configuración restrictions for Vendedor/
-- Consulta are enforced in the frontend (see src/lib/roles.js), not
-- here: those pages have no dedicated table of their own to lock down —
-- they read the same sales/leads data Ventas/Pipeline legitimately need,
-- so blocking the underlying rows would break those pages too. The
-- owner-scoping below already keeps a Vendedor's own Analytics-equivalent
-- numbers limited to their own cartera even if they reached the page.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','manager','user','viewer'));

-- Widen the invite-assignment function (0010) to accept all 4 roles.
create or replace function public.admin_assign_invited_profile(target_user_id uuid, org_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('admin', 'manager', 'user', 'viewer') then
    raise exception 'Invalid role: %', new_role;
  end if;
  perform set_config('app.allow_profile_org_change', 'on', true);
  update public.profiles set organization_id = org_id, role = new_role where id = target_user_id;
end;
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin', 'manager');
$$;

-- Owner-scoped CRUD for the "cartera" tables: admin/manager/viewer see
-- every row in the org; a plain 'user' (vendedor) only sees/touches rows
-- they own; 'viewer' can read but never write.
do $$
declare
  t text;
  owned_tables text[] := array['clients','leads','opportunities','sales','activities','meetings','documents'];
begin
  foreach t in array owned_tables loop
    execute format('drop policy if exists "%1$s_read" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);

    execute format($f$create policy "%1$s_read" on public.%1$s for select using (
      organization_id = public.current_org_id()
      and (public.current_role() <> 'user' or owner_id = auth.uid())
    )$f$, t);

    execute format($f$create policy "%1$s_insert" on public.%1$s for insert with check (
      organization_id is not null and organization_id = public.current_org_id()
      and public.current_role() <> 'viewer'
    )$f$, t);

    execute format($f$create policy "%1$s_update" on public.%1$s for update using (
      organization_id = public.current_org_id()
      and (public.is_manager_or_admin() or (public.current_role() = 'user' and owner_id = auth.uid()))
    )$f$, t);

    execute format($f$create policy "%1$s_delete" on public.%1$s for delete using (
      organization_id = public.current_org_id()
      and public.current_role() <> 'viewer'
      and (created_by_id = auth.uid() or public.is_manager_or_admin())
    )$f$, t);
  end loop;
end $$;

-- Cobros: admin/manager see every payment in the org; a vendedor only
-- sees payments tied to a sale they own (needed so their own Ventas page
-- keeps showing payment plans); viewer sees none (matches "sin acceso").
drop policy if exists "payments_read" on public.payments;
create policy "payments_read" on public.payments for select using (
  organization_id = public.current_org_id()
  and (
    public.is_manager_or_admin()
    or exists (select 1 from public.sales s where s.id = payments.sale_id and s.owner_id = auth.uid())
  )
);

drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments for insert with check (
  organization_id is not null and organization_id = public.current_org_id()
  and public.current_role() <> 'viewer'
);

drop policy if exists "payments_update" on public.payments;
create policy "payments_update" on public.payments for update using (
  organization_id = public.current_org_id()
  and (
    public.is_manager_or_admin()
    or exists (select 1 from public.sales s where s.id = payments.sale_id and s.owner_id = auth.uid())
  )
);

drop policy if exists "payments_delete" on public.payments;
create policy "payments_delete" on public.payments for delete using (
  organization_id = public.current_org_id()
  and (
    public.is_manager_or_admin()
    or exists (select 1 from public.sales s where s.id = payments.sale_id and s.owner_id = auth.uid())
  )
);

-- Products: a shared catalog, not per-owner — only admin writes it,
-- everyone in the org (including viewer) keeps reading it.
drop policy if exists "products_insert" on public.products;
create policy "products_insert" on public.products for insert with check (
  organization_id is not null and organization_id = public.current_org_id() and public.is_admin()
);
drop policy if exists "products_update" on public.products;
create policy "products_update" on public.products for update using (
  organization_id = public.current_org_id() and public.is_admin()
);
drop policy if exists "products_delete" on public.products;
create policy "products_delete" on public.products for delete using (
  organization_id = public.current_org_id() and public.is_admin()
);
