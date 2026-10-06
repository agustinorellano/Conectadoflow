import React from 'react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  muted: 'bg-secondary text-secondary-foreground',
  violet: 'bg-violet-500/10 text-violet-600',
  blue: 'bg-blue-500/10 text-blue-600',
  cyan: 'bg-cyan-500/10 text-cyan-600',
  amber: 'bg-amber-500/10 text-amber-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  rose: 'bg-rose-500/10 text-rose-600',
};

export default function Badge({ children, variant = 'muted', className, dot }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
      VARIANTS[variant] || VARIANTS.muted,
      className
    )}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
