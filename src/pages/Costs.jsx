import React, { useState, useMemo } from 'react';
import { Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { useEntityList, useEntityMutations } from '@/lib/useEntityQuery';
import { useCurrencyRates } from '@/lib/useCurrencyRates';
import { convertAmount } from '@/lib/currencyRates';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import Modal from '@/components/Modal';
import { formatCurrency, formatDate, inPeriod } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const EXPENSE_CATEGORIES = [
  { value: 'Alquiler', chip: 'bg-destructive/10 text-destructive border-destructive/30', color: 'hsl(var(--destructive))' },
  { value: 'Luz', chip: 'bg-warning/15 text-warning border-warning/30', color: 'hsl(var(--warning))' },
  { value: 'Personal', chip: 'bg-primary/10 text-primary border-primary/30', color: 'hsl(var(--primary))' },
  { value: 'Insumos', chip: 'bg-success/15 text-success border-success/30', color: 'hsl(var(--success))' },
];
const CUSTOM_CHIP = 'bg-secondary text-foreground border-border';
const CUSTOM_COLOR = 'hsl(var(--muted-foreground))';
const categoryStyle = (cat) => EXPENSE_CATEGORIES.find(c => c.value === cat) || { chip: CUSTOM_CHIP, color: CUSTOM_COLOR };

const PERIOD_OPTIONS = [
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo' },
];

export default function Costs() {
  const { config } = useData();
  const currency = config?.currency || 'ARS';
  const rates = useCurrencyRates();
  const toBase = (amount, cur) => convertAmount(amount, cur || 'ARS', currency, rates);

  const { data: expenses = [], isLoading: loadingExpenses } = useEntityList('Expense', { sort: '-expense_date' });
  const { data: sales = [], isLoading: loadingSales } = useEntityList('Sale', { sort: '-date' });
  const mutations = useEntityMutations('Expense');

  const [period, setPeriod] = useState('month');
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fExpenses = useMemo(() => expenses.filter(e => period === 'all' || inPeriod(e.expense_date, period)), [expenses, period]);
  const fSales = useMemo(() => sales.filter(s => s.status !== 'Cancelada' && (period === 'all' || inPeriod(s.date, period))), [sales, period]);

  const totals = useMemo(() => {
    const revenue = fSales.reduce((s, x) => s + toBase(x.total_amount, x.currency), 0);
    const spent = fExpenses.reduce((s, x) => s + toBase(x.amount, x.currency), 0);
    return { revenue, spent, profit: revenue - spent };
  }, [fSales, fExpenses, rates, currency]);

  const byCategory = useMemo(() => {
    const map = {};
    fExpenses.forEach(e => {
      const key = e.category || 'Otro';
      map[key] = (map[key] || 0) + toBase(e.amount, e.currency);
    });
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [fExpenses, rates, currency]);

  const maxCategoryAmount = byCategory[0]?.amount || 1;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await mutations.remove.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const loading = loadingExpenses || loadingSales;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 sm:w-7 sm:h-7 text-primary" /> Costos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gastos operativos y cuánto estás ganando realmente.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
            {PERIOD_OPTIONS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  period === p.value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setForm({})}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nuevo gasto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard label="Ganancia real" value={formatCurrency(totals.profit, currency)}
          icon={totals.profit >= 0 ? TrendingUp : TrendingDown} accent={totals.profit >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
          sublabel="Ventas menos gastos operativos" />
        <KpiCard label="Ingresos" value={formatCurrency(totals.revenue, currency)} icon={Wallet} accent="hsl(var(--primary))" />
        <KpiCard label="Gastos" value={formatCurrency(totals.spent, currency)} icon={Receipt} accent="hsl(var(--destructive))" />
      </div>

      {byCategory.length > 0 && (
        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 mb-6">
          <p className="text-sm font-semibold mb-3">En qué gastaste más</p>
          <div className="space-y-2.5">
            {byCategory.map(c => {
              const style = categoryStyle(c.category);
              const pct = totals.spent > 0 ? Math.round((c.amount / totals.spent) * 100) : 0;
              return (
                <div key={c.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{c.category}</span>
                    <span className="text-muted-foreground">{formatCurrency(c.amount, currency)} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (c.amount / maxCategoryAmount) * 100)}%`, background: style.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : fExpenses.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin gastos en este período" subtitle="Registrá tu primer gasto para empezar a ver la ganancia real." />
      ) : (
        <div className="space-y-2">
          {fExpenses.map(e => {
            const style = categoryStyle(e.category);
            return (
              <div key={e.id} className="bg-card rounded-xl border border-border card-shadow p-3.5 flex items-center gap-3 flex-wrap">
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium border shrink-0', style.chip)}>{e.category}</span>
                <div className="flex-1 min-w-[140px]">
                  {e.description && <p className="text-sm">{e.description}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(e.expense_date)}</p>
                </div>
                <p className="font-semibold text-sm shrink-0">{formatCurrency(e.amount, e.currency || currency)}</p>
                <button onClick={() => setForm(e)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent shrink-0">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => setDeleteTarget(e)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 shrink-0">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ExpenseFormModal form={form} onClose={() => setForm(null)} mutations={mutations} />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="¿Eliminar gasto?" size="sm"
        footer={<>
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
          <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90">Eliminar</button>
        </>}>
        <p className="text-sm text-muted-foreground">Se va a eliminar este gasto.</p>
      </Modal>
    </div>
  );
}

function ExpenseFormModal({ form, onClose, mutations }) {
  const [category, setCategory] = useState(null);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');

  React.useEffect(() => {
    if (!form) return;
    const isKnown = EXPENSE_CATEGORIES.some(c => c.value === form.category);
    setCategory(form.category ? (isKnown ? form.category : 'custom') : null);
    setCustomCategory(isKnown ? '' : (form.category || ''));
    setDescription(form.description || '');
    setAmount(form.amount ?? '');
    setExpenseDate(form.expense_date || new Date().toISOString().slice(0, 10));
  }, [form]);

  if (!form) return null;
  const isEdit = !!form.id;
  const isCustom = category === 'custom';
  const finalCategory = isCustom ? customCategory.trim() : (category || '');

  const save = async () => {
    if (!finalCategory || !amount) return;
    const payload = { category: finalCategory, description: description.trim(), amount: Number(amount) || 0, expense_date: expenseDate };
    if (isEdit) await mutations.update.mutateAsync({ id: form.id, ...payload });
    else await mutations.create.mutateAsync(payload);
    onClose();
  };

  return (
    <Modal open={!!form} onClose={onClose} title={isEdit ? 'Editar gasto' : 'Nuevo gasto'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={!finalCategory || !amount} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">Guardar</button>
      </>}>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Categoría</p>
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map(c => (
              <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-opacity',
                  c.chip, category === c.value ? 'opacity-100 ring-2 ring-offset-1 ring-offset-card' : 'opacity-50 hover:opacity-80')}>
                {c.value}
              </button>
            ))}
            <button type="button" onClick={() => setCategory('custom')}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-opacity',
                CUSTOM_CHIP, isCustom ? 'opacity-100 ring-2 ring-offset-1 ring-offset-card' : 'opacity-50 hover:opacity-80')}>
              Otro
            </button>
          </div>
        </div>
        {isCustom && (
          <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Nombre de la categoría"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        )}
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle (opcional)"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
    </Modal>
  );
}
