import React from 'react';
import { cn } from '@/lib/utils';

const VIEWS = [
  { key: 'general', label: 'General' },
  { key: 'commerce', label: 'Por comercio' },
  { key: 'seller', label: 'Por vendedor' },
];

export default function DashboardPills({ view, setView }) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-xl w-fit overflow-x-auto no-scrollbar">
      {VIEWS.map(v => (
        <button
          key={v.key}
          onClick={() => setView(v.key)}
          className={cn(
            'px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            view === v.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
