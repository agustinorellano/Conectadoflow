import { supabase } from '@/lib/supabaseClient';

// Parses Base44-style sort strings like '-date' (desc) or 'date' (asc).
function parseSort(sort) {
  if (!sort) return null;
  const desc = sort.startsWith('-');
  const column = desc ? sort.slice(1) : sort;
  return { column, ascending: !desc };
}

// Returns an object with the same shape as a Base44 SDK entity client
// (list/filter/get/create/update/delete/bulkCreate), backed by a Supabase
// table. Row-level security on the table enforces the same rules Base44's
// `rls` block described.
export function makeEntity(table) {
  return {
    async list(sort, limit) {
      let q = supabase.from(table).select('*');
      const s = parseSort(sort || '-created_date');
      if (s) q = q.order(s.column, { ascending: s.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async filter(query = {}, sort, limit) {
      let q = supabase.from(table).select('*');
      Object.entries(query).forEach(([key, value]) => {
        q = q.eq(key, value);
      });
      const s = parseSort(sort || '-created_date');
      if (s) q = q.order(s.column, { ascending: s.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data: userData } = await supabase.auth.getUser();
      const row = { ...payload, created_by_id: userData?.user?.id || null };
      const { data, error } = await supabase.from(table).insert(row).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(table)
        .update({ ...payload, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    async bulkCreate(payloads) {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      const rows = payloads.map((p) => ({ ...p, created_by_id: uid }));
      const { data, error } = await supabase.from(table).insert(rows).select();
      if (error) throw error;
      return data || [];
    },
  };
}
