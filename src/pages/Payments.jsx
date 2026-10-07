import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, CheckCircle2, Clock, AlertCircle, Search, Pencil, Trash2, Receipt } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useEntityList } from '@/lib/useEntityQuery';
import { useCurrencyRates } from '@/lib/useCurrencyRates';
import { convertAmount } from '@/lib/currencyRates';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import Modal from '@/components/Modal';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency, formatDate, isOverdue, PAYMENT_METHODS } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

export default function Payments() {
  const { config } = useData();
  const queryClient = useQueryClient();
  const { data: payments = [], isLoading: loading } = useEntityList('Payment', { sort: '-due_date', limit: 300 });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingPayment, setEditingPayment] = useState(null);
  const currency = config?.currency || 'ARS';
  const rates = useCurrencyRates();
  const toBase = (amount, cur) => convertAmount(amount, cur || 'ARS', currency, rates);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['Payment'] });
    queryClient.invalidateQueries({ queryKey: ['Sale'] });
    queryClient.invalidateQueries({ queryKey: ['Client'] });
  };

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
    collected: payments.filter(p => p.status === 'Pagado').reduce((s, p) => s + toBase(p.amount, p.currency), 0),
    pending: payments.filter(p => p.status === 'Pendiente' || p.status === 'Parcial').reduce((s, p) => s + toBase(p.amount, p.currency), 0),
    overdue: payments.filter(p => p.status !== 'Pagado' && p.status !== 'Cancelado' && isOverdue(p.due_date)).reduce((s, p) => s + toBase(p.amount, p.currency), 0),
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
          const amountInBase = toBase(p.amount, p.currency);
          await base44.entities.Client.update(client.id, {
            total_collected: (client.total_collected || 0) + amountInBase,
            balance: Math.max(0, (client.balance || 0) - amountInBase),
          });
        }
      }
    }
    invalidate();
  };

  const payVariant = (s) => ({ Pagado: 'success', Parcial: 'warning', Pendiente: 'muted', Vencido: 'destructive', Cancelado: 'muted' }[s] || 'muted');

  const handleDelete = async (p) => {
    if (!confirm(`¿Eliminar este cobro de ${formatCurrency(p.amount, p.currency || currency)}?`)) return;
    const wasPaid = p.status === 'Pagado';
    await base44.entities.Payment.delete(p.id);
    if (wasPaid && p.sale_id) {
      const sale = await base44.entities.Sale.get(p.sale_id).catch(() => null);
      if (sale) {
        const newCollected = Math.max(0, (Number(sale.collected_amount) || 0) - (Number(p.amount) || 0));
        const newBalance = Math.max(0, (Number(sale.total_amount) || 0) - newCollected);
        let ps = 'Pendiente';
        if (newBalance <= 0) ps = 'Pagado';
        else if (newCollected > 0) ps = 'Parcial';
        await base44.entities.Sale.update(sale.id, { collected_amount: newCollected, balance: newBalance, payment_status: ps });
        if (sale.client_id) {
          const client = await base44.entities.Client.get(sale.client_id).catch(() => null);
          if (client) {
            const amountInBase = toBase(p.amount, p.currency);
            await base44.entities.Client.update(client.id, {
              total_collected: Math.max(0, (Number(client.total_collected) || 0) - amountInBase),
              balance: (Number(client.balance) || 0) + amountInBase,
            });
          }
        }
      }
    }
    invalidate();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Cobros</h1>
      <p className="text-sm text-muted-foreground mb-6">Gestioná los pagos de tus ventas</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total cobros" value={payments.length} icon={Receipt} accent="#465BE8" />
        <KpiCard label="Cobrado" value={formatCurrency(totals.collected, currency)} icon={CheckCircle2} accent="#22c55e" />
        <KpiCard label="Pendiente" value={formatCurrency(totals.pending, currency)} icon={Clock} accent="#f59e0b" />
        <KpiCard label="Vencido" value={formatCurrency(totals.overdue, currency)} icon={AlertCircle} accent="#ef4444" />
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
                      <p className="font-bold">{formatCurrency(p.amount, p.currency || currency)}</p>
                      <div className="flex items-center gap-1.5 justify-end mt-1">
                        <Badge variant={payVariant(overdue ? 'Vencido' : p.status)} dot>{overdue && p.status !== 'Pagado' ? 'Vencido' : p.status}</Badge>
                        {p.status !== 'Pagado' && p.status !== 'Cancelado' && (
                          <button onClick={() => register(p)} className="px-3 py-1 rounded-lg bg-success text-white text-xs font-medium hover:opacity-90">Cobrar</button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditingPayment(p)} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center" title="Editar cobro">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p)} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center" title="Eliminar cobro">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )
      }

      <EditPaymentModal payment={editingPayment} onClose={() => setEditingPayment(null)} onSaved={() => queryClient.invalidateQueries({ queryKey: ['Payment'] })} currency={currency} />
    </div>
  );
}

function EditPaymentModal({ payment, onClose, onSaved, currency }) {
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [method, setMethod] = useState('Transferencia');
  const [saving, setSaving] = useState(false);
  const open = !!payment;

  useEffect(() => {
    if (payment) {
      setAmount(String(payment.amount ?? ''));
      setDueDate((payment.due_date || '').slice(0, 10));
      setMethod(payment.method || 'Transferencia');
    }
  }, [payment]);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Payment.update(payment.id, {
        amount: Number(amount) || 0, due_date: dueDate, method,
      });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar cobro"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Monto</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Fecha de vencimiento</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Medio de pago</label>
          <StyledSelect value={method} onChange={e => setMethod(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </StyledSelect>
        </div>
      </div>
    </Modal>
  );
}
