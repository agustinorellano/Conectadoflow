import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground max-w-sm mb-4">{subtitle}</p>}
      {action}
    </div>
  );
}
