-- Supabase no permite "alter database ... set app.settings.x" desde el
-- SQL Editor (no corre como superusuario ahí) — la forma soportada de
-- guardar un secreto que solo funciones del servidor puedan leer es la
-- extensión Vault, hecha justo para esto. Reemplaza el mecanismo de
-- current_setting() de la migración 0031 por vault.decrypted_secrets.

create extension if not exists supabase_vault;

-- Semilla del secreto — SOLO corre si todavía no existe (no pisa uno que
-- ya hayas creado a mano). El valor va generado al azar acá mismo; no
-- hace falta que hagas nada con él, las funciones de abajo lo leen solas.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'arca_secret') then
    perform vault.create_secret(
      '99c247c99ec532bbaea5da2501760e84b4542d58aedb620ee9364f9828b807aa',
      'arca_secret',
      'Passphrase para encriptar certificados ARCA de cada organización'
    );
  end if;
end $$;

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

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'arca_secret';
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

create or replace function public.arca_get_decrypted_credentials(org_id uuid)
returns table (cuit text, punto_venta integer, environment text, certificate text, private_key text)
language plpgsql security definer set search_path = public as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'arca_secret';
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

notify pgrst, 'reload schema';
