-- DataContext.loadConfig() tenía la misma condición de carrera que ya se
-- arregló en create_organization(): comprueba si existe un app_config para
-- la organización y, si no, crea uno — sin ningún lock, así que dos
-- llamadas simultáneas podían crear dos filas de app_config para la misma
-- organización. admin_list_organizations() hace left join contra
-- app_config, así que una organización con dos configs aparecía
-- literalmente dos veces en el Panel de administración (parecían dos
-- organizaciones duplicadas, pero era una sola con doble config).

-- Dedup: para cada organización, conservar la fila de app_config más vieja
-- y borrar el resto.
with ranked as (
  select id, row_number() over (partition by organization_id order by created_date asc, id asc) as rn
  from public.app_config
  where organization_id is not null
)
delete from public.app_config where id in (select id from ranked where rn > 1);

-- Esto vuelve imposible que vuelva a pasar: una segunda inserción para la
-- misma organización falla con un error de restricción única en vez de
-- crear una fila extra silenciosamente.
alter table public.app_config add constraint app_config_organization_id_unique unique (organization_id);

notify pgrst, 'reload schema';
