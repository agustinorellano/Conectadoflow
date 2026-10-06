import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Phone, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, daysUntil } from '@/lib/flowUtils';

export default function SituationStatus({ client, opportunity }) {
  const nextMeeting = client?.next_meeting_date || opportunity?.next_meeting_date;
  const potential = client?.potential_value || opportunity?.amount;
  const lastContact = client?.last_contact;
  const nextAction = client?.next_action || opportunity?.next_action;
  const stage = opportunity?.stage || client?.status;

  const items = [
    { icon: TrendingUp, label: 'Estado', value: stage || 'Activo', color: 'text-primary' },
    { icon: Clock, label: 'Próxima acción', value: nextAction || '—' },
    { icon: Phone, label: 'Último contacto', value: lastContact ? formatDateTime(lastContact) : '—' },
    { icon: Calendar, label: 'Próxima reunión', value: nextMeeting ? formatDateTime(nextMeeting) : 'Sin programar', highlight: nextMeeting && daysUntil(nextMeeting) <= 3 },
    { icon: DollarSign, label: 'Valor potencial', value: potential ? formatCurrency(potential) : '—', color: 'text-success' },
  ];

  return (
    <div className="bg-gradient-to-br from-primary-soft/60 to-card rounded-2xl border border-primary/15 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <h3 className="text-sm font-semibold">Estado de situación</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-start gap-2.5 p-3 rounded-xl bg-card/60 ${item.highlight ? 'ring-1 ring-warning/40' : ''}`}
          >
            <item.icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color || 'text-muted-foreground'}`} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-medium truncate">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
