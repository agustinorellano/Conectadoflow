-- Lets each client have a preferred communication channel (WhatsApp or
-- Email), used as the default when sending a predefined message — the
-- seller can still switch it per message, this is just the starting pick.
alter table public.clients add column if not exists preferred_channel text not null default 'WhatsApp';
