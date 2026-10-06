import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, CheckCircle2, Clock, AlertCircle, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { formatCurrency, formatDate, isOverdue, PAYMENT_METHODS } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

export default function Payments() {
  const { config } = useData();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const currency = config?.currency || 'ARS';

  const load = async () => {
    setLoading(true);
    try { setPayments(await base44.entities.Payment.list('-due_date', 300).catch(() => [])); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || [p.client_name, p.sale_number].some(v => (v || '').toLowerCase().includes(q));
    const overdue = p.status !== 'Pagado' && p.status !== 'Cancelado' && isOverdue(p.due_date);
    const matchF = filter === 'all' ? true :
      filter === 'pending' ? (p.status === 'Pendiente' || p.status === 'Parcial') && !overdue :
      filter === 'paid' ? p.status === 'Pagado' :
      filter === 'overdue' ? overdue : true;
    return matchQ && matchF;
  });

  const totals = {
    collected: payments.filter(p => p.status === 'Pagado').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    pending: payments.filter(p => p.status === 'Pendiente' || p.status === 'Parcial').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    overdue: payments.filter(p => p.status !== 'Pagado' && p.status !== 'Cancelado' && isOverdue(p.due_date)).reduce((s, p) => s + (Number(p.amount) || 0), 0),
  };

  const register = async (p) => {
    await base44.entities.Payment.update(p.id, { status: 'Pagado', paid_date: new Date().toISOString().slice(0, 10) });
    // recalc sale
    const allP = payments.map(x => x.id === p.id ? { ...x, status: 'Pagado' } : x);
    const salePays = allP.filter(x => x.sale_id === p.sale_id);
    const collected = salePays.filter(x => x.status === 'Pagado').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const sale = await base44.entities.Sale.get(p.sale_id).catch(() => null);
    if (sale) {
      const balance = sale.total_amount - collected;
      let ps = 'Pendiente';
      if (balance <= 0) ps = 'Pagado';
      else if (collected > 0) ps = 'Parcial';
      await base44.entities.Sale.update(sale.id, { collected_amount: collected, balance, payment_status: ps });
      // update client
      if (sale.client_id) {
        const client = await base44.entities.Client.get(sale.client_id).catch(() => null);
        if (client) {
          await base44.entities.Client.update(client.id, {
            total_collected: (client.total_collected || 0) + (Number(p.amount) || 0),
            balance: Math.max(0, (client.balance || 0) - (Number(p.amount) || 0)),
          });
        }
      }
    }
    load();
  };

  const payVariant = (s) => ({ Pagado: 'success', Parcial: 'warning', Pendiente: 'muted', Vencido: 'destructive', Cancelado: 'muted' }[s] || 'muted');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Cobros</h1>
      <p className="text-sm text-muted-foreground mb-6">Gestioná los pagos de tus ventas</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-success" /><p className="text-xs text-muted-foreground">Cobrado</p></div>
          <p className="text-xl font-bold text-success">{formatCurrency(totals.collected, currency)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-warning" /><p className="text-xs text-muted-foreground">Pendiente</p></div>
          <p className="text-xl font-bold text-warning">{formatCurrency(totals.pending, currency)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-destructive" /><p className="text-xs text-muted-foreground">Vencido</p></div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totals.overdue, currency)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente o venta…"
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-1.5">
          {[{k:'all',l:'Todos'},{k:'pending',l:'Pendientes'},{k:'overdue',l:'Vencidos'},{k:'paid',l:'Pagados'}].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={cn('px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap', filter === f.k ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-accent')}>{f.l}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="Sin cobros" subtitle="Los pagos de tus ventas aparecerán acá." />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map(p => {
                const overdue = p.status !== 'Pagado' && p.status !== 'Cancelado' && isOverdue(p.due_date);
                return (
                  <motion.div key={p.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={cn('bg-card rounded-2xl border p-4 flex items-center gap-4', overdue ? 'border-destructive/30' : 'border-border')}>
                    <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', p.status === 'Pagado' ? 'bg-success/10 text-success' : overdue ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning')}>
                      <Wallet className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{p.client_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{p.sale_number} · Cuota {p.installment_number}/{p.total_installments} · Vence {formatDate(p.due_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatCurrency(p.amount, currency)}</p>
                      <div className="flex items-center gap-1.5 justify-end mt-1">
                        <Badge variant={payVariant(overdue ? 'Vencido' : p.status)} dot>{overdue && p.status !== 'Pagado' ? 'Vencido' : p.status}</Badge>
                        {p.status !== 'Pagado' && p.status !== 'Cancelado' && (
                          <button onClick={() => register(p)} className="px-3 py-1 rounded-lg bg-success text-white text-xs font-medium hover:opacity-90">Cobrar</button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )
      }
    </div>
  );
}
