import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, AlertCircle, UserPlus, CheckCircle2, Megaphone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { useCommerce } from '@/lib/CommerceContext';
import { useEntityList } from '@/lib/useEntityQuery';
import { isOverdue, formatDate } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const NOTIF_KEY = (userId) => ['Notification', 'list', { filter: { owner_id: userId, is_read: false }, sort: '-created_date', limit: 20 }];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { config } = useData();
  const { filterByCommerce } = useCommerce();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Shares its cache key with Dashboard/Analytics/Reportes (same entities,
  // no filter/sort/limit) — opening the bell after any of those pages
  // doesn't re-fetch Payment/Lead/Activity again.
  const { data: payments = [] } = useEntityList('Payment', { enabled: !!user });
  const { data: leads = [] } = useEntityList('Lead', { enabled: !!user });
  const { data: activities = [] } = useEntityList('Activity', { enabled: !!user });
  const { data: notifications = [] } = useEntityList('Notification', {
    filter: user ? { owner_id: user.id, is_read: false } : undefined,
    sort: '-created_date', limit: 20, enabled: !!user,
  });

  const items = useMemo(() => {
    if (!user) return [];
    const adminNotifications = notifications.map(n => ({
      id: n.id,
      type: 'notification',
      icon: Megaphone,
      color: 'text-primary bg-primary/10',
      title: n.title,
      subtitle: n.message,
      link: n.link || null,
      isAdminNotification: true,
    }));
    const fPayments = filterByCommerce(payments);
    const fLeads = filterByCommerce(leads);
    const fActivities = filterByCommerce(activities);

    const todayStr = new Date().toISOString().slice(0, 10);

    const overduePayments = fPayments
      .filter(p => p.status !== 'Pagado' && p.status !== 'Cancelado' && isOverdue(p.due_date))
      .slice(0, 5)
      .map(p => ({
        id: 'pay-' + p.id,
        type: 'payment',
        icon: AlertCircle,
        color: 'text-destructive bg-destructive/10',
        title: `Cobro vencido: ${p.client_name}`,
        subtitle: `${p.sale_number} · Vencía ${formatDate(p.due_date)}`,
        link: '/cobros',
      }));

    const untouchedLeads = fLeads
      .filter(l => l.status === 'Nuevo')
      .slice(0, 5)
      .map(l => ({
        id: 'lead-' + l.id,
        type: 'lead',
        icon: UserPlus,
        color: 'text-violet-600 bg-violet-500/10',
        title: `Lead sin contactar: ${l.first_name} ${l.last_name || ''}`.trim(),
        subtitle: l.source || 'Sin fuente',
        link: '/leads',
      }));

    const todayActivities = fActivities
      .filter(a => a.status === 'Pendiente' && a.due_date === todayStr)
      .slice(0, 5)
      .map(a => ({
        id: 'act-' + a.id,
        type: 'activity',
        icon: CheckCircle2,
        color: 'text-primary bg-primary/10',
        title: a.title,
        subtitle: a.client_name || 'Sin cliente',
        link: '/clientes',
      }));

    return [...adminNotifications, ...overduePayments, ...untouchedLeads, ...todayActivities];
  }, [user, notifications, payments, leads, activities, filterByCommerce]);

  const count = items.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative"
      >
        <Bell className="w-[18px] h-[18px]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm">Notificaciones</p>
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto thin-scrollbar">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Estás al día 🎉</p>
                ) : (
                  items.map(item => (
                    <button
                      key={item.id}
                      onClick={async () => {
                        setOpen(false);
                        if (item.isAdminNotification) {
                          base44.entities.Notification.update(item.id, { is_read: true }).catch(() => {});
                          queryClient.setQueryData(NOTIF_KEY(user.id), (prev) => (prev || []).filter(n => n.id !== item.id));
                        }
                        if (item.link) navigate(item.link);
                      }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left border-b border-border/50 last:border-0"
                    >
                      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.color)}>
                        <item.icon className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
