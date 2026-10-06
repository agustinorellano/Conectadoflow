import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { fetchRates, convertFromArs } from '@/lib/currencyRates';
import { formatDateTime } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const CONVERTIBLE_CURRENCIES = [
  { key: 'USD', label: 'USD' },
  { key: 'USD_BLUE', label: 'USD blue' },
  { key: 'BRL', label: 'BRL' },
];

// The Ingresos KPI, with a wallet-style currency switcher built in — like a
// MonthlyGoalCard-sized widget but for the headline revenue number. Picking
// a currency only changes how this number is displayed; it never touches
// the original stored amount/currency of any sale or payment.
export default function IncomeCard({ revenue, variationPct, baseCurrency = 'ARS', hidden, onToggleHidden, className, sparkline }) {
  const hasSparkline = sparkline && sparkline.length > 1;
  const [rates, setRates] = useState(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState('BASE');
  const canConvert = baseCurrency === 'ARS';
  const currencies = useMemo(() => [{ key: 'BASE', label: baseCurrency }, ...(canConvert ? CONVERTIBLE_CURRENCIES : [])], [baseCurrency, canConvert]);

  useEffect(() => {
    let cancelled = false;
    if (canConvert) {
      fetchRates().then(r => { if (!cancelled) setRates(r); }).catch(() => { if (!cancelled) setError(true); });
    }
    return () => { cancelled = true; };
  }, [canConvert]);

  const converted = rates ? convertFromArs(revenue, rates) : null;
  const baseSymbol = { ARS: '$', USD: 'US$', EUR: '€' }[baseCurrency] || '$';

  const display = useMemo(() => {
    if (selected === 'BASE') return { prefix: baseSymbol, value: revenue, rateLabel: null };
    if (!converted) return { prefix: '', value: null, rateLabel: null };
    if (selected === 'USD') return { prefix: 'US$', value: converted.usdOficial, rateLabel: rates?.arsPerUsdOficial ? `$${Math.round(rates.arsPerUsdOficial).toLocaleString('es-AR')}/US$ oficial` : null };
    if (selected === 'USD_BLUE') return { prefix: 'US$', value: converted.usdBlue, rateLabel: rates?.arsPerUsdBlue ? `$${Math.round(rates.arsPerUsdBlue).toLocaleString('es-AR')}/US$ blue` : null };
    if (selected === 'BRL') return { prefix: 'R$', value: converted.brl, rateLabel: rates?.brlPerUsd && rates?.arsPerUsdOficial ? `R$${rates.brlPerUsd.toFixed(2)}/US$` : null };
    return { prefix: '', value: null, rateLabel: null };
  }, [selected, revenue, converted, rates, baseSymbol]);

  const positive = variationPct >= 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className={cn('bg-card rounded-2xl border border-border p-5 card-shadow relative overflow-hidden', className)}
    >
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: '#465BE8' }} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#465BE81a', color: '#465BE8' }}>
              <DollarSign className="w-[18px] h-[18px]" />
            </span>
            <p className="text-[13px] font-medium text-muted-foreground">Ingresos</p>
            <button onClick={onToggleHidden} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent shrink-0">
              {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-[28px] font-bold tracking-tight leading-none">
              {hidden ? '••••••' : error ? '—' : display.value == null ? 'Cargando…' : `${display.prefix} ${display.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
            </p>
            {variationPct !== undefined && variationPct !== null && (
              <span className={cn(
                'inline-flex items-center gap-0.5 text-[12px] font-semibold px-1.5 py-0.5 rounded-md',
                positive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
              )}>
                {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {positive ? '+' : ''}{variationPct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {hasSparkline && (
          <div className="hidden lg:block h-14 flex-1 min-w-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline.map(val => ({ val }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="income-spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#465BE8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#465BE8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="val" stroke="#465BE8" strokeWidth={2} fill="url(#income-spark)" isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1 p-0.5 bg-secondary/60 rounded-lg w-fit overflow-x-auto no-scrollbar">
            {currencies.map(c => (
              <button
                key={c.key}
                onClick={() => setSelected(c.key)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors',
                  selected === c.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          {selected !== 'BASE' && display.rateLabel && (
            <p className="text-[11px] text-muted-foreground text-right">Cotización {display.rateLabel} · {formatDateTime(rates?.date)}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
