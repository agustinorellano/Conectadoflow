-- Lets a product's price/cost be entered in a currency other than the
-- organization's default (same idea as sales.currency in 0014).
alter table public.products add column if not exists currency text not null default 'ARS';
