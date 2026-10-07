import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, UserPlus, Wallet, Package, Award,
  ChevronDown, ArrowRight, CheckCircle2, Circle, Store, Eye, EyeOff, Trophy,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import { useCommerce } from '@/lib/CommerceContext';
import KpiCard from '@/components/KpiCard';
import StatCard from '@/components/StatCard';
import Badge from '@/components/Badge';
import SalesByEntityChart from '@/components/SalesByEntityChart';
import DashboardPills from '@/components/DashboardPills';
import MonthlyGoalCard from '@/components/MonthlyGoalCard';
import IncomeCard from '@/components/IncomeCard';
import SalesReportChart from '@/components/SalesReportChart';
import TopProductCard from '@/components/TopProductCard';
import RecentSalesTable from '@/components/RecentSalesTable';
import DateWeatherWidget from '@/components/DateWeatherWidget';
import ProgressBar from '@/components/ProgressBar';
import {
  formatCurrency, formatDateTime, inPeriod, previousPeriodAmount,
  variation, daysUntil, isOverdue,
} from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

// Buckets records into a fixed number of trailing days (counts, or a summed
// value when valueFn is given) for the small KPI-card trend charts.
function buildDailySeries(records, dateField, valueFn, days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return { time: d.getTime(), total: 0 };
  });
  records.forEach(r => {
    const raw = r[dateField];
    if (!raw) return;
    const d = new Date(raw);
    d.setHours(0, 0, 0, 0);
    const bucket = buckets.find(b => b.time === d.getTime());
    if (bucket) bucket.total += valueFn ? valueFn(r) : 1;
  });
  return buckets.map(b => b.total);
}

// Revenue series for the big sales-report chart, bucketed to fit the
// selected dashboard period: daily for short windows, grouped into ~14
// points for longer ones so the chart stays readable.
function buildPeriodSeries(sales, period) {
  const now = new Date();
  const days = { today: 1, '7d': 7, '30d': 30, month: now.getDate(), '3m': 90, year: 365 }[period] || 30;
  const notCancelled = sales.filter(s => s.status !== 'Cancelada');
  const daily = buildDailySeries(notCancelled, 'date', s => Number(s.total_amount) || 0, days);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const maxPoints = 14;
  if (days <= maxPoints) {
    return daily.map((v, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return { label: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }), value: v };
    });
  }
  const bucketSize = Math.ceil(days / maxPoints);
  const grouped = [];
  for (let i = 0; i < days; i += bucketSize) {
    const slice = daily.slice(i, i + bucketSize);
    const d = new Date(start); d.setDate(d.getDate() + i);
    grouped.push({ label: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }), value: slice.reduce((a, b) => a + b, 0) });
  }
  return grouped;
}

const PERIODS = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'month', label: 'Este mes' },
  { key: '3m', label: '3 meses' },
  { key: 'year', label: 'Este año' },
];

