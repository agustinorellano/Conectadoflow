import React, { useState } from 'react';
import { Store, ChevronDown, Check } from 'lucide-react';
import { useCommerce } from '@/lib/CommerceContext';
import { cn } from '@/lib/utils';

export default function CommerceSelector() {
  const { commerces, currentCommerceId, setCurrentCommerceId, loading } = useCommerce();
  const [open, setOpen] = useState(false);

  if (loading || commerces.length <= 1) return null;

  const current = commerces.find(c => c.id === currentCommerceId);
  const label = currentCommerceId === 'all' ? 'Todos los comercios' : current?.name || 'Todos los comercios';

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-soft text-primary text-sm font-medium hover:opacity-90 transition-colors">
        <Store className="w-4 h-4" />
        <span className="hidden sm:inline truncate max-w-[140px]">{label}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-20 py-1">
            <button onClick={() => { setCurrentCommerceId('all'); setOpen(false); }}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left', currentCommerceId === 'all' && 'text-primary font-medium')}>
              <Store className="w-4 h-4" /> Todos los comercios
              {currentCommerceId === 'all' && <Check className="w-4 h-4 ml-auto" />}
            </button>
            <div className="border-t border-border my-1" />
            {commerces.map(c => (
              <button key={c.id} onClick={() => { setCurrentCommerceId(c.id); setOpen(false); }}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left', currentCommerceId === c.id && 'text-primary font-medium')}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.primary_color || '#465BE8' }} />
                <span className="truncate">{c.name}</span>
                {currentCommerceId === c.id && <Check className="w-4 h-4 ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
