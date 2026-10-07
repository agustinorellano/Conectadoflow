import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KpiCard({ label, value, sublabel, variation: v, icon: Icon, accent, onClick, sparkline }) {
  const positive = v >= 0;
  const sparkId = `spark-${label}`.replace(/\s+/g, '-');
  const hasSparkline = sparkline && sparkline.length > 1;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      onClick={onClick}
      className={cn(
        'bg-card rounded-2xl border border-border p-3.5 sm:p-5 card-shadow relative overflow-hidden min-w-0',
        onClick && 'cursor-pointer'
      )}
    >
      {accent && <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />}
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <p className="text-xs sm:text-[13px] font-medium text-muted-foreground truncate">{label}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          {Icon && (
            <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0" style={accent ? { background: accent + '1a', color: accent } : { background: 'hsl(var(--primary-soft))', color: 'hsl(var(--primary))' }}>
              <Icon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
            </span>
          )}
        </div>
      </div>
      <p className="text-xl sm:text-[28px] font-bold tracking-tight leading-none truncate">{value}</p>
      <div className="flex items-center gap-2 mt-2 sm:mt-2.5 flex-wrap">
        {v !== undefined && v !== null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[11px] sm:text-[12px] font-semibold px-1.5 py-0.5 rounded-md shrink-0',
            positive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
          )}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{v.toFixed(1)}%
          </span>
        )}
        {sublabel && <span className="text-[11px] sm:text-[12px] text-muted-foreground truncate">{sublabel}</span>}
      </div>
      {hasSparkline && (
        <div className="h-9 -mx-1 -mb-1 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map(val => ({ val }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent || 'hsl(var(--primary))'} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent || 'hsl(var(--primary))'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="val" stroke={accent || 'hsl(var(--primary))'} strokeWidth={2} fill={`url(#${sparkId})`} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