export default function Dashboard() {
  const { config } = useData();
  const { user } = useAuth();
  const { filterByCommerce, currentCommerceId, setCurrentCommerceId, commerces } = useCommerce();
  const [period, setPeriod] = useState('month');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [view, setView] = useState('general');
  const [hideAmounts, setHideAmounts] = useState(false);
  const [data, setData] = useState({ sales: [], leads: [], clients: [], payments: [], opportunities: [], meetings: [], activities: [], products: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [sales, leads, clients, payments, opportunities, meetings, activities, products] = await Promise.all([
        base44.entities.Sale.list().catch(() => []),
        base44.entities.Lead.list().catch(() => []),
        base44.entities.Client.list().catch(() => []),
        base44.entities.Payment.list().catch(() => []),
        base44.entities.Opportunity.list().catch(() => []),
        base44.entities.Meeting.list().catch(() => []),
        base44.entities.Activity.list().catch(() => []),
        base44.entities.Product.list().catch(() => []),
      ]);
      setData({ sales, leads, clients, payments, opportunities, meetings, activities, products });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const currency = config?.currency || 'ARS';
  const isAllCommerces = currentCommerceId === 'all' && commerces.length > 1;
  const amount = (v) => hideAmounts ? '••••••' : formatCurrency(v, currency);

  const stats = useMemo(() => {
    const fSales = filterByCommerce(data.sales);
    const fLeads = filterByCommerce(data.leads);
    const fClients = filterByCommerce(data.clients);
    const fPayments = filterByCommerce(data.payments);
    const fOpps = filterByCommerce(data.opportunities);
    const fMeetings = filterByCommerce(data.meetings);
    const fActivities = filterByCommerce(data.activities);
    const fProducts = filterByCommerce(data.products);

    const periodSales = fSales.filter(s => s.status !== 'Cancelada' && inPeriod(s.date, period));
    const revenue = periodSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
    const prevRevenue = previousPeriodAmount(fSales.filter(s => s.status !== 'Cancelada'), 'date', 'total_amount', period);
    const salesCount = periodSales.length;
    const prevSalesCount = previousPeriodAmount(fSales.filter(s => s.status !== 'Cancelada'), 'date', '1', period);
    const periodLeads = fLeads.filter(l => inPeriod(l.created_date, period));
    const leadsCount = periodLeads.length;
    const prevLeadsCount = previousPeriodAmount(fLeads, 'created_date', '1', period);
    const avgTicket = salesCount ? revenue / salesCount : 0;

    const collected = fPayments.filter(p => p.status === 'Pagado' && inPeriod(p.paid_date || p.due_date, period)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pending = fPayments.filter(p => p.status === 'Pendiente' || p.status === 'Parcial').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const overdue = fPayments.filter(p => (p.status === 'Pendiente' || p.status === 'Parcial' || p.status === 'Vencido') && isOverdue(p.due_date)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const inPipeline = fOpps.filter(o => !o.is_won && !o.is_lost).reduce((s, o) => s + (Number(o.amount) || 0), 0);

    const funnelStages = ['Nuevo lead','Contactado','Calificado','Reunión','Propuesta','Negociación','Ganado'];
    const funnel = funnelStages.map(stage => ({
      stage,
      count: fOpps.filter(o => o.stage === stage || (stage === 'Ganado' && o.is_won)).length,
    }));

    const now = new Date();
    const upcomingMeetings = fMeetings.filter(m => m.status === 'Programada' && new Date(m.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
    const pendingActivities = fActivities.filter(a => a.status === 'Pendiente').sort((a, b) => new Date(a.due_date || a.date) - new Date(b.due_date || b.date)).slice(0, 5);
    const topClients = [...fClients].map(c => ({ ...c, score: Number(c.total_sold) || 0 })).sort((a, b) => b.score - a.score).slice(0, 5);

    const commerceBreakdown = commerces.map(c => {
      const cSales = data.sales.filter(s => s.status !== 'Cancelada' && (s.commerce_id === c.id || (!s.commerce_id && c.id === commerces[0]?.id)));
      const cRevenue = cSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
      const cClients = data.clients.filter(cl => cl.commerce_id === c.id || (!cl.commerce_id && c.id === commerces[0]?.id)).length;
      const cLeads = data.leads.filter(l => l.commerce_id === c.id || (!l.commerce_id && c.id === commerces[0]?.id)).length;
      const cPending = data.payments.filter(p => (p.status === 'Pendiente' || p.status === 'Parcial') && (p.commerce_id === c.id || (!p.commerce_id && c.id === commerces[0]?.id))).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      return { id: c.id, name: c.name, revenue: cRevenue, salesCount: cSales.length, clients: cClients, leads: cLeads, pending: cPending };
    }).filter(c => c.salesCount > 0 || c.clients > 0);

    const sellerMap = {};
    periodSales.forEach(s => {
      const key = s.owner_name || 'Sin asignar';
      if (!sellerMap[key]) sellerMap[key] = { name: key, revenue: 0, count: 0 };
      sellerMap[key].revenue += Number(s.total_amount) || 0;
      sellerMap[key].count++;
    });
    const sellerBreakdown = Object.values(sellerMap).sort((a, b) => b.revenue - a.revenue);
    const topSeller = sellerBreakdown[0] || null;

    const monthlyGoal = config?.monthly_goal ? Number(config.monthly_goal) : Math.max(revenue, 1) * 1.2;
    const monthlyGoalIsEstimated = !config?.monthly_goal;

    const notCancelledSales = fSales.filter(s => s.status !== 'Cancelada');
    const revenueSparkline = buildDailySeries(notCancelledSales, 'date', s => Number(s.total_amount) || 0);
    const salesSparkline = buildDailySeries(notCancelledSales, 'date');
    const leadsSparkline = buildDailySeries(fLeads, 'created_date');
    const collectedSparkline = buildDailySeries(fPayments.filter(p => p.status === 'Pagado'), 'paid_date', p => Number(p.amount) || 0);
    const salesReportSeries = buildPeriodSeries(fSales, period);

    const productUnits = {};
    periodSales.forEach(s => {
      (s.items || []).forEach(it => {
        const name = it.description || 'Sin nombre';
        productUnits[name] = (productUnits[name] || 0) + (Number(it.quantity) || 0);
      });
    });
    const topProductEntry = Object.entries(productUnits).sort((a, b) => b[1] - a[1])[0];
    const topProduct = topProductEntry ? { name: topProductEntry[0], units: topProductEntry[1] } : null;

    const recentSales = [...periodSales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
    const totalProductsCount = fProducts.filter(p => p.is_active !== false).length;

    return {
      revenue, prevRevenue, salesCount, prevSalesCount, leadsCount, prevLeadsCount, avgTicket,
      collected, pending, overdue, inPipeline, funnel, upcomingMeetings, pendingActivities, topClients,
      commerceBreakdown, sellerBreakdown, topSeller, monthlyGoal, monthlyGoalIsEstimated, fSales,
      revenueSparkline, salesSparkline, leadsSparkline, collectedSparkline,
      salesReportSeries, topProduct, recentSales, totalProductsCount,
    };
  }, [data, period, filterByCommerce, commerces, config]);

  const toggleActivity = async (act) => {
    await base44.entities.Activity.update(act.id, { status: 'Realizada' });
    setData(prev => ({ ...prev, activities: prev.activities.map(a => a.id === act.id ? { ...a, status: 'Realizada' } : a) }));
  };

  const markPaid = async (p) => {
    await base44.entities.Payment.update(p.id, { status: 'Pagado', paid_date: new Date().toISOString().slice(0, 10) });
    setData(prev => ({ ...prev, payments: prev.payments.map(x => x.id === p.id ? { ...x, status: 'Pagado' } : x) }));
  };

  const pendingPayments = useMemo(() => filterByCommerce(data.payments)
    .filter(p => p.status === 'Pendiente' || p.status === 'Parcial')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5), [data.payments, filterByCommerce]);

  const maxFunnel = Math.max(...stats.funnel.map(f => f.count), 1);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1240px] mx-auto">
      <div
        className="relative overflow-hidden rounded-2xl p-4 sm:p-5 mb-4"
        style={{ background: 'linear-gradient(135deg, hsl(232 78% 59%) 0%, hsl(252 80% 55%) 100%)' }}
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-16 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Hola, {user?.full_name?.split(' ')[0] || '👋'}</h1>
            <p className="text-[13px] text-white/70 mt-0.5">{isAllCommerces ? 'Vista consolidada de todos tus comercios' : 'Del primer contacto al cobro — esto es lo que está pasando.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <DateWeatherWidget variant="glass" />
            <div className="relative">
              <button onClick={() => setPeriodOpen(!periodOpen)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/25 text-white text-sm font-medium hover:bg-white/25 transition-colors">
                {PERIODS.find(p => p.key === period)?.label}
                <ChevronDown className="w-4 h-4" />
              </button>
              {periodOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPeriodOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-20 py-1">
                    {PERIODS.map(p => (
                      <button key={p.key} onClick={() => { setPeriod(p.key); setPeriodOpen(false); }}
                        className={cn('w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors', p.key === period && 'text-primary font-medium')}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <DashboardPills view={view} setView={setView} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 items-start gap-3 mb-4">
        <StatCard label="Total productos" value={stats.totalProductsCount} icon={Package} onClick={() => navigate('/productos')} />
        <StatCard label="Ventas" value={stats.salesCount} variation={variation(stats.salesCount, stats.prevSalesCount)} icon={ShoppingCart} onClick={() => navigate('/ventas')} />
        <StatCard label="Cobros pendientes" value={amount(stats.pending)} icon={Wallet} onClick={() => navigate('/cobros')} />
        <StatCard label="Top products" value={stats.topProduct?.units ?? 0} icon={Award} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-3 mb-4">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <IncomeCard
            revenue={stats.revenue}
            variationPct={variation(stats.revenue, stats.prevRevenue)}
            baseCurrency={currency}
            hidden={hideAmounts}
            onToggleHidden={() => setHideAmounts(!hideAmounts)}
            sparkline={stats.revenueSparkline}
          />
          <SalesReportChart series={stats.salesReportSeries} total={stats.revenue} variationPct={variation(stats.revenue, stats.prevRevenue)} formatValue={amount} />
          <RecentSalesTable sales={stats.recentSales} formatValue={amount} onRowClick={() => navigate('/ventas')} />
        </div>
        <TopProductCard product={stats.topProduct} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <MonthlyGoalCard goal={stats.monthlyGoal} achieved={stats.revenue} formatValue={amount} />
        <div className="bg-card rounded-2xl border border-border card-shadow p-3.5 h-full flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Trophy className="w-3 h-3" />
            </span>
            <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Mejor vendedor</p>
          </div>
          {stats.topSeller ? (
            <>
              <p className="text-base font-bold tracking-tight truncate">{stats.topSeller.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{amount(stats.topSeller.revenue)} · {stats.topSeller.count} ventas</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin ventas en el período</p>
          )}
        </div>
        <KpiCard label="Leads" value={stats.leadsCount} variation={variation(stats.leadsCount, stats.prevLeadsCount)} icon={UserPlus} accent="#8b5cf6" onClick={() => navigate('/leads')} sparkline={stats.leadsSparkline} />
      </div>

      {view === 'commerce' && isAllCommerces && stats.commerceBreakdown.length > 0 && (
        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 mb-4">
          <h2 className="font-semibold mb-3 text-sm">Rendimiento por comercio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.commerceBreakdown.map(c => (
              <button key={c.id} onClick={() => setCurrentCommerceId(c.id)} className="text-left p-4 rounded-xl border border-border hover:border-primary transition-all">
                <div className="flex items-center gap-2 mb-2"><Store className="w-4 h-4 text-primary" /><p className="text-sm font-medium truncate">{c.name}</p></div>
                <ProgressBar value={c.revenue} max={Math.max(...stats.commerceBreakdown.map(x => x.revenue), 1)} formatValue={amount} sublabel={`${c.salesCount} ventas · ${c.clients} clientes`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'seller' && stats.sellerBreakdown.length > 0 && (
        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 mb-4">
          <h2 className="font-semibold mb-3 text-sm">Ventas por vendedor</h2>
          <div className="space-y-4">
            {stats.sellerBreakdown.map(s => (
              <ProgressBar key={s.name} label={s.name} value={s.revenue} max={stats.sellerBreakdown[0].revenue} formatValue={amount} sublabel={`${s.count} ventas`} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="font-semibold text-sm">Funnel comercial</h2>
            <button onClick={() => navigate('/pipeline')} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:gap-1.5 transition-all">Ver pipeline <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-1.5">
            {stats.funnel.map((f, i) => (
              <div key={f.stage} className="flex items-center gap-2.5">
                <span className="w-20 sm:w-24 text-xs text-muted-foreground shrink-0">{f.stage}</span>
                <div className="flex-1 h-6 bg-secondary/50 rounded-lg overflow-hidden relative">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(f.count / maxFunnel) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-lg flex items-center justify-end pr-2" style={{ background: `linear-gradient(90deg, hsl(var(--primary)/0.5), hsl(var(--primary)))` }}>
                    <span className="text-[11px] font-semibold text-white">{f.count}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-border grid grid-cols-2 gap-3">
            <div><p className="text-xs text-muted-foreground">En proceso (pipeline)</p><p className="text-lg font-bold">{amount(stats.inPipeline)}</p></div>
            <div><p className="text-xs text-muted-foreground">Cobrado en período</p><p className="text-lg font-bold text-success">{amount(stats.collected)}</p></div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
          <h2 className="font-semibold mb-2.5 text-sm">Cobros pendientes</h2>
          <div className="space-y-1">
            {pendingPayments.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Sin cobros pendientes</p>}
            {pendingPayments.map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-accent/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.client_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">{amount(p.amount)}</span>
                    {isOverdue(p.due_date) ? (
                      <Badge variant="destructive" dot>Vencido</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">· Vence {new Date(p.due_date).toLocaleDateString('es-AR')}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => markPaid(p)} className="shrink-0 px-2 py-1 rounded-lg bg-success text-white text-xs font-medium hover:opacity-90">Cobrado</button>
              </div>
            ))}
          </div>

          <h2 className="font-semibold mt-4 mb-2 text-sm">Próximas reuniones</h2>
          <div className="space-y-1">
            {stats.upcomingMeetings.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">Sin reuniones programadas</p>}
            {stats.upcomingMeetings.map(m => (
              <div key={m.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-accent/50 transition-colors">
                <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm">📅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.client_name} · {formatDateTime(m.date)}</p>
                </div>
                <Badge variant="primary">{m.type}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
          <h2 className="font-semibold mb-2.5 text-sm">Tareas pendientes</h2>
          <div className="space-y-0.5">
            {stats.pendingActivities.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Sin tareas pendientes</p>}
            {stats.pendingActivities.map(a => (
              <div key={a.id} className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-accent/50 transition-colors text-left group">
                <button onClick={() => toggleActivity(a)}>
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </button>
                <span className="text-sm flex-1">{a.title}</span>
                {a.due_date && daysUntil(a.due_date) !== null && daysUntil(a.due_date) < 0 && <Badge variant="destructive">Vencida</Badge>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="font-semibold text-sm">Clientes de mayor valor</h2>
            <button onClick={() => navigate('/clientes')} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:gap-1.5 transition-all">Ver todos <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-1">
            {stats.topClients.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Sin clientes aún</p>}
            {stats.topClients.map((c, i) => (
              <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-accent/50 transition-colors text-left">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-muted-foreground truncate">{c.company || c.segment || 'Cliente'}</p></div>
                <span className="text-sm font-semibold">{amount(c.total_sold)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <SalesByEntityChart sales={stats.fSales} currency={currency} />
    </div>
  );
}
