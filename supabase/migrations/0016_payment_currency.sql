-- A payment's installments are generated from its sale's total, in that
-- sale's currency (sales.currency, 0014) — but the row itself never
-- recorded which currency that was, so anything summing Payment.amount
-- (Cobros, Dashboard) silently treated every payment as the org default.
alter table public.payments add column if not exists currency text not null default 'ARS';
