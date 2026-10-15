-- Mismo bug que 0042 (support_reports), ahora en support_report_messages:
-- makeEntity.create() agrega created_by_id a todo insert genérico de
-- entidad, pero esa columna nunca se declaró acá tampoco — mandar un
-- mensaje en el chat de un reporte fallaba con
-- "Could not find the 'created_by_id' column" (PGRST204 / 400).
alter table public.support_report_messages add column if not exists created_by_id uuid references auth.users(id);

notify pgrst, 'reload schema';
