-- "Valor potencial" en Leads pasa de un monto numérico libre (que además
-- el usuario reportó como "no se guarda") a un nivel cualitativo Bajo /
-- Medio / Alto, mostrado en la UI con colores de semáforo. El monto
-- numérico anterior se conserva en potential_value_legacy por si hace
-- falta consultarlo, pero deja de alimentarse desde la UI.
alter table public.leads rename column potential_value to potential_value_legacy;
comment on column public.leads.potential_value_legacy is
  'Monto numérico histórico de "valor potencial", reemplazado por el nivel Bajo/Medio/Alto en potential_value (2026-10-09). Solo lectura.';

alter table public.leads add column potential_value text check (potential_value in ('Bajo','Medio','Alto'));

notify pgrst, 'reload schema';
