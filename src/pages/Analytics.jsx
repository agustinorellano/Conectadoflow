import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Target, DollarSign, Wallet, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { formatCurrency, inPeriod, LEAD_SOURCES, stageColor } from '@/lib/flowUtils';
import DateRangePicker from '@/components/DateRangePicker';

const COLORS = ['#465BE8','#22c55e','#f59e0b','#8b5cf6','#0ea5e9','#f97316','#ec4899','#14b8a6','#64748b','#a855f7'];

export default function Analytics() {
  const { config } = useData();
  const [data, setData] = useState({ sales: [], leads: [], clients: [], payments: [], opportunities: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');
  const currency = config?.currency || 'ARS';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sales, leads, clients, payments, opportunities] = await Promise.all([
          base44.entities.Sale.list().catch(() => []),
          base44.entities.Lead.list().catch(() => []),
          base44.entities.Client.list().catch(() => []),
          base44.entities.Payment.list().catch(() => []),
          base44.entities.Opportunity.list().catch(() => []),
        ]);
        setData({ sales, leads, clients, payments, opportunities });
      } finally { setLoading(false); }
    })();
  }, []);

  const stats = useMemo(() => {
    const periodSales = data.sales.filter(s => s.status !== 'Cancelada' && inPeriod(s.date, period));
    const revenue = periodSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
    const avgTicket = periodSales.length ? revenue / periodSales.length : 0;
    const collected = data.payments.filter(p => p.status === 'Pagado' && inPeriod(p.paid_date || p.due_date, period)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pending = data.payments.filter(p => p.status === 'Pendiente' || p.status === 'Parcial').reduce((s, p) => s + (Number(p.amount) || 0), 0);

    // sales by month
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('es-AR', { month: 'short' });
      const monthSales = data.sales.filter(s => {
        const sd = new Date(s.date); return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear() && s.status !== 'Cancelada';
      });
      months.push({ name: label, ventas: monthSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0), cobrado: data.payments.filter(p => { const pd = new Date(p.paid_date || p.due_date); return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear() && p.status === 'Pagado'; }).reduce((s, p) => s + (Number(p.amount) || 0), 0) });
    }

    // by source
    const bySource = LEAD_SOURCES.map(src => {
      const leadCount = data.leads.filter(l => l.source === src).length;
      const salesRev = data.sales.filter(s => s.status !== 'Cancelada').reduce((sum, s) => {
        const client = data.clients.find(c => c.id === s.client_id);
        return client?.lead_source === src ? sum + (Number(s.total_amount) || 0) : sum;
      }, 0);
      return { name: src, leads: leadCount, ingresos: salesRev };
    }).filter(x => x.leads > 0 || x.ingresos > 0);

    // pipeline stages
    const stages = ['Nuevo lead','Contactado','Calificado','Reunión','Propuesta','Negociación','Ganado'];
    const pipelineData = stages.map(st => ({
      name: st, value: data.opportunities.filter(o => o.stage === st || (st === 'Ganado' && o.is_won)).length, color: stageColor(st),
    })).filter(x => x.value > 0);

    // weighted value
    const weighted = data.opportunities.filter(o => !o.is_won && !o.is_lost).reduce((s, o) => s + (Number(o.amount) || 0) * (o.probability / 100), 0);
    const potential = data.opportunities.filter(o => !o.is_won && !o.is_lost).reduce((s, o) => s + (Number(o.amount) || 0), 0);

    return { revenue, avgTicket, collected, pending, months, bySource, pipelineData, weighted, potential, salesCount: periodSales.length, leadsCount: data.leads.filter(l => inPeriod(l.created_date, period)).length, clientsCount: data.clients.filter(c => inPeriod(c.created_date, period)).length };
  }, [data, period]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análisis completo del negocio</p>
        </div>
        <DateRangePicker value={period} onChange={setPeriod} presets={[
          { key: 'month', label: 'Este mes' },
          { key: '3m', label: '3 meses' },
          { key: 'year', label: 'Este año' },
        ]} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard icon={DollarSign} label="Facturación" value={formatCurrency(stats.revenue, currency)} color="#465BE8" />
        <StatCard icon={TrendingUp} label="Ticket promedio" value={formatCurrency(stats.avgTicket, currency)} color="#22c55e" />
        <StatCard icon={Wallet} label="Cobrado" value={formatCurrency(stats.collected, currency)} color="#0ea5e9" />
        <StatCard icon={Target} label="Valor ponderado" value={formatCurrency(stats.weighted, currency)} color="#f59e0b" sublabel={`de ${formatCurrency(stats.potential, currency)} potencial`} />
      </div>

      {/* Sales evolution */}
      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6">
        <h2 className="font-semibold mb-4">Evolución de ventas y cobros</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={stats.months} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
            <Tooltip formatter={v => formatCurrency(v, currency)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
            <Line type="monotone" dataKey="ventas" stroke="#465BE8" strokeWidth={2.5} dot={{ r: 3 }} name="Vendido" />
            <Line type="monotone" dataKey="cobrado" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} name="Cobrado" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* By source */}
        <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
          <h2 className="font-semibold mb-4">Análisis por fuente</h2>
          {stats.bySource.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.bySource} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={v => formatCurrency(v, currency)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Bar dataKey="ingresos" fill="#465BE8" radius={[0, 6, 6, 0]} name="Ingresos" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pipeline distribution */}
        <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
          <h2 className="font-semibold mb-4">Distribución del pipeline</h2>
          {stats.pipelineData.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Sin oportunidades</p> : (
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={stats.pipelineData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {stats.pipelineData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {stats.pipelineData.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top clients table */}
      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
        <h2 className="font-semibold mb-4">Facturación por cliente</h2>
        <div className="space-y-1">
          {[...data.clients].sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0)).slice(0, 8).map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
              <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
              <span className="text-sm font-semibold">{formatCurrency(c.total_sold || 0, currency)}</span>
            </div>
          ))}
          {data.clients.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Sin clientes</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, sublabel }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 card-shadow">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '1a', color }}>
          <Icon className="w-4 h-4" />
        </span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}
