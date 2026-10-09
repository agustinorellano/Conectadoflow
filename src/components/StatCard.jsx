import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Compact stat card matching the reference layout exactly: icon circle +
// label on top, big number and a small delta pill inline beside it (not
// stacked) on the row below. No accent bar, no sparkline — intentionally
// plainer than KpiCard, used only for this specific row.
export default function StatCard({ label, value, sublabel, variation: v, icon: Icon, accent, onClick }) {
  const positive = v >= 0;
  // A short number always fits at the big size, but a longer currency
  // amount (e.g. "$1.318.750") or a product/client name (e.g. "Más
  // vendido") gets cut off in the 2-column mobile grid — drop to a
  // smaller size and wrap onto 2 lines instead of ellipsizing it on one.
  const isLongText = typeof value === 'string' && value.length > 9;
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card rounded-2xl border border-border p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 min-w-0',
        onClick && 'cursor-pointer hover:border-primary/30 transition-colors'
      )}
    >
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {Icon && (
          <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0" style={accent ? { background: accent + '1a', color: accent } : { background: 'hsl(var(--primary-soft))', color: 'hsl(var(--primary))' }}>
            <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </span>
        )}
        <p className="text-xs sm:text-sm text-muted-foreground leading-snug line-clamp-2">{label}</p>
      </div>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p title={isLongText ? value : undefined} className={cn(
          'font-bold tracking-tight',
          isLongText ? 'text-sm sm:text-base leading-snug line-clamp-2' : 'text-lg sm:text-[26px] leading-none truncate'
        )}>{value}</p>
        {v !== undefined && v !== null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[11px] sm:text-[12px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
            positive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
          )}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{v.toFixed(1)}%
          </span>
        )}
      </div>
      {sublabel && <p className="text-[11px] text-muted-foreground truncate -mt-1">{sublabel}</p>}
    </div>
  );
}
