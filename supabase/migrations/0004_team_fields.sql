-- Conectado Flow — persist the "Equipo" onboarding fields.
-- team_name and sellers_count were collected in the onboarding wizard for
-- mode = 'Equipo' but never had a column to land in.
alter table public.app_config add column team_name text;
alter table public.app_config add column sellers_count text;
