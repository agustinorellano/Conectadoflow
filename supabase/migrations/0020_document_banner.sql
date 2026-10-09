-- Optional branded banner at the top of a generated document: a colored
-- band (the org's own primary_color) with the company name in large bold
-- text, instead of the plain text header. Per-template, like show_prices/
-- show_signature, so a plain internal document and a client-facing one
-- can differ.
alter table public.document_templates add column if not exists show_banner boolean not null default true;

NOTIFY pgrst, 'reload schema';
