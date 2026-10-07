import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Eye, EyeOff, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchRates, convertFromArs, convertAmount } from '@/lib/currencyRates';
import { buildPeriodSeries } from '@/lib/salesSeries';
import { inPeriod, previousPeriodAmount, variation as calcVariation } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const FLAG_CDN = 'https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags';
const BASE_FLAGS = { ARS: 'ar', USD: 'us', EUR: 'eu' };

const CONVERTIBLE_CURRENCIES = [
  { key: 'USD', label: 'USD', flag: 'us' },
  { key: 'USD_BLUE', label: 'USD blue', flag: 'us' },
  { key: 'BRL', label: 'BRL', flag: 'br' },
];

function FlagIcon({ code, className }) {
  return <img src={`${FLAG_CDN}/${code}.svg`} alt="" className={className} />;
}

const CHART_PERIODS = [
  { key: 'today', label: '1d' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'month', label: 'Mes' },
  { key: '3m', label: '3m' },
  { key: 'year', label: 'Año' },
];

function ChartTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-foreground text-background rounded-xl px-3.5 py-2.5 text-xs shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      <p className="opacity-80">{formatValue(payload[0].value)}</p>
    </div>
  );
}

// Ingresos + reporte de ventas, merged into one card: the wallet-style
// currency switcher plus the trend chart, each with their own time control
// (the chart's 1d/7d/30d/Mes/3m/Año pills are local to this card — they
// don't change the rest of the dashboard, same as the reference layout's
// chart-local period toggle).
export default function IncomeReportCard({ sales, baseCurrency = 'ARS', hidden, onToggleHidden }) {
  const [chartPeriod, setChartPeriod] = useState('month');
  const [rates, setRates] = useState(null);
  const [error, setError] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('BASE');

  const canConvert = baseCurrency === 'ARS';
  const currencies = useMemo(() => [{ key: 'BASE', label: baseCurrency, flag: BASE_FLAGS[baseCurrency] || null }, ...(canConvert ? CONVERTIBLE_CURRENCIES : [])], [baseCurrency, canConvert]);

  // Rates are needed even when canConvert is false: a sale can be in a
  // currency other than baseCurrency (a USD-priced product sold while the
  // org's base is ARS), so summing into `total` below needs them to add
  // up correctly — independent of the USD/BRL display-conversion feature,
  // which only applies when the base itself is ARS.
  useEffect(() => {
    let cancelled = false;
    fetchRates().then(r => { if (!cancelled) setRates(r); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const toBase = (amount, cur) => convertAmount(amount, cur || 'ARS', baseCurrency, rates);

  const { total, variationPct, series } = useMemo(() => {
    const notCancelled = sales.filter(s => s.status !== 'Cancelada').map(s => ({ ...s, total_amount: toBase(s.total_amount, s.currency) }));
    const periodSales = notCancelled.filter(s => inPeriod(s.date, chartPeriod));
    const sum = periodSales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
    const prevSum = previousPeriodAmount(notCancelled, 'date', 'total_amount', chartPeriod);
    return {
      total: sum,
      variationPct: calcVariation(sum, prevSum),
      series: buildPeriodSeries(notCancelled, chartPeriod),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, chartPeriod, rates, baseCurrency]);

  const converted = rates ? convertFromArs(total, rates) : null;
  const baseSymbol = { ARS: '$', USD: 'US$', EUR: '€' }[baseCurrency] || '$';
  const positive = variationPct >= 0;

  const display = useMemo(() => {
    if (selectedCurrency === 'BASE') return { prefix: baseSymbol, value: total, scale: 1 };
    if (!converted || !total) return { prefix: '', value: null, scale: 1 };
    const scale = (() => {
      if (selectedCurrency === 'USD') return converted.usdOficial != null ? converted.usdOficial / total : null;
      if (selectedCurrency === 'USD_BLUE') return converted.usdBlue != null ? converted.usdBlue / total : null;
      if (selectedCurrency === 'BRL') return converted.brl != null ? converted.brl / total : null;
      return null;
    })();
    const prefix = selectedCurrency === 'BRL' ? 'R$' : 'US$';
    if (scale == null) return { prefix, value: null, scale: 1 };
    return { prefix, value: total * scale, scale };
  }, [selectedCurrency, total, converted, baseSymbol]);

  const chartData = series.map(p => ({ ...p, v: p.value * (display.scale || 1) }));

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#465BE81a', color: '#465BE8' }}>
            <DollarSign className="w-[18px] h-[18px]" />
          </span>
          <p className="text-[13px] font-medium text-muted-foreground">Ingresos</p>
          <button onClick={onToggleHidden} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent shrink-0">
            {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-0.5 p-1 bg-secondary/60 rounded-full w-fit overflow-x-auto no-scrollbar">
          {currencies.map(c => {
            const active = selectedCurrency === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setSelectedCurrency(c.key)}
                className={cn(
                  'rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5',
                  active ? 'bg-foreground text-background pl-1 pr-3 py-1' : 'text-muted-foreground hover:text-foreground px-2.5 py-1'
                )}
              >
                {active && c.flag && (
                  <span className="w-5 h-5 rounded-full bg-background/90 flex items-center justify-center shrink-0 overflow-hidden">
                    <FlagIcon code={c.flag} className="w-full h-full object-cover" />
                  </span>
                )}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[32px] sm:text-[36px] font-bold tracking-tight leading-none">
        {hidden ? '••••••' : error ? '—' : display.value == null ? 'Cargando…' : `${display.prefix} ${display.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
      </p>
      {variationPct !== undefined && variationPct !== null && (
        <p className={cn('inline-flex items-center gap-1 text-[13px] font-medium mt-1.5', positive ? 'text-success' : 'text-destructive')}>
          {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {positive ? '+' : ''}{variationPct.toFixed(1)}% vs. período anterior
        </p>
      )}

      <div className="flex items-center gap-1 p-0.5 bg-secondary/60 rounded-lg w-fit mt-4 overflow-x-auto no-scrollbar">
        {CHART_PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setChartPeriod(p.key)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors',
              chartPeriod === p.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="h-[200px] -mx-2 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip formatValue={(v) => hidden ? '••••••' : `${display.prefix} ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} />} />
            <Line type="monotone" dataKey="v" stroke="#465BE8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
