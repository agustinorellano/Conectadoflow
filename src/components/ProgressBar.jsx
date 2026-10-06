import React from 'react';
import { cn } from '@/lib/utils';

export default function ProgressBar({ value, max, label, sublabel, formatValue, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-xs text-muted-foreground">{formatValue ? formatValue(value) : value}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500')}
            style={{ width: `${pct}%`, background: color || 'hsl(var(--primary))' }}
          />
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold tabular-nums shrink-0 min-w-[42px] justify-center">
          {pct}%
        </span>
      </div>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}
