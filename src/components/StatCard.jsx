import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Compact stat card matching the reference layout exactly: icon circle +
// label on top, big number and a small delta pill inline beside it (not
// stacked) on the row below. No accent bar, no sparkline — intentionally
// plainer than KpiCard, used only for this specific row.
export default function StatCard({ label, value, variation: v, icon: Icon, accent, onClick }) {
  const positive = v >= 0;
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card rounded-2xl border border-border p-4 flex flex-col gap-3',
        onClick && 'cursor-pointer hover:border-primary/30 transition-colors'
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={accent ? { background: accent + '1a', color: accent } : { background: 'hsl(var(--primary-soft))', color: 'hsl(var(--primary))' }}>
            <Icon className="w-[18px] h-[18px]" />
          </span>
        )}
        <p className="text-sm text-muted-foreground truncate">{label}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[26px] font-bold tracking-tight leading-none">{value}</p>
        {v !== undefined && v !== null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[12px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
            positive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
          )}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{v.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
