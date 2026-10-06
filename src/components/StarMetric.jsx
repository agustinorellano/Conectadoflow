import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StarMetric({ label, value, sublabel, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
      style={{
        background: 'linear-gradient(135deg, hsl(232 78% 59%) 0%, hsl(252 80% 55%) 100%)',
      }}
    >
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute right-4 bottom-4 text-white/10">
        {Icon && <Icon className="w-24 h-24" strokeWidth={1} />}
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 text-white text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" /> Destacado del mes
          </span>
        </div>
        <p className="text-white/80 text-sm font-medium">{label}</p>
        <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-1">{value}</p>
        {sublabel && <p className="text-white/70 text-sm mt-2">{sublabel}</p>}
      </div>
    </motion.div>
  );
}
