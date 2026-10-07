import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, UserPlus, Users, KanbanSquare, Calendar, ShoppingCart, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { canAccessPath } from '@/lib/roles';

const ACTIONS = [
  { label: 'Lead', icon: UserPlus, color: 'bg-violet-500', to: '/leads?new=1' },
  { label: 'Cliente', icon: Users, color: 'bg-blue-500', to: '/clientes?new=1' },
  { label: 'Oportunidad', icon: KanbanSquare, color: 'bg-indigo-500', to: '/pipeline?new=1' },
  { label: 'Reunión', icon: Calendar, color: 'bg-cyan-500', to: '/reuniones?new=1' },
  { label: 'Venta', icon: ShoppingCart, color: 'bg-emerald-500', to: '/ventas?new=1' },
  { label: 'Pago', icon: Wallet, color: 'bg-amber-500', to: '/cobros?new=1' },
];

export default function FAB({ open, setOpen }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || 'user';
  const actions = ACTIONS.filter(a => canAccessPath(role, a.to.split('?')[0]));

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <>
            {actions.map((a, i) => (
              <motion.button
                key={a.label}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ delay: (actions.length - i) * 0.04 }}
                onClick={() => go(a.to)}
                className="flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-2xl bg-card border border-border floating-island hover:scale-[1.03] transition-transform"
              >
                <span className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-white', a.color)}>
                  <a.icon className="w-4 h-4" />
                </span>
                <span className="text-sm font-medium">{a.label}</span>
              </motion.button>
            ))}
          </>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center floating-island hover:shadow-xl transition-shadow"
      >
        <motion.div animate={{ rotate: open ? 135 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </motion.div>
      </motion.button>
    </div>
  );
}
