-- Mismo cambio que ya se hizo en Leads: "Valor potencial" (monto numérico)
-- se reemplaza por "Prioridad" (Urgente/Alta/Media/Baja), más rápido de
-- cargar y de leer de un vistazo en "Estado de situación".
alter table public.clients rename column potential_value to potential_value_legacy;
comment on column public.clients.potential_value_legacy is
  'Monto numérico histórico de "valor potencial", reemplazado por priority (2026-10-09). Solo lectura.';

alter table public.clients add column priority text check (priority in ('Urgente','Alta','Media','Baja'));

notify pgrst, 'reload schema';
