-- Facturación electrónica con ARCA (ex AFIP), multi-tenant: cada
-- organización factura con su propio CUIT y certificado. El certificado y
-- la clave privada son datos extremadamente sensibles (equivalen a firmar
-- documentos fiscales en nombre de la empresa) — se guardan encriptados
-- con pgcrypto, y la clave de encripción vive como un setting a nivel de
-- base de datos (nunca en una tabla, nunca legible desde el cliente).
--
-- IMPORTANTE — paso manual único antes de que esto funcione: correr
--   alter database postgres set app.settings.arca_secret = '<una cadena aleatoria larga>';
-- Sin eso, arca_store_credentials/arca_get_decrypted_credentials fallan.
-- (Generá la cadena vos, ej. con `openssl rand -hex 32`, y no la compartas.)

create table public.arca_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) unique,
  cuit text not null,
  punto_venta integer not null default 1,
  environment text not null default 'homologacion' check (environment in ('homologacion', 'produccion')),
  certificate_enc bytea not null,
  private_key_enc bytea not null,
  is_active boolean not null default true,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create trigger trg_tenant before insert or update on public.arca_credentials
  for each row execute function public.set_tenant_id();
alter table public.arca_credentials enable row level security;

-- Nadie lee esta tabla directo, ni siquiera el admin de la organización —
-- certificate_enc/private_key_enc son bytea encriptado, inútil sin la
-- passphrase del servidor, pero igual no tiene sentido exponerlo por API.
-- Solo existencia/metadata (¿está configurado?, ¿qué CUIT?) es necesaria
-- para la UI, así que read sí se permite — nunca insert/update/delete
-- directo (eso pasa únicamente a través de arca_store_credentials).
create policy "arca_credentials_read" on public.arca_credentials for select using (
  organization_id = public.current_org_id()
);

-- Guarda (o reemplaza) las credenciales de una organización, encriptando
-- certificado y clave antes de tocar disco. Solo el admin de la propia
-- organización puede llamarla.
create or replace function public.arca_store_credentials(
  cuit_in text, punto_venta_in integer, environment_in text,
  certificate_in text, private_key_in text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_profile record;
  secret text;
begin
  select role, organization_id into caller_profile from public.profiles where id = auth.uid();
  if caller_profile.role <> 'admin' or caller_profile.organization_id is null then
    raise exception 'Not authorized';
  end if;

  secret := current_setting('app.settings.arca_secret', true);
  if secret is null or secret = '' then
    raise exception 'ARCA encryption secret is not configured on this database';
  end if;

  insert into public.arca_credentials (organization_id, cuit, punto_venta, environment, certificate_enc, private_key_enc)
  values (
    caller_profile.organization_id, cuit_in, punto_venta_in, environment_in,
    pgp_sym_encrypt(certificate_in, secret), pgp_sym_encrypt(private_key_in, secret)
  )
  on conflict (organization_id) do update set
    cuit = excluded.cuit,
    punto_venta = excluded.punto_venta,
    environment = excluded.environment,
    certificate_enc = excluded.certificate_enc,
    private_key_enc = excluded.private_key_enc,
    is_active = true,
    updated_date = now();
end;
$$;

-- Devuelve el certificado y la clave YA DESENCRIPTADOS — solo para que la
-- llame la Edge Function de facturación (corre con la service role key,
-- nunca el navegador). No tiene chequeo de rol porque la service role ya
-- bypassea RLS/permisos de por sí; el control de acceso real está en que
-- esta función nunca se expone a un usuario común con su propio token.
create or replace function public.arca_get_decrypted_credentials(org_id uuid)
returns table (cuit text, punto_venta integer, environment text, certificate text, private_key text)
language plpgsql security definer set search_path = public as $$
declare
  secret text;
begin
  secret := current_setting('app.settings.arca_secret', true);
  if secret is null or secret = '' then
    raise exception 'ARCA encryption secret is not configured on this database';
  end if;

  return query
    select c.cuit, c.punto_venta, c.environment,
      pgp_sym_decrypt(c.certificate_enc, secret), pgp_sym_decrypt(c.private_key_enc, secret)
    from public.arca_credentials c
    where c.organization_id = org_id and c.is_active;
end;
$$;

-- Token WSAA cacheado por organización (dura 12hs del lado de ARCA) — no
-- tiene sentido pedir uno nuevo en cada factura.
create table public.arca_tokens (
  organization_id uuid primary key references public.organizations(id),
  token text not null,
  sign text not null,
  expires_at timestamptz not null,
  updated_date timestamptz not null default now()
);
alter table public.arca_tokens enable row level security;
-- Sin policies de lectura/escritura a propósito: solo la service role
-- (Edge Function) la toca.

-- Resultado de facturar una venta: CAE, vencimiento, número de
-- comprobante asignado por ARCA, y el estado del intento.
alter table public.sales add column if not exists arca_status text
  check (arca_status in ('Pendiente', 'Facturada', 'Error')) default null;
alter table public.sales add column if not exists arca_cae text;
alter table public.sales add column if not exists arca_cae_vencimiento date;
alter table public.sales add column if not exists arca_comprobante_tipo integer;
alter table public.sales add column if not exists arca_comprobante_numero integer;
alter table public.sales add column if not exists arca_punto_venta integer;
alter table public.sales add column if not exists arca_error text;

notify pgrst, 'reload schema';
