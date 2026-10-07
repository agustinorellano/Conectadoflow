-- Sales channel: which channel the sale came through (WhatsApp, Instagram,
-- Web, Local, etc. — same vocabulary as leads.source), so you can see
-- which channel actually sells the most, not just which brings leads.
alter table public.sales add column channel text;
