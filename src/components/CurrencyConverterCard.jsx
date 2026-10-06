import React, { useEffect, useMemo, useState } from 'react';
import { Coins, Eye, EyeOff } from 'lucide-react';
import { fetchRates, convertFromArs } from '@/lib/currencyRates';
import { formatDateTime } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const CONVERTIBLE_CURRENCIES = [
  { key: 'USD', label: 'USD' },
  { key: 'USD_BLUE', label: 'USD blue' },
  { key: 'BRL', label: 'BRL' },
];

// Lets you pick which currency to VIEW the ARS income as, like a wallet
// switcher — it only changes the display, never the original stored
// amount/currency of any sale or payment.
export default function CurrencyConverterCard({ amountArs, baseCurrency = 'ARS' }) {
  const [rates, setRates] = useState(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState('BASE');
  const [hidden, setHidden] = useState(false);
  const canConvert = baseCurrency === 'ARS';
  const currencies = [{ key: 'BASE', label: baseCurrency }, ...(canConvert ? CONVERTIBLE_CURRENCIES : [])];

  useEffect(() => {
    let cancelled = false;
    if (canConvert) {
      fetchRates().then(r => { if (!cancelled) setRates(r); }).catch(() => { if (!cancelled) setError(true); });
    }
    return () => { cancelled = true; };
  }, [canConvert]);

  const converted = rates ? convertFromArs(amountArs, rates) : null;

  const baseSymbol = { ARS: '$', USD: 'US$', EUR: '€' }[baseCurrency] || '$';

  const display = useMemo(() => {
    if (selected === 'BASE') return { prefix: baseSymbol, value: amountArs, rateLabel: null };
    if (!converted) return { prefix: '', value: null, rateLabel: null };
    if (selected === 'USD') return { prefix: 'US$', value: converted.usdOficial, rateLabel: rates?.arsPerUsdOficial ? `$${Math.round(rates.arsPerUsdOficial).toLocaleString('es-AR')}/US$ oficial` : null };
    if (selected === 'USD_BLUE') return { prefix: 'US$', value: converted.usdBlue, rateLabel: rates?.arsPerUsdBlue ? `$${Math.round(rates.arsPerUsdBlue).toLocaleString('es-AR')}/US$ blue` : null };
    if (selected === 'BRL') return { prefix: 'R$', value: converted.brl, rateLabel: rates?.brlPerUsd && rates?.arsPerUsdOficial ? `R$${rates.brlPerUsd.toFixed(2)}/US$` : null };
    return { prefix: '', value: null, rateLabel: null };
  }, [selected, amountArs, converted, rates]);

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Coins className="w-3.5 h-3.5" />
          </span>
          <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Ingresos</p>
        </div>
        <button onClick={() => setHidden(!hidden)} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent shrink-0">
          {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-1 p-0.5 bg-secondary/60 rounded-lg w-fit mb-2.5 overflow-x-auto no-scrollbar">
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

      {error ? (
        <p className="text-xs text-muted-foreground">Cotización no disponible</p>
      ) : (
        <>
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {hidden ? '••••••' : display.value == null ? (selected === 'BASE' ? '—' : 'Cargando…') : `${display.prefix} ${display.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {selected === 'BASE'
              ? `Moneda original (${baseCurrency})`
              : display.rateLabel
                ? `Cotización ${display.rateLabel} · ${formatDateTime(rates?.date)}`
                : 'Solo visualización — el monto original no cambia'}
          </p>
          {!canConvert && selected === 'BASE' && (
            <p className="text-[11px] text-muted-foreground mt-0.5">La conversión está disponible para cuentas en ARS</p>
          )}
        </>
      )}
    </div>
  );
}
