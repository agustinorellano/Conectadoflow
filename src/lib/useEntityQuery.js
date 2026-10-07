import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Generic React Query wrapper around a base44 entity client. Replaces the
// manual useState/useEffect-per-page pattern (145 call sites across the app
// doing this by hand) so navigating between screens reuses cached data
// instead of re-fetching the whole table every time.

export function useEntityList(entityName, { filter, sort, limit, enabled = true } = {}) {
  return useQuery({
    queryKey: [entityName, 'list', { filter, sort, limit }],
    queryFn: () => (filter
      ? base44.entities[entityName].filter(filter, sort, limit)
      : base44.entities[entityName].list(sort, limit)),
    enabled,
  });
}

export function useEntityPage(entityName, { filter, sort, page = 1, pageSize = 25, enabled = true } = {}) {
  return useQuery({
    queryKey: [entityName, 'page', { filter, sort, page, pageSize }],
    queryFn: () => base44.entities[entityName].page({ filter, sort, page, pageSize }),
    enabled,
  });
}

// create/update/remove, each invalidating every cached query for this
// entity so other open screens pick up the change instead of going stale.
export function useEntityMutations(entityName) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [entityName] });

  const create = useMutation({
    mutationFn: (payload) => base44.entities[entityName].create(payload),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }) => base44.entities[entityName].update(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id) => base44.entities[entityName].delete(id),
    onSuccess: invalidate,
  });
  const bulkCreate = useMutation({
    mutationFn: (payloads) => base44.entities[entityName].bulkCreate(payloads),
    onSuccess: invalidate,
  });

  return { create, update, remove, bulkCreate };
}
