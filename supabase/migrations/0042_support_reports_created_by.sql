-- makeEntity.create() (src/api/makeEntity.js) agrega created_by_id a TODO
-- insert que hace, para cualquier entidad — es parte del adaptador
-- genérico, no algo que cada tabla declare a mano. support_reports
-- (Etapa 5, 0038) se armó sin esa columna, así que cualquier reporte
-- nuevo fallaba con "Could not find the 'created_by_id' column".
alter table public.support_reports add column if not exists created_by_id uuid references auth.users(id);

notify pgrst, 'reload schema';
