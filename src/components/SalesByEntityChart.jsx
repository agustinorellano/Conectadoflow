import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const COLORS = ['#465BE8', '#22c55e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f97316', '#ec4899', '#14b8a6'];

// Short, readable label for the colored badge when the entity name is long
// (e.g. "Banco Santander Río" -> "SANT") — same idea as a brand mark
// without needing real logo assets.
function badgeLabel(name) {
  const clean = (name || '').trim();
  if (!clean) return '—';
  if (clean.length <= 10) return clean;
  const significant = clean.split(/\s+/).filter(w => !['de', 'la', 'el', 'los', 'las'].includes(w.toLowerCase()));
  return (significant[0] || clean).slice(0, 10);
}

export default function SalesByEntityChart({ sales, currency }) {
  const [metric, setMetric] = useState('revenue');
  const metrics = [
    { key: 'revenue', label: 'Facturación' },
    { key: 'sales', label: 'Cantidad' },
  ];

  const data = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const entity = s.bank_entity || s.payment_method || 'Sin especificar';
      if (!map[entity]) map[entity] = { name: entity, revenue: 0, sales: 0 };
      map[entity].revenue += Number(s.total_amount) || 0;
      map[entity].sales++;
    });
    const sorted = Object.values(map).sort((a, b) => b[metric] - a[metric]).slice(0, 8);
    const total = sorted.reduce((s, x) => s + x[metric], 0) || 1;
    const max = sorted[0]?.[metric] || 1;
    return sorted.map((x, i) => ({ ...x, color: COLORS[i % COLORS.length], share: (x[metric] / total) * 100, barWidth: (x[metric] / max) * 100 }));
  }, [sales, metric]);

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Ventas <span className="text-foreground">por entidad</span>
        </h2>
        <div className="flex gap-1">
          {metrics.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', metric === m.key ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border')}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de ventas</p> : (
        <div className="space-y-4">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-3">
              <span
                className="shrink-0 w-[72px] h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white text-center px-1.5 leading-tight"
                style={{ background: d.color }}
                title={d.name}
              >
                {badgeLabel(d.name)}
              </span>
              <div className="flex-1 h-2 rounded-full bg-secondary/70 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${d.color}, ${d.color}33)` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.barWidth}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                />
              </div>
              <span className="shrink-0 w-12 text-right text-sm font-bold">{d.share.toFixed(0)}%</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            {metric === 'revenue'
              ? `Total: ${formatCurrency(data.reduce((s, x) => s + x.revenue, 0), currency)}`
              : `Total: ${data.reduce((s, x) => s + x.sales, 0)} ventas`}
          </p>
        </div>
      )}
    </div>
  );
}
