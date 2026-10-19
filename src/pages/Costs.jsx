import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Repeat, Power, PowerOff, CalendarClock } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { base44 } from '@/api/base44Client';
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

// Compartido entre el form de gasto puntual y el de gasto recurrente.
function CategoryPicker({ category, onCategory, customCategory, onCustomCategory }) {
  const isCustom = category === 'custom';
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Categoría</p>
      <div className="flex flex-wrap gap-1.5">
        {EXPENSE_CATEGORIES.map(c => (
          <button key={c.value} type="button" onClick={() => onCategory(c.value)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-opacity',
              c.chip, category === c.value ? 'opacity-100 ring-2 ring-offset-1 ring-offset-card' : 'opacity-50 hover:opacity-80')}>
            {c.value}
          </button>
        ))}
        <button type="button" onClick={() => onCategory('custom')}
          className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-opacity',
            CUSTOM_CHIP, isCustom ? 'opacity-100 ring-2 ring-offset-1 ring-offset-card' : 'opacity-50 hover:opacity-80')}>
          Otro
        </button>
      </div>
      {isCustom && (
        <input value={customCategory} onChange={e => onCustomCategory(e.target.value)} placeholder="Nombre de la categoría"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      )}
    </div>
  );
}

// "Este mes" en forma YYYY-MM, para saber si ya existe un gasto generado
// desde una plantilla recurrente en el mes en curso.
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Costs() {
  const { config } = useData();
  const currency = config?.currency || 'ARS';
  const rates = useCurrencyRates();
  const toBase = (amount, cur) => convertAmount(amount, cur || 'ARS', currency, rates);
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading: loadingExpenses } = useEntityList('Expense', { sort: '-expense_date' });
  const { data: sales = [], isLoading: loadingSales } = useEntityList('Sale', { sort: '-date' });
  const { data: recurring = [], isLoading: loadingRecurring } = useEntityList('RecurringExpense', { sort: 'category' });
  const mutations = useEntityMutations('Expense');
  const recurringMutations = useEntityMutations('RecurringExpense');

  const [period, setPeriod] = useState('month');
  const [form, setForm] = useState(null);
  const [recurringForm, setRecurringForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Plantillas activas que ya tienen un gasto real cargado este mes
  // (recurring_expense_id las vincula) vs. las que todavía no.
  const monthKey = currentMonthKey();
  const generatedThisMonth = useMemo(() => new Set(
    expenses.filter(e => e.recurring_expense_id && (e.expense_date || '').slice(0, 7) === monthKey).map(e => e.recurring_expense_id)
  ), [expenses, monthKey]);
  const pendingRecurring = recurring.filter(r => r.is_active !== false && !generatedThisMonth.has(r.id));

  const generatePending = async () => {
    if (pendingRecurring.length === 0) return;
    setGenerating(true);
    try {
      const today = new Date();
      for (const r of pendingRecurring) {
        const day = Math.min(r.day_of_month || 1, 28);
        const date = new Date(today.getFullYear(), today.getMonth(), day).toISOString().slice(0, 10);
        await base44.entities.Expense.create({
          category: r.category, description: r.description, amount: r.amount, currency: r.currency,
          expense_date: date, recurring_expense_id: r.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['Expense'] });
    } finally { setGenerating(false); }
  };

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

  const loading = loadingExpenses || loadingSales || loadingRecurring;

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

      <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Repeat className="w-4 h-4 text-primary" /> Gastos recurrentes</p>
          <button onClick={() => setRecurringForm({})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-input hover:bg-accent">
            <Plus className="w-3.5 h-3.5" /> Programar gasto
          </button>
        </div>

        {pendingRecurring.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-warning/10 text-warning rounded-xl px-3.5 py-2.5 mb-3">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4" /> Tenés {pendingRecurring.length} gasto{pendingRecurring.length > 1 ? 's' : ''} recurrente{pendingRecurring.length > 1 ? 's' : ''} sin cargar este mes.
            </p>
            <button onClick={generatePending} disabled={generating}
              className="px-3 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0">
              {generating ? 'Cargando…' : 'Cargar ahora'}
            </button>
          </div>
        )}

        {recurring.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Sin gastos programados. Usalo para alquiler, luz, sueldos u otro costo que se repite todos los meses.</p>
        ) : (
          <div className="space-y-2">
            {recurring.map(r => {
              const style = categoryStyle(r.category);
              const isPending = pendingRecurring.some(p => p.id === r.id);
              return (
                <div key={r.id} className={cn('flex items-center gap-2 flex-wrap rounded-xl border border-border p-2.5', r.is_active === false && 'opacity-50')}>
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium border shrink-0', style.chip)}>{r.category}</span>
                  <div className="flex-1 min-w-[120px]">
                    {r.description && <p className="text-sm">{r.description}</p>}
                    <p className="text-xs text-muted-foreground">Día {r.day_of_month} de cada mes{isPending && r.is_active !== false ? ' · pendiente este mes' : ''}</p>
                  </div>
                  <p className="font-semibold text-sm shrink-0">{formatCurrency(r.amount, r.currency || currency)}</p>
                  <button onClick={() => recurringMutations.update.mutate({ id: r.id, is_active: r.is_active === false })}
                    title={r.is_active === false ? 'Reactivar' : 'Pausar'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent shrink-0">
                    {r.is_active === false ? <Power className="w-4 h-4 text-muted-foreground" /> : <PowerOff className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <button onClick={() => setRecurringForm(r)} title="Editar monto u otros datos"
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent shrink-0">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => recurringMutations.remove.mutate(r.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 shrink-0">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
      <RecurringExpenseFormModal form={recurringForm} onClose={() => setRecurringForm(null)} mutations={recurringMutations} />

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
        <CategoryPicker category={category} onCategory={setCategory} customCategory={customCategory} onCustomCategory={setCustomCategory} />
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

// Plantilla de gasto mensual: categoría, monto (el que se actualiza
// cuando cambia el precio — alquiler que sube, etc.) y qué día del mes
// corresponde. No genera el gasto real solo, eso lo dispara el botón
// "Cargar ahora" del banner cuando corresponde.
function RecurringExpenseFormModal({ form, onClose, mutations }) {
  const [category, setCategory] = useState(null);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');

  React.useEffect(() => {
    if (!form) return;
    const isKnown = EXPENSE_CATEGORIES.some(c => c.value === form.category);
    setCategory(form.category ? (isKnown ? form.category : 'custom') : null);
    setCustomCategory(isKnown ? '' : (form.category || ''));
    setDescription(form.description || '');
    setAmount(form.amount ?? '');
    setDayOfMonth(String(form.day_of_month || 1));
  }, [form]);

  if (!form) return null;
  const isEdit = !!form.id;
  const isCustom = category === 'custom';
  const finalCategory = isCustom ? customCategory.trim() : (category || '');

  const save = async () => {
    if (!finalCategory || !amount) return;
    const payload = {
      category: finalCategory, description: description.trim(), amount: Number(amount) || 0,
      day_of_month: Math.min(28, Math.max(1, Number(dayOfMonth) || 1)),
    };
    if (isEdit) await mutations.update.mutateAsync({ id: form.id, ...payload });
    else await mutations.create.mutateAsync(payload);
    onClose();
  };

  return (
    <Modal open={!!form} onClose={onClose} title={isEdit ? 'Editar gasto recurrente' : 'Programar gasto mensual'}
      subtitle={isEdit ? 'Si el precio cambió, actualizalo acá — no afecta los gastos de meses anteriores.' : undefined}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={!finalCategory || !amount} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">Guardar</button>
      </>}>
      <div className="space-y-3">
        <CategoryPicker category={category} onCategory={setCategory} customCategory={customCategory} onCustomCategory={setCustomCategory} />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle (opcional)"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto mensual"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <div>
            <input type="number" min={1} max={28} value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} placeholder="Día del mes"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <p className="text-[11px] text-muted-foreground mt-1">Día 1-28</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
