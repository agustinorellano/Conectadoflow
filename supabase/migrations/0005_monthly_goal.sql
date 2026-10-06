-- Conectado Flow — real, configurable monthly revenue goal.
-- The Dashboard's "Meta del mes" widget previously had no column to read
-- from and silently fell back to revenue * 1.2 (a moving, fake target).
alter table public.app_config add column monthly_goal numeric;
