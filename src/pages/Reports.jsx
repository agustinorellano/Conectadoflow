import React, { useState, useEffect, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { DollarSign, Wallet, ShoppingCart, FileDown, Clock, Store } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useCommerce } from '@/lib/CommerceContext';
import { formatCurrency, formatDate } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

const ENTITY_KEYS = ['Sale', 'Payment', 'Opportunity', 'Client'];

export default function Reports() {
  const { config } = useData();
  const { commerces, filterByCommerce } = useCommerce();
  const [periodType, setPeriodType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [biweekStart, setBiweekStart] = useState('1');
  const [selectedCommerces, setSelectedCommerces] = useState({});
  const currency = config?.currency || 'ARS';

  // Cached per-entity (same keys Dashboard/Analytics use) instead of a
  // Promise.all fired on every mount.
  const results = useQueries({
    queries: ENTITY_KEYS.map((name) => ({
      queryKey: [name, 'list', { filter: undefined, sort: undefined, limit: undefined }],
      queryFn: () => base44.entities[name].list().catch(() => []),
    })),
  });
  const loading = results.some(r => r.isLoading);
  const resultData = results.map(r => r.data || []);
  const data = useMemo(() => {
    const [sales, payments, opportunities, clients] = resultData;
    return { sales, payments, opportunities, clients };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resultData);

  useEffect(() => {
    if (commerces.length > 0) {
      const sel = {};
      commerces.forEach(c => { sel[c.id] = true; });
      setSelectedCommerces(sel);
    }
  }, [commerces]);

  const periodRange = useMemo(() => {
    if (periodType === 'monthly') {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      return { start, end, label: start.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) };
    } else {
      const startDay = Number(biweekStart);
      const start = new Date(selectedYear, selectedMonth, startDay);
      const end = new Date(selectedYear, selectedMonth, startDay + 14, 23, 59, 59, 999);
      return { start, end, label: `${start.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} - ${new Date(selectedYear, selectedMonth, startDay + 14).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}` };
    }
  }, [periodType, selectedMonth, selectedYear, biweekStart]);

  const commerceFilteredSales = useMemo(() => {
    const selectedIds = commerces.filter(c => selectedCommerces[c.id]).map(c => c.id);
    if (selectedIds.length === commerces.length) return filterByCommerce(data.sales);
    return data.sales.filter(s => !s.commerce_id || selectedIds.includes(s.commerce_id));
  }, [data.sales, commerces, selectedCommerces, filterByCommerce]);

  const stats = useMemo(() => {
    const inRange = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= periodRange.start && d <= periodRange.end;
    };

    const periodSales = commerceFilteredSales.filter(s => s.status !== 'Cancelada' && inRange(s.date));
    const revenue = periodSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
    const collected = data.payments.filter(p => p.status === 'Pagado' && inRange(p.paid_date || p.due_date)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pending = data.payments.filter(p => (p.status === 'Pendiente' || p.status === 'Parcial' || p.status === 'Vencido') && inRange(p.due_date)).reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const byClient = {};
    periodSales.forEach(s => {
      const name = s.client_name || 'Sin cliente';
      if (!byClient[name]) byClient[name] = { name, count: 0, total: 0 };
      byClient[name].count++;
      byClient[name].total += Number(s.total_amount) || 0;
    });
    const topClients = Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 10);

    const upcoming = data.payments.filter(p => p.status !== 'Pagado' && p.status !== 'Cancelado').sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 15);
    const weightedPipeline = data.opportunities.filter(o => !o.is_won && !o.is_lost).reduce((s, o) => s + (Number(o.amount) || 0) * (o.probability / 100), 0);

    return {
      revenue, collected, pending,
      salesCount: periodSales.length,
      avgTicket: periodSales.length ? revenue / periodSales.length : 0,
      topClients, upcoming, weightedPipeline,
      collectionRate: revenue > 0 ? (collected / revenue) * 100 : 0,
      periodSales,
    };
  }, [commerceFilteredSales, data, periodRange]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = config?.company_name || 'Conectado Flow';
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 20, y); y += 8;
    doc.setFontSize(11); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
    doc.text(`Reporte de Ventas — ${periodRange.label}`, 20, y); y += 6;
    doc.text(`Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 20, y); y += 10;

    doc.setTextColor(0); doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text('Resumen', 20, y); y += 7;
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    [`Ingresos del período: ${formatCurrency(stats.revenue, currency)}`, `Ventas cerradas: ${stats.salesCount}`, `Ticket promedio: ${formatCurrency(stats.avgTicket, currency)}`, `Total cobrado: ${formatCurrency(stats.collected, currency)}`, `Pendiente de cobro: ${formatCurrency(stats.pending, currency)}`, `Tasa de cobro: ${stats.collectionRate.toFixed(1)}%`, `Pipeline ponderado: ${formatCurrency(stats.weightedPipeline, currency)}`].forEach(k => { doc.text(k, 20, y); y += 6; });
    y += 4;

    if (stats.topClients.length > 0) {
      doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text('Ventas por cliente', 20, y); y += 7;
      doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.text('Cliente', 20, y); doc.text('Ventas', 120, y); doc.text('Total', 160, y); y += 5;
      doc.setFont(undefined, 'normal');
      stats.topClients.forEach(c => { if (y > 270) { doc.addPage(); y = 20; } doc.text(c.name.substring(0, 40), 20, y); doc.text(String(c.count), 120, y); doc.text(formatCurrency(c.total, currency), 160, y); y += 5; });
      y += 4;
    }

    if (stats.upcoming.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text('Proyección de cobros', 20, y); y += 7;
      doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.text('Cliente', 20, y); doc.text('Vencimiento', 90, y); doc.text('Monto', 160, y); y += 5;
      doc.setFont(undefined, 'normal');
      stats.upcoming.forEach(p => { if (y > 270) { doc.addPage(); y = 20; } doc.text((p.client_name || '').substring(0, 30), 20, y); doc.text(formatDate(p.due_date), 90, y); doc.text(formatCurrency(p.amount, currency), 160, y); y += 5; });
    }

    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Conectado Flow · Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' }); }
    doc.save(`reporte_${periodRange.label.replace(/\s+/g, '_')}.pdf`);
  };

  const exportExcel = () => {
    const rows = stats.periodSales.map(s => {
      const salePayments = data.payments.filter(p => p.sale_id === s.id);
      const firstDue = salePayments[0]?.due_date;
      const commerce = commerces.find(c => c.id === s.commerce_id);
      return {
        'Fecha': formatDate(s.date),
        'Comercio': commerce?.name || s.commerce_name || '',
        'Cliente': s.client_name || '',
        'Vendedor': s.owner_name || '',
        'Producto/Servicio': (s.items || []).map(i => i.description).join(', ') || '',
        'Monto total': s.total_amount || 0,
        'Monto cobrado': s.collected_amount || 0,
        'Monto pendiente': s.balance || 0,
        'Medio de pago': s.payment_method || '',
        'Entidad financiera': s.bank_entity || '',
        'Tarjeta': s.card_type || '',
        'Marca tarjeta': s.card_brand || '',
        'Cantidad de cuotas': s.installments_count || 1,
        'Estado de venta': s.status || '',
        'Estado del pago': s.payment_status || '',
        'Fecha de vencimiento': firstDue ? formatDate(firstDue) : '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `reporte_${periodRange.label.replace(/\s+/g, '_')}.xlsx`);
  };

  const toggleCommerce = (id) => setSelectedCommerces(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;

  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const currentYear = new Date().getFullYear();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Reporte financiero — {periodRange.label}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success text-white text-sm font-medium hover:opacity-90">
            <FileDown className="w-4 h-4" /> Exportar Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <FileDown className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          <button onClick={() => setPeriodType('monthly')} className={cn('px-4 py-2 rounded-xl text-sm font-medium', periodType === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border')}>Mensual</button>
          <button onClick={() => setPeriodType('biweekly')} className={cn('px-4 py-2 rounded-xl text-sm font-medium', periodType === 'biweekly' ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border')}>Quincenal</button>
        </div>
        <StyledSelect value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="px-3 py-2 rounded-xl border border-input bg-background text-sm font-medium">
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </StyledSelect>
        <StyledSelect value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="px-3 py-2 rounded-xl border border-input bg-background text-sm font-medium">
          {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}
        </StyledSelect>
        {periodType === 'biweekly' && (
          <StyledSelect value={biweekStart} onChange={e => setBiweekStart(e.target.value)} className="px-3 py-2 rounded-xl border border-input bg-background text-sm font-medium">
            <option value="1">1ª quincena (1-15)</option>
            <option value="16">2ª quincena (16-30)</option>
          </StyledSelect>
        )}
      </div>

      {commerces.length > 1 && (
        <div className="bg-card rounded-2xl border border-border card-shadow p-4 mb-6">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Store className="w-4 h-4" /> Comercios</p>
          <div className="flex flex-wrap gap-2">
            {commerces.map(c => (
              <button key={c.id} onClick={() => toggleCommerce(c.id)}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium', selectedCommerces[c.id] ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border')}>
                {selectedCommerces[c.id] ? '☑' : '☐'} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard icon={DollarSign} label="Ingresos" value={formatCurrency(stats.revenue, currency)} color="#465BE8" />
        <KpiCard icon={ShoppingCart} label="Ventas cerradas" value={String(stats.salesCount)} color="#22c55e" />
        <KpiCard icon={Wallet} label="Cobrado" value={formatCurrency(stats.collected, currency)} color="#0ea5e9" sublabel={`Tasa ${stats.collectionRate.toFixed(0)}%`} />
        <KpiCard icon={Clock} label="Pendiente" value={formatCurrency(stats.pending, currency)} color="#f59e0b" />
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6">
        <h2 className="font-semibold mb-4">Ventas por cliente</h2>
        {stats.topClients.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sin ventas en este período</p> : (
          <div className="space-y-1">
            {stats.topClients.map((c, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
                <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.count} venta{c.count > 1 ? 's' : ''}</span>
                <span className="text-sm font-semibold">{formatCurrency(c.total, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6">
        <h2 className="font-semibold mb-4">Proyección de cobros</h2>
        {stats.upcoming.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sin cobros pendientes</p> : (
          <div className="space-y-1">
            {stats.upcoming.map((p, i) => (
              <div key={p.id || i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="flex-1 text-sm font-medium truncate">{p.client_name}</span>
                <span className="text-xs text-muted-foreground">Vence {formatDate(p.due_date)}</span>
                <span className="text-sm font-semibold">{formatCurrency(p.amount, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
        <h2 className="font-semibold mb-4">Proyección del pipeline</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl bg-secondary/50"><p className="text-xs text-muted-foreground mb-1">Valor ponderado</p><p className="text-lg font-bold">{formatCurrency(stats.weightedPipeline, currency)}</p></div>
          <div className="text-center p-4 rounded-xl bg-secondary/50"><p className="text-xs text-muted-foreground mb-1">Ticket promedio</p><p className="text-lg font-bold">{formatCurrency(stats.avgTicket, currency)}</p></div>
          <div className="text-center p-4 rounded-xl bg-secondary/50"><p className="text-xs text-muted-foreground mb-1">Tasa de cobro</p><p className="text-lg font-bold">{stats.collectionRate.toFixed(1)}%</p></div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, sublabel }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 card-shadow">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '1a', color }}><Icon className="w-4 h-4" /></span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}
