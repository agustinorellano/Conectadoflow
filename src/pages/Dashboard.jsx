import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShoppingCart, UserPlus, Wallet, Package, Award,
  ArrowRight, CheckCircle2, Circle, Store, Eye, EyeOff, Trophy, Calendar, BellRing, MapPin, Receipt, Share2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import { useCommerce } from '@/lib/CommerceContext';
import { useCurrencyRates } from '@/lib/useCurrencyRates';
import { convertAmount } from '@/lib/currencyRates';
import StatCard from '@/components/StatCard';
import Badge from '@/components/Badge';
import SalesByEntityChart from '@/components/SalesByEntityChart';
import DashboardPills from '@/components/DashboardPills';
import MonthlyGoalCard from '@/components/MonthlyGoalCard';
import IncomeReportCard from '@/components/IncomeReportCard';
import RecentSalesTable from '@/components/RecentSalesTable';
import DateWeatherWidget from '@/components/DateWeatherWidget';
import ProgressBar from '@/components/ProgressBar';
import {
  formatCurrency, formatDateTime, inPeriod, previousPeriodAmount,
  variation, daysUntil, isOverdue, isStaleClient, STALE_CONTACT_DAYS,
} from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { config } = useData();
  const { user } = useAuth();
  const { filterByCommerce, currentCommerceId, setCurrentCommerceId, commerces } = useCommerce();
  const [view, setView] = useState('general');
  const [hideAmounts, setHideAmounts] = useState(false);
  // Shared by every widget on the page (Ingresos, Ventas, Leads, Mejor
  // vendedor, Funnel) — the pills live inside IncomeReportCard, but
  // changing them now moves the whole dashboard's window, not just that
  // one chart.
  const [period, setPeriod] = useState('month');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // One cached query per entity instead of a single Promise.all fired on
  // every mount: switching away from Dashboard and back reuses this data
  // (per the shared staleTime in query-client.js) instead of re-fetching
  // all 8 tables again.
  const ENTITY_KEYS = ['Sale', 'Lead', 'Client', 'Payment', 'Opportunity', 'Meeting', 'Activity', 'Product', 'Branch', 'BranchManager'];
  const results = useQueries({
    queries: ENTITY_KEYS.map((name) => ({
      queryKey: [name, 'list', { filter: undefined, sort: undefined, limit: undefined }],
      queryFn: () => base44.entities[name].list().catch(() => []),
    })),
  });
  const loading = results.some(r => r.isLoading);
  const resultData = results.map(r => r.data || []);
  const data = useMemo(() => {
    const [sales, leads, clients, payments, opportunities, meetings, activities, products, branches, branchManagers] = resultData;
    return { sales, leads, clients, payments, opportunities, meetings, activities, products, branches, branchManagers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resultData);

  const patchEntity = (name, id, patch) => {
    const key = [name, 'list', { filter: undefined, sort: undefined, limit: undefined }];
    queryClient.setQueryData(key, (prev) => (prev || []).map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const currency = config?.currency || 'ARS';
  const isAllCommerces = currentCommerceId === 'all' && commerces.length > 1;
  // "Mejor vendedor" only makes sense when there's a team to rank — in
  // modo independiente there's only one seller, so comparing them to
  // themselves is noise, not signal. Managers see it to track their team;
  // a vendedor doesn't need (or shouldn't see) a ranking of their peers.
  const showTopSeller = config?.mode === 'Equipo' && (user?.role === 'admin' || user?.role === 'manager');
  const amount = (v) => hideAmounts ? '••••••' : formatCurrency(v, currency);
  const rates = useCurrencyRates();

  const stats = useMemo(() => {
    const toBase = (v, cur) => convertAmount(v, cur || 'ARS', currency, rates);
    // Sales/payments can each carry their own currency (a USD-priced
    // product sold while the org's base is ARS, for example) — convert
    // every amount to the org's base currency up front so every stat
    // below can keep summing plain numbers without re-deriving this.
    // `currency` is reset to the base here too — otherwise a consumer that
    // converts again downstream (IncomeReportCard does its own conversion
    // so it can be used outside Dashboard too) would see the stale
    // original currency next to an amount that's already been converted,
    // and apply the exchange rate a second time.
    const fSales = filterByCommerce(data.sales).map(s => ({
      ...s,
      total_amount: toBase(s.total_amount, s.currency),
      collected_amount: toBase(s.collected_amount, s.currency),
      balance: toBase(s.balance, s.currency),
      currency,
    }));
    const fLeads = filterByCommerce(data.leads);
    const fClients = filterByCommerce(data.clients);
    const fPayments = filterByCommerce(data.payments).map(p => ({ ...p, amount: toBase(p.amount, p.currency), currency }));
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
    const funnel = funnelStages.map(stage => {
      const stageOpps = fOpps.filter(o => o.stage === stage || (stage === 'Ganado' && o.is_won));
      return {
        stage,
        count: stageOpps.length,
        // La más vieja sin tocar es la más urgente de recomendar — no la
        // que se acaba de crear.
        oldest: [...stageOpps].sort((a, b) => new Date(a.updated_date || a.created_date) - new Date(b.updated_date || b.created_date))[0] || null,
      };
    });

    // Una sola recomendación accionable, no una por etapa (eso sería ruido):
    // la primera etapa con algo pendiente, en el orden en que avanza el
    // pipeline — es la más temprana/urgente de resolver.
    const funnelRecommendation = (() => {
      const actionByStage = {
        'Nuevo lead': 'Solicitar reunión a',
        'Contactado': 'Solicitar reunión a',
        'Calificado': 'Solicitar reunión a',
        'Reunión': 'Quedaría pendiente enviar propuesta a',
        'Propuesta': 'Quedaría pendiente hacer seguimiento con',
        'Negociación': 'Quedaría pendiente cerrar con',
      };
      for (const stage of funnelStages) {
        if (stage === 'Ganado') continue;
        const entry = funnel.find(f => f.stage === stage);
        if (entry?.count > 0 && entry.oldest) {
          return { stage, action: actionByStage[stage], opportunity: entry.oldest };
        }
      }
      return null;
    })();

    const now = new Date();
    const upcomingMeetings = fMeetings.filter(m => m.status === 'Programada' && new Date(m.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
    const pendingActivities = fActivities.filter(a => a.status === 'Pendiente').sort((a, b) => new Date(a.due_date || a.date) - new Date(b.due_date || b.date)).slice(0, 5);
    const topClients = [...fClients].map(c => ({ ...c, score: Number(c.total_sold) || 0 })).sort((a, b) => b.score - a.score).slice(0, 5);

    // "Clientes importantes" = ones who've actually bought before (not a
    // brand-new lead-turned-client with nothing to follow up on yet).
    const staleClients = fClients.filter(c => isStaleClient(c) && Number(c.total_sold) > 0)
      .sort((a, b) => (Number(b.total_sold) || 0) - (Number(a.total_sold) || 0));

    // Breakdown needs every commerce's sales/payments, not just the
    // currently-selected one (that's what fSales/fPayments are filtered
    // to) — same currency conversion, kept unfiltered by commerce.
    const allSalesBase = data.sales.map(s => ({ ...s, total_amount: toBase(s.total_amount, s.currency), currency }));
    const allPaymentsBase = data.payments.map(p => ({ ...p, amount: toBase(p.amount, p.currency), currency }));
    // Admin ve el total de cada comercio (todas sus sucursales, todos sus
    // vendedores). Un gerente con sucursales asignadas en vez de eso solo
    // ve, agrupado por comercio, lo que pasó en SUS sucursales — un
    // comercio con 3 sucursales y un gerente a cargo de una sola no debe
    // mostrarle la facturación de las otras dos.
    const isAdminRole = user?.role === 'admin';
    const isManagerRole = user?.role === 'manager';
    const visibleBranches = isAdminRole ? data.branches
      : isManagerRole ? data.branches.filter(b => data.branchManagers.some(bm => bm.branch_id === b.id && bm.manager_id === user.id))
      : [];
    const visibleBranchIds = new Set(visibleBranches.map(b => b.id));

    const commerceBreakdown = isManagerRole
      ? commerces.filter(c => visibleBranches.some(b => b.commerce_id === c.id)).map(c => {
          const cBranchIds = new Set(visibleBranches.filter(b => b.commerce_id === c.id).map(b => b.id));
          const cSales = allSalesBase.filter(s => s.status !== 'Cancelada' && cBranchIds.has(s.branch_id));
          const cRevenue = cSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
          return { id: c.id, name: c.name, revenue: cRevenue, salesCount: cSales.length, clients: null, leads: null, pending: 0 };
        })
      : commerces.map(c => {
          const cSales = allSalesBase.filter(s => s.status !== 'Cancelada' && (s.commerce_id === c.id || (!s.commerce_id && c.id === commerces[0]?.id)));
          const cRevenue = cSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
          const cClients = data.clients.filter(cl => cl.commerce_id === c.id || (!cl.commerce_id && c.id === commerces[0]?.id)).length;
          const cLeads = data.leads.filter(l => l.commerce_id === c.id || (!l.commerce_id && c.id === commerces[0]?.id)).length;
          const cPending = allPaymentsBase.filter(p => (p.status === 'Pendiente' || p.status === 'Parcial') && (p.commerce_id === c.id || (!p.commerce_id && c.id === commerces[0]?.id))).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          return { id: c.id, name: c.name, revenue: cRevenue, salesCount: cSales.length, clients: cClients, leads: cLeads, pending: cPending };
        }).filter(c => c.salesCount > 0 || c.clients > 0);

    const branchBreakdown = visibleBranches.map(b => {
      const bSales = allSalesBase.filter(s => s.status !== 'Cancelada' && visibleBranchIds.has(s.branch_id) && s.branch_id === b.id);
      const bRevenue = bSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
      return { id: b.id, name: b.name, commerceName: commerces.find(c => c.id === b.commerce_id)?.name || '', revenue: bRevenue, salesCount: bSales.length };
    });

    const sellerMap = {};
    periodSales.forEach(s => {
      const key = s.owner_name || 'Sin asignar';
      if (!sellerMap[key]) sellerMap[key] = { name: key, revenue: 0, count: 0 };
      sellerMap[key].revenue += Number(s.total_amount) || 0;
      sellerMap[key].count++;
    });
    const sellerBreakdown = Object.values(sellerMap).sort((a, b) => b.revenue - a.revenue);
    const topSeller = sellerBreakdown[0] || null;

    // Meta mensual always tracks the calendar month, independent of the
    // shared period selector above — a monthly target compared against a
    // "last 7 days" revenue would always look broken regardless of label.
    const monthRevenue = fSales.filter(s => s.status !== 'Cancelada' && inPeriod(s.date, 'month')).reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
    const monthlyGoal = config?.monthly_goal ? Number(config.monthly_goal) : Math.max(monthRevenue, 1) * 1.2;
    const monthlyGoalIsEstimated = !config?.monthly_goal;

    const productUnits = {};
    periodSales.forEach(s => {
      (s.items || []).forEach(it => {
        const name = it.description || 'Sin nombre';
        productUnits[name] = (productUnits[name] || 0) + (Number(it.quantity) || 0);
      });
    });
    const topProductEntry = Object.entries(productUnits).sort((a, b) => b[1] - a[1])[0];
    const topProduct = topProductEntry ? { name: topProductEntry[0], units: topProductEntry[1] } : null;

    // Mismo cálculo que ya existía en Ventas ("Ventas por canal") —
    // fSales ya viene convertido a la moneda base, no hace falta reconvertir.
    const channelMap = {};
    periodSales.forEach(s => {
      const key = s.channel || 'Sin especificar';
      if (!channelMap[key]) channelMap[key] = { name: key, count: 0, revenue: 0 };
      channelMap[key].count += 1;
      channelMap[key].revenue += Number(s.total_amount) || 0;
    });
    const channelSales = Object.values(channelMap).sort((a, b) => b.revenue - a.revenue);

    const recentSales = [...periodSales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
    const totalProductsCount = fProducts.filter(p => p.is_active !== false).length;

    return {
      revenue, prevRevenue, salesCount, prevSalesCount, leadsCount, prevLeadsCount, avgTicket,
      collected, pending, overdue, inPipeline, funnel, upcomingMeetings, pendingActivities, topClients,
      commerceBreakdown, branchBreakdown, visibleBranches, sellerBreakdown, topSeller, monthlyGoal, monthlyGoalIsEstimated, monthRevenue, fSales,
      topProduct, recentSales, totalProductsCount, staleClients, funnelRecommendation, channelSales,
    };
  }, [data, period, filterByCommerce, commerces, config, rates, currency, user]);

  const toggleActivity = async (act) => {
    await base44.entities.Activity.update(act.id, { status: 'Realizada' });
    patchEntity('Activity', act.id, { status: 'Realizada' });
  };

  const maxFunnel = Math.max(...stats.funnel.map(f => f.count), 1);
  // Un vendedor no ve facturación de la empresa (ni el gráfico de Ingresos
  // ni la fila donde vivía) — en cambio, apenas entra ve primero "qué tengo
  // que hacer hoy" (tareas + reuniones), arriba de todo lo demás.
  const isVendedor = user?.role === 'user';
  // "Por comercio"/"Por sucursal" exponen facturación — mismo criterio que
  // ya aplica a Ingresos: solo admin/gerente, nunca vendedor (arriba) ni
  // viewer. Cada pill además solo aparece si hay algo que mostrar en ella.
  const dashboardViews = [
    { key: 'general', label: 'General' },
    ...(commerces.length > 1 ? [{ key: 'commerce', label: 'Por comercio' }] : []),
    ...(stats.visibleBranches?.length > 0 ? [{ key: 'branch', label: 'Por sucursal' }] : []),
    { key: 'seller', label: 'Por vendedor' },
  ];

  const tasksCard = (
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
  );

  const meetingsCard = (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
      <h2 className="font-semibold mb-2.5 text-sm">Próximas reuniones</h2>
      <div className="space-y-1">
        {stats.upcomingMeetings.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">Sin reuniones programadas</p>}
        {stats.upcomingMeetings.map(m => (
          <div key={m.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-accent/50 transition-colors">
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.client_name} · {formatDateTime(m.date)}</p>
            </div>
            <Badge variant="primary">{m.type}</Badge>
          </div>
        ))}
      </div>
    </div>
  );

  // Ventas y Leads son los dos números de "qué entró en el período" —
  // van juntos. Productos (un conteo de catálogo, no ligado al período)
  // se corrió a la fila de Meta mensual/Mejor vendedor, donde antes
  // estaba Leads.
  // auto-fit/minmax en vez de un grid-cols fijo: este bloque vive en dos
  // columnas de ancho muy distinto (la angosta de al lado del gráfico de
  // Ingresos, la ancha para Vendedor) y además el sidebar abierto le come
  // espacio real que ningún breakpoint de viewport detecta — así cada
  // card se queda en su propia fila en cuanto deja de entrar un segundo
  // "mínimo" de 150px, en vez de recortar el texto para forzar 2 columnas.
  const statsGrid = (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
      <StatCard label="Ventas" value={stats.salesCount} variation={variation(stats.salesCount, stats.prevSalesCount)} icon={ShoppingCart} accent="#22c55e" onClick={() => navigate('/ventas')} />
      <StatCard label="Leads" value={stats.leadsCount} variation={variation(stats.leadsCount, stats.prevLeadsCount)} icon={UserPlus} accent="#8b5cf6" onClick={() => navigate('/leads')} />
      <StatCard label="Por cobrar" value={amount(stats.pending)} icon={Wallet} accent="#f59e0b" onClick={() => navigate('/cobros')} />
      <StatCard label="Ticket promedio" value={amount(stats.avgTicket)} icon={Receipt} accent="#0ea5e9" />
      <StatCard label="Más vendido" value={stats.topProduct?.name ?? '—'} sublabel={stats.topProduct ? `${stats.topProduct.units} unidad${stats.topProduct.units === 1 ? '' : 'es'}` : null} icon={Award} accent="#ec4899" />
      <StatCard label="Productos" value={stats.totalProductsCount} icon={Package} accent="#465BE8" onClick={() => navigate('/productos')} />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1240px] mx-auto">
      <div className="bg-card rounded-2xl border border-border card-shadow border-l-4 border-l-primary p-4 sm:p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hola, {user?.full_name?.split(' ')[0] || '👋'}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{isAllCommerces ? 'Vista consolidada de todos tus comercios' : 'Del primer contacto al cobro — esto es lo que está pasando.'}</p>
          </div>
          <DateWeatherWidget />
        </div>
      </div>

      {stats.staleClients.length > 0 && (
        <button onClick={() => navigate('/clientes')}
          className="w-full flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-2xl p-3.5 sm:p-4 mb-4 text-left hover:bg-warning/15 transition-colors">
          <span className="w-9 h-9 rounded-xl bg-warning/20 text-warning flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </span>
          <p className="text-sm flex-1 min-w-0">
            <span className="font-semibold">{stats.staleClients.length} cliente{stats.staleClients.length === 1 ? '' : 's'} importante{stats.staleClients.length === 1 ? '' : 's'}</span>{' '}
            llevan más de {STALE_CONTACT_DAYS} días sin seguimiento
            {stats.staleClients[0]?.name && (
              <span className="text-muted-foreground"> — {stats.staleClients.slice(0, 3).map(c => c.name).join(', ')}{stats.staleClients.length > 3 ? '…' : ''}</span>
            )}
          </p>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      )}

      {!isVendedor && dashboardViews.length > 1 && (
        <div className="mb-4">
          <DashboardPills view={view} setView={setView} views={dashboardViews} />
        </div>
      )}

      {isVendedor ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {tasksCard}
            {meetingsCard}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-3 mb-4">
            <div className="lg:col-span-2 flex flex-col gap-3">
              {statsGrid}
              <RecentSalesTable sales={stats.recentSales} formatValue={amount} onRowClick={() => navigate('/ventas')} />
            </div>
            <SalesByEntityChart sales={stats.fSales} currency={currency} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-3 mb-4">
            <div className="lg:col-span-2 flex flex-col gap-3">
              <IncomeReportCard
                sales={stats.fSales}
                baseCurrency={currency}
                hidden={hideAmounts}
                onToggleHidden={() => setHideAmounts(!hideAmounts)}
                period={period}
                onPeriodChange={setPeriod}
              />
              <RecentSalesTable sales={stats.recentSales} formatValue={amount} onRowClick={() => navigate('/ventas')} />
            </div>
            <div className="flex flex-col gap-3">
              {statsGrid}
              <div className="flex-1">
                <SalesByEntityChart sales={stats.fSales} currency={currency} />
              </div>
            </div>
          </div>
        </>
      )}

      <div className={cn('grid grid-cols-1 gap-3 mb-4', showTopSeller && 'sm:grid-cols-2')}>
        <MonthlyGoalCard goal={stats.monthlyGoal} achieved={stats.monthRevenue} formatValue={amount} />
        {showTopSeller && (
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
        )}
      </div>

      {view === 'commerce' && (
        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 mb-4">
          <h2 className="font-semibold mb-3 text-sm">Rendimiento por comercio</h2>
          {isAllCommerces && stats.commerceBreakdown.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.commerceBreakdown.map(c => (
                <button key={c.id} onClick={() => setCurrentCommerceId(c.id)} className="text-left p-4 rounded-xl border border-border hover:border-primary transition-all">
                  <div className="flex items-center gap-2 mb-2"><Store className="w-4 h-4 text-primary" /><p className="text-sm font-medium truncate">{c.name}</p></div>
                  <ProgressBar value={c.revenue} max={Math.max(...stats.commerceBreakdown.map(x => x.revenue), 1)} formatValue={amount} sublabel={c.clients != null ? `${c.salesCount} ventas · ${c.clients} clientes` : `${c.salesCount} ventas`} />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Seleccioná <button onClick={() => setCurrentCommerceId('all')} className="text-primary font-medium hover:underline">"Todos los comercios"</button> en el selector de arriba para ver el desglose por comercio.
            </p>
          )}
        </div>
      )}

      {view === 'branch' && (
        <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 mb-4">
          <h2 className="font-semibold mb-3 text-sm">Rendimiento por sucursal</h2>
          {stats.visibleBranches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.branchBreakdown.map(b => (
                <button key={b.id} onClick={() => navigate(`/ventas?branch=${b.id}`)} className="text-left p-4 rounded-xl border border-border hover:border-primary transition-all">
                  <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-primary" /><p className="text-sm font-medium truncate">{b.name}</p></div>
                  <ProgressBar value={b.revenue} max={Math.max(...stats.branchBreakdown.map(x => x.revenue), 1)} formatValue={amount} sublabel={`${b.salesCount} ventas${b.commerceName ? ` · ${b.commerceName}` : ''}`} />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">Todavía no tenés sucursales asignadas.</p>
          )}
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

      <div className={cn('grid grid-cols-1 gap-3 mb-4', !isVendedor && 'lg:grid-cols-2')}>
      {!isVendedor && meetingsCard}
      <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
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
        {stats.funnelRecommendation && (
          <button onClick={() => navigate('/pipeline')}
            className="mt-3.5 w-full flex items-start gap-2.5 p-3 rounded-xl bg-primary-soft/60 hover:bg-primary-soft transition-colors text-left">
            <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Award className="w-3.5 h-3.5" />
            </span>
            <p className="text-sm min-w-0">
              <span className="font-semibold">{stats.funnelRecommendation.action}</span>{' '}
              {stats.funnelRecommendation.opportunity.client_name || 'este cliente'}
              <span className="text-muted-foreground"> — está en "{stats.funnelRecommendation.stage}" hace tiempo.</span>
            </p>
          </button>
        )}
      </div>
      </div>

      <div className={cn('grid grid-cols-1 gap-3 sm:gap-4 mb-4', !isVendedor ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
        {!isVendedor && tasksCard}

        {stats.channelSales.length > 0 && (
          <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3.5">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Share2 className="w-4 h-4" />
              </span>
              <h2 className="font-semibold text-sm">Ventas por canal</h2>
            </div>
            <div className="space-y-3.5">
              {stats.channelSales.map(c => (
                <ProgressBar key={c.name} label={c.name} value={c.revenue} max={stats.channelSales[0].revenue}
                  formatValue={amount} sublabel={`${c.count} venta${c.count === 1 ? '' : 's'}`} />
              ))}
            </div>
          </div>
        )}

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
    </div>
  );
}
