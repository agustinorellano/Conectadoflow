-- Lets a sale record which currency its amounts were entered in, independent
-- of the organization's default currency (AppConfig.currency). Defaults to
-- the existing default so historical rows read correctly.
alter table public.sales add column if not exists currency text not null default 'ARS';
