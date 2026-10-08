-- ---------------------------------------------------------------------------
-- Generador de documentos de entrega/venta (Clientes → Comunicación →
-- Documentos). Two tables: document_templates (reusable models) and
-- client_documents (the actual generated file + its history). Both use the
-- same organization_id auto-population pattern as every other table
-- (public.set_tenant_id(), defined in 0002_multitenant.sql).
-- ---------------------------------------------------------------------------

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  name text not null,
  doc_type text not null check (doc_type in (
    'Constancia de entrega', 'Comprobante de entrega de mercadería',
    'Constancia de prestación de servicios', 'Acuerdo comercial de venta',
    'Conformidad de recepción', 'Documento personalizado'
  )),
  operation_type text not null default 'Ambos' check (operation_type in ('B2B', 'B2C', 'Ambos')),
  intro_text text,
  conditions_text text,
  show_prices boolean not null default true,
  show_signature boolean not null default true,
  is_system boolean not null default false, -- seeded defaults; still editable, just not user-deletable from the UI
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.document_templates for each row execute function public.set_tenant_id();
alter table public.document_templates enable row level security;

create policy "document_templates_read" on public.document_templates for select using (
  organization_id = public.current_org_id()
);
create policy "document_templates_insert" on public.document_templates for insert with check (
  organization_id is not null and organization_id = public.current_org_id()
  and public.current_role() <> 'viewer'
);
create policy "document_templates_update" on public.document_templates for update using (
  organization_id = public.current_org_id()
  and (public.is_manager_or_admin() or created_by_id = auth.uid())
);
create policy "document_templates_delete" on public.document_templates for delete using (
  organization_id = public.current_org_id()
  and public.is_manager_or_admin()
);

-- ---------------------------------------------------------------------------

create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  client_id uuid references public.clients(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  template_id uuid references public.document_templates(id) on delete set null,
  doc_type text not null,
  operation_type text not null check (operation_type in ('B2B', 'B2C')),
  document_number text,
  status text not null default 'Borrador' check (status in ('Borrador', 'Generado', 'Enviado', 'Error de envío', 'Anulado')),
  -- Frozen copies: editing AppConfig or the Client later must never change
  -- an already-generated document's content.
  issuer_snapshot jsonb not null default '{}',
  client_snapshot jsonb not null default '{}',
  items jsonb not null default '[]',
  conditions text,
  observations text,
  currency text not null default 'ARS',
  total_amount numeric,
  file_uri text, -- private-files storage path, once the PDF is generated
  sent_channel text check (sent_channel in ('WhatsApp', 'Email')),
  sent_to text,
  sent_date timestamptz,
  version integer not null default 1,
  parent_document_id uuid references public.client_documents(id) on delete set null,
  void_reason text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.client_documents for each row execute function public.set_tenant_id();
alter table public.client_documents enable row level security;

create policy "client_documents_read" on public.client_documents for select using (
  organization_id = public.current_org_id()
  and (public.current_role() <> 'user' or created_by_id = auth.uid())
);
create policy "client_documents_insert" on public.client_documents for insert with check (
  organization_id is not null and organization_id = public.current_org_id()
  and public.current_role() <> 'viewer'
);
create policy "client_documents_update" on public.client_documents for update using (
  organization_id = public.current_org_id()
  and (public.is_manager_or_admin() or created_by_id = auth.uid())
);
create policy "client_documents_delete" on public.client_documents for delete using (
  organization_id = public.current_org_id()
  and public.is_manager_or_admin()
);

-- ---------------------------------------------------------------------------
-- Atomic per-org, per-doc-type numbering. A client-side "count rows + 1"
-- can race when two users generate a document at the same moment; this
-- does the increment inside a single UPDATE so Postgres serializes it.
-- ---------------------------------------------------------------------------

create table public.document_counters (
  organization_id uuid not null references public.organizations(id),
  doc_type text not null,
  last_number integer not null default 0,
  primary key (organization_id, doc_type)
);
alter table public.document_counters enable row level security;
-- No direct policies: only reachable through the SECURITY DEFINER function
-- below, which runs as the table owner regardless of the caller's RLS.

create or replace function public.next_document_number(p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_num integer;
  v_prefix text;
begin
  if v_org is null then
    raise exception 'No organization for current user';
  end if;

  insert into public.document_counters (organization_id, doc_type, last_number)
  values (v_org, p_doc_type, 1)
  on conflict (organization_id, doc_type)
  do update set last_number = public.document_counters.last_number + 1
  returning last_number into v_num;

  v_prefix := case p_doc_type
    when 'Constancia de entrega' then 'CE'
    when 'Comprobante de entrega de mercadería' then 'CM'
    when 'Constancia de prestación de servicios' then 'CS'
    when 'Acuerdo comercial de venta' then 'AC'
    when 'Conformidad de recepción' then 'CR'
    else 'DOC'
  end;

  return v_prefix || '-' || lpad(v_num::text, 6, '0');
end;
$$;
