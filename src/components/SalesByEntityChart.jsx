import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts';
import { formatCurrency } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const COLORS = ['#465BE8', '#22c55e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f97316', '#ec4899', '#14b8a6'];

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
    return Object.values(map).sort((a, b) => b[metric] - a[metric]).slice(0, 8);
  }, [sales, metric]);

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Ventas por entidad</h2>
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
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={60} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => metric === 'revenue' ? `${(v / 1000000).toFixed(0)}M` : v} />
            <Tooltip
              formatter={v => metric === 'revenue' ? formatCurrency(v, currency) : `${v} ventas`}
              contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }}
            />
            <Bar dataKey={metric} radius={[6, 6, 0, 0]} name={metric === 'revenue' ? 'Facturación' : 'Ventas'}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
