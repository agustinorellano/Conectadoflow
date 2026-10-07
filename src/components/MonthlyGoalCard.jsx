import React from 'react';
import { Target } from 'lucide-react';

export default function MonthlyGoalCard({ goal, achieved, formatValue }) {
  const pct = goal > 0 ? Math.min(100, Math.round((achieved / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - achieved);

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Target className="w-3.5 h-3.5" />
        </span>
        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Meta mensual</p>
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5 min-w-0">
        <p className="text-lg font-bold tracking-tight truncate">{formatValue(achieved)}</p>
        <span className="text-sm font-semibold text-primary shrink-0">{pct}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">de {formatValue(goal)}</span>
        <span className="truncate text-right shrink-0">{formatValue(remaining)} restantes</span>
      </div>
    </div>
  );
}
