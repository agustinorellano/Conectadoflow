import React from 'react';
import { useEntityList } from '@/lib/useEntityQuery';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatDate } from '@/lib/flowUtils';

// Shared across Cliente/Lead/Producto forms — fetches this org's active
// custom field definitions for `entity` and renders one input per field,
// bound to `values`/`onChange` (values keyed by definition id, same shape
// that gets saved straight into the row's custom_fields jsonb column).
export function useCustomFieldDefinitions(entity) {
  const { data = [], isLoading } = useEntityList('CustomFieldDefinition', { filter: { entity } });
  const active = data.filter(d => d.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return { definitions: active, isLoading };
}

export default function CustomFieldsSection({ entity, values, onChange }) {
  const { definitions, isLoading } = useCustomFieldDefinitions(entity);
  if (isLoading || definitions.length === 0) return null;

  const setValue = (defId, val) => onChange({ ...values, [defId]: val });

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Campos personalizados</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {definitions.map(d => (
          <div key={d.id}>
            <label className="text-sm font-medium mb-1.5 block">{d.label}{d.is_required && ' *'}</label>
            {d.field_type === 'text' && (
              <input value={values?.[d.id] || ''} onChange={e => setValue(d.id, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            )}
            {d.field_type === 'number' && (
              <input type="number" value={values?.[d.id] ?? ''} onChange={e => setValue(d.id, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            )}
            {d.field_type === 'date' && (
              <input type="date" value={values?.[d.id] || ''} onChange={e => setValue(d.id, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            )}
            {d.field_type === 'select' && (
              <StyledSelect value={values?.[d.id] || ''} onChange={e => setValue(d.id, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
                <option value="">Elegí una opción…</option>
                {(d.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </StyledSelect>
            )}
            {d.field_type === 'boolean' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer h-[42px]">
                <input type="checkbox" checked={!!values?.[d.id]} onChange={e => setValue(d.id, e.target.checked)} className="w-4 h-4 accent-primary" /> Sí
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Read-only rendering for detail pages (ficha de cliente). Skips fields
// with no value instead of printing an empty line for every one.
export function CustomFieldsView({ entity, values }) {
  const { definitions } = useCustomFieldDefinitions(entity);
  const withValue = definitions.filter(d => {
    const v = values?.[d.id];
    return v !== undefined && v !== null && v !== '' && v !== false;
  });
  if (withValue.length === 0) return null;

  const display = (d) => {
    const v = values[d.id];
    if (d.field_type === 'boolean') return 'Sí';
    if (d.field_type === 'date') return formatDate(v);
    return String(v);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {withValue.map(d => (
        <div key={d.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">{d.label}</p>
            <p className="text-sm font-medium truncate">{display(d)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
