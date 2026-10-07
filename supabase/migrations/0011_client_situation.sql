-- Manually-set "estado de situación" per client (separate from status/
-- balance): a relationship stage the user controls from the Clientes list,
-- used to pick the default outreach message template.
alter table public.clients add column situation_status text not null default 'Primer contacto'
  check (situation_status in ('Primer contacto','Seguimiento','Propuesta enviada','Cliente activo','Saldo pendiente','Inactivo'));
