import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
          <p className="text-xs text-muted-foreground">Evolución de ingresos en el período</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 mt-3 mb-2">
        <p className="text-2xl font-bold tracking-tight">{formatValue(total)}</p>
        {variationPct !== undefined && variationPct !== null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[12px] font-semibold px-1.5 py-0.5 rounded-md',
            positive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
          )}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{variationPct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="h-[220px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sales-report-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#465BE8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#465BE8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            <Area type="monotone" dataKey="v" stroke="#465BE8" strokeWidth={2.5} fill="url(#sales-report-fill)" isAnimationActive={false} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
