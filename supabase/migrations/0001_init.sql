-- Conectado Flow — initial schema, migrated from Base44 entities.
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (mirrors Base44's User entity: role + display name, 1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Everyone signed in can read profiles (needed for owner_name lookups across the CRM).
create policy "profiles_read" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Auto-create a profile row when a new auth user signs up.
-- The FIRST user to sign up becomes admin; everyone after that is a regular user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audit-field trigger shared by every business table below.
-- ---------------------------------------------------------------------------
create or replace function public.set_audit_fields()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by_id := auth.uid();
    new.created_date := coalesce(new.created_date, now());
    new.updated_date := now();
  elsif tg_op = 'UPDATE' then
    new.created_by_id := old.created_by_id;
    new.created_date := old.created_date;
    new.updated_date := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper macro (as a comment, applied by hand below per table):
--   id uuid primary key default gen_random_uuid(),
--   created_by_id uuid references auth.users(id),
--   created_date timestamptz not null default now(),
--   updated_date timestamptz not null default now()
-- RLS pattern, matching Base44's rls blocks:
--   read/create/update: open to any authenticated user (team-shared CRM data)
--   delete: only the creator or an admin
-- ---------------------------------------------------------------------------

-- app_config ------------------------------------------------------------
create table public.app_config (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'Conectado Flow',
  logo_url text,
  industry text,
  sale_type text default 'Productos y servicios' check (sale_type in ('Productos','Servicios','Productos y servicios')),
  currency text default 'ARS',
  currency_symbol text default '$',
  tax_rate numeric default 21,
  mode text default 'Independiente' check (mode in ('Independiente','Equipo')),
  sell_to text default 'Ambos' check (sell_to in ('Consumidores','Empresas','Ambos')),
  channels text[],
  onboarded boolean default false,
  primary_color text default '#465BE8',
  billing_name text,
  billing_tax_id text,
  billing_address text,
  billing_phone text,
  billing_email text,
  billing_type text check (billing_type in ('Responsable Inscripto','Monotributista','Exento','Consumidor Final','Otro')),
  hidden_nav text[] default array['/pipeline'],
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
alter table public.app_config enable row level security;
create trigger trg_audit before insert or update on public.app_config for each row execute function public.set_audit_fields();
create policy "app_config_read" on public.app_config for select using (auth.role() = 'authenticated');
create policy "app_config_write" on public.app_config for insert with check (public.is_admin());
create policy "app_config_update" on public.app_config for update using (public.is_admin());
create policy "app_config_delete" on public.app_config for delete using (public.is_admin());

-- commerces ---------------------------------------------------------------
create table public.commerces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  industry text,
  address text,
  phone text,
  email text,
  is_active boolean default true,
  owner_id uuid references auth.users(id),
  primary_color text default '#465BE8',
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
alter table public.commerces enable row level security;
create trigger trg_audit before insert or update on public.commerces for each row execute function public.set_audit_fields();
create policy "commerces_read" on public.commerces for select using (auth.role() = 'authenticated');
create policy "commerces_insert" on public.commerces for insert with check (owner_id = auth.uid());
create policy "commerces_update" on public.commerces for update using (owner_id = auth.uid() or public.is_admin());
create policy "commerces_delete" on public.commerces for delete using (owner_id = auth.uid() or public.is_admin());

-- Generic team-shared tables: open read/create/update, delete by creator or admin.
-- clients -------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  tax_id text,
  phone text,
  email text,
  address text,
  type text default 'Consumidor' check (type in ('Consumidor','Empresa')),
  segment text,
  owner_id uuid references auth.users(id),
  owner_name text,
  commerce_id uuid references public.commerces(id) on delete set null,
  commerce_name text,
  status text default 'Activo' check (status in ('Activo','Inactivo','Potencial')),
  potential_value numeric,
  total_sold numeric default 0,
  total_collected numeric default 0,
  balance numeric default 0,
  last_contact timestamptz,
  next_action text,
  next_meeting_date timestamptz,
  notes text,
  lead_source text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- leads -----------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  company text,
  phone text,
  email text,
  source text default 'WhatsApp',
  interest text,
  potential_value numeric,
  owner_id uuid references auth.users(id),
  owner_name text,
  commerce_id uuid references public.commerces(id) on delete set null,
  status text default 'Nuevo' check (status in ('Nuevo','Contactado','Calificado','Convertido','Perdido')),
  last_contact timestamptz,
  next_action text,
  next_action_date date,
  notes text,
  converted_client_id uuid references public.clients(id) on delete set null,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- opportunities -----------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  client_name text,
  client_company text,
  title text not null,
  product text,
  amount numeric not null default 0,
  probability numeric default 20,
  owner_id uuid references auth.users(id),
  owner_name text,
  commerce_id uuid references public.commerces(id) on delete set null,
  stage text not null default 'Nuevo lead',
  stage_order numeric default 0,
  source text,
  expected_close_date date,
  next_action text,
  next_action_date date,
  next_meeting_date timestamptz,
  loss_reason text,
  notes text,
  is_won boolean default false,
  is_lost boolean default false,
  sale_id uuid,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- products ------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  category text,
  kind text default 'Producto' check (kind in ('Producto','Servicio')),
  price numeric not null default 0,
  cost numeric,
  description text,
  image_url text,
  stock numeric default 0,
  is_active boolean default true,
  commerce_id uuid references public.commerces(id) on delete set null,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- sales -----------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  number text,
  client_id uuid references public.clients(id) on delete restrict,
  client_name text,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  owner_id uuid references auth.users(id),
  owner_name text,
  commerce_id uuid references public.commerces(id) on delete set null,
  commerce_name text,
  date date not null default current_date,
  items jsonb not null default '[]',
  gross_amount numeric default 0,
  discount numeric default 0,
  tax numeric default 0,
  total_amount numeric not null default 0,
  payment_method text default 'Transferencia',
  bank_entity text,
  card_type text,
  card_brand text,
  installments_count numeric default 1,
  status text default 'Confirmada' check (status in ('Pendiente','Confirmada','Cancelada')),
  collected_amount numeric default 0,
  balance numeric default 0,
  payment_status text default 'Pendiente' check (payment_status in ('Pendiente','Parcial','Pagado','Vencido','Cancelado')),
  observations text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.opportunities add constraint opportunities_sale_id_fkey foreign key (sale_id) references public.sales(id) on delete set null;

-- payments ------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  sale_number text,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  installment_number numeric default 1,
  total_installments numeric default 1,
  amount numeric not null default 0,
  due_date date,
  paid_date date,
  method text default 'Transferencia',
  commerce_id uuid references public.commerces(id) on delete set null,
  status text default 'Pendiente' check (status in ('Pendiente','Parcial','Pagado','Vencido','Cancelado')),
  notes text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- activities ------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  client_name text,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  type text default 'Seguimiento',
  title text not null,
  description text,
  date timestamptz,
  due_date date,
  owner_id uuid references auth.users(id),
  owner_name text,
  status text default 'Pendiente' check (status in ('Pendiente','Realizada','Cancelada')),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- meetings ----------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  client_name text,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  title text not null,
  date timestamptz not null,
  duration numeric default 60,
  type text default 'Videollamada',
  owner_id uuid references auth.users(id),
  owner_name text,
  commerce_id uuid references public.commerces(id) on delete set null,
  notes text,
  result text,
  status text default 'Programada' check (status in ('Programada','Realizada','Cancelada')),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- documents -----------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text default 'Factura',
  client_id uuid references public.clients(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  file_uri text,
  file_url text,
  amount numeric,
  date date,
  notes text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- client_payment_methods -----------------------------------------------
create table public.client_payment_methods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_name text,
  entity_type text default 'Banco' check (entity_type in ('Banco','Billetera','Tarjeta','Fintech','Otros')),
  entity_name text,
  card_type text,
  card_brand text,
  last_digits text,
  notes text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- payment_entities --------------------------------------------------------
create table public.payment_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'Banco' check (type in ('Banco','Billetera','Tarjeta','Fintech','Otros')),
  subtype text,
  is_favorite boolean default false,
  is_active boolean default true,
  commerce_id uuid references public.commerces(id) on delete set null,
  color text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- pipeline_stages -----------------------------------------------------------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "order" numeric not null default 0,
  color text default '#64748b',
  is_won boolean default false,
  is_lost boolean default false,
  is_active boolean default true,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- message_templates -----------------------------------------------------
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Seguimiento',
  body text not null,
  is_active boolean default true,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- goals (team-visible, no delete restriction in Base44 source) -------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'Facturación' check (type in ('Ventas','Facturación','Leads','Reuniones')),
  target numeric not null,
  current numeric default 0,
  period text default 'Mensual' check (period in ('Semanal','Mensual','Trimestral','Anual')),
  owner_id uuid references auth.users(id),
  owner_name text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- notifications (personal: scoped to the recipient, owner_id) ---------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text default 'Sistema' check (type in ('Reunión','Seguimiento','Pago','Lead','Oportunidad','Sistema')),
  link text,
  is_read boolean default false,
  owner_id uuid references auth.users(id),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Apply the shared audit trigger + team-shared RLS policy set to every
-- "open read/create/update, delete by creator or admin" table.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  team_tables text[] := array[
    'clients','leads','opportunities','products','sales','payments',
    'activities','meetings','documents','client_payment_methods',
    'payment_entities','pipeline_stages','message_templates','goals'
  ];
begin
  foreach t in array team_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger trg_audit before insert or update on public.%I for each row execute function public.set_audit_fields()', t);
    execute format('create policy "%1$s_read" on public.%1$s for select using (auth.role() = ''authenticated'')', t);
    execute format('create policy "%1$s_insert" on public.%1$s for insert with check (auth.role() = ''authenticated'')', t);
    execute format('create policy "%1$s_update" on public.%1$s for update using (auth.role() = ''authenticated'')', t);
    execute format('create policy "%1$s_delete" on public.%1$s for delete using (created_by_id = auth.uid() or public.is_admin())', t);
  end loop;
end $$;

-- notifications: read/update restricted to the recipient (or admin); same delete rule.
alter table public.notifications enable row level security;
create trigger trg_audit before insert or update on public.notifications for each row execute function public.set_audit_fields();
create policy "notifications_read" on public.notifications for select using (owner_id = auth.uid() or public.is_admin());
create policy "notifications_insert" on public.notifications for insert with check (auth.role() = 'authenticated');
create policy "notifications_update" on public.notifications for update using (owner_id = auth.uid() or public.is_admin());
create policy "notifications_delete" on public.notifications for delete using (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets for logos and product images (public read, authenticated write).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('public-files', 'public-files', true)
  on conflict (id) do nothing;

create policy "public_files_read" on storage.objects for select using (bucket_id = 'public-files');
create policy "public_files_insert" on storage.objects for insert with check (bucket_id = 'public-files' and auth.role() = 'authenticated');
create policy "public_files_update" on storage.objects for update using (bucket_id = 'public-files' and auth.role() = 'authenticated');
create policy "public_files_delete" on storage.objects for delete using (bucket_id = 'public-files' and auth.role() = 'authenticated');
