import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KpiCard({ label, value, sublabel, variation: v, icon: Icon, accent, onClick }) {
  const positive = v >= 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      onClick={onClick}
      className={cn(
        'bg-card rounded-2xl border border-border p-5 card-shadow relative overflow-hidden',
        onClick && 'cursor-pointer'
      )}
    >
      {accent && <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />}
      <div className="flex items-start justify-between mb-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={accent ? { background: accent + '1a', color: accent } : { background: 'hsl(var(--primary-soft))', color: 'hsl(var(--primary))' }}>
            <Icon className="w-[18px] h-[18px]" />
          </span>
        )}
      </div>
      <p className="text-[28px] font-bold tracking-tight leading-none">{value}</p>
      <div className="flex items-center gap-2 mt-2.5">
        {v !== undefined && v !== null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[12px] font-semibold px-1.5 py-0.5 rounded-md',
            positive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
          )}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{v.toFixed(1)}%
          </span>
        )}
        {sublabel && <span className="text-[12px] text-muted-foreground">{sublabel}</span>}
      </div>
    </motion.div>
  );
}
