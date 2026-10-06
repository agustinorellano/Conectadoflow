import React, { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const METRICS = [
  { key: 'sales', label: 'Ventas' },
  { key: 'revenue', label: 'Facturación' },
  { key: 'clients', label: 'Clientes' },
  { key: 'collected', label: 'Cobros' },
];

export default function TopEntities({ sales, currency }) {
  const [metric, setMetric] = useState('revenue');

  const entityStats = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const entity = s.bank_entity || s.payment_method || 'Sin especificar';
      if (!map[entity]) map[entity] = { name: entity, sales: 0, revenue: 0, clients: new Set(), collected: 0 };
      map[entity].sales++;
      map[entity].revenue += Number(s.total_amount) || 0;
      if (s.client_id) map[entity].clients.add(s.client_id);
      map[entity].collected += Number(s.collected_amount) || 0;
    });
    return Object.values(map).map(e => ({ ...e, clients: e.clients.size }))
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 5);
  }, [sales, metric]);

  const getValue = (e) => {
    if (metric === 'sales') return `${e.sales} ventas`;
    if (metric === 'revenue') return formatCurrency(e.revenue, currency);
    if (metric === 'clients') return `${e.clients} clientes`;
    return formatCurrency(e.collected, currency);
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Top entidades utilizadas</h2>
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', metric === m.key ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border')}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {entityStats.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Sin datos</p> : (
        <div className="space-y-2">
          {entityStats.map((e, i) => (
            <div key={e.name} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.name}</p>
                <p className="text-xs text-muted-foreground">{e.sales} ventas · {e.clients} clientes</p>
              </div>
              <span className="text-sm font-semibold">{getValue(e)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
