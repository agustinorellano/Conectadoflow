-- Message templates become channel-aware: WhatsApp templates stay short/
-- informal, Email templates get their own (longer, more formal) body plus
-- a subject line — previously both channels reused the same WhatsApp-style
-- text, which read oddly as an email.
alter table public.message_templates add column if not exists channel text not null default 'WhatsApp' check (channel in ('WhatsApp', 'Email'));
alter table public.message_templates add column if not exists subject text;

NOTIFY pgrst, 'reload schema';
