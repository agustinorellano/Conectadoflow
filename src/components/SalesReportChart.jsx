import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function ChartTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-foreground text-background rounded-xl px-3.5 py-2.5 text-xs shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      <p className="opacity-80">{formatValue(payload[0].value)}</p>
    </div>
  );
}

export default function SalesReportChart({ series, total, variationPct, formatValue }) {
  const positive = variationPct >= 0;
  const data = series.map(p => ({ ...p, v: p.value }));

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="font-semibold text-sm">Reporte de ventas</h2>
          <p className="text-xs text-muted-foreground">Mirá cómo van tus ventas</p>
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight mt-3">{formatValue(total)}</p>
      {variationPct !== undefined && variationPct !== null && (
        <p className={cn('inline-flex items-center gap-1 text-[13px] font-medium mt-1 mb-2', positive ? 'text-success' : 'text-destructive')}>
          {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {positive ? '+' : ''}{variationPct.toFixed(1)}% vs. período anterior
        </p>
      )}
      <div className="h-[220px] -mx-2 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            <Line type="monotone" dataKey="v" stroke="#465BE8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
