import React, { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { fetchRates, convertFromArs } from '@/lib/currencyRates';
import { formatDateTime } from '@/lib/flowUtils';

// Shows the given ARS amount converted to USD/USD blue/BRL for reference
// only — it never touches the original stored amount or currency.
export default function CurrencyConverterCard({ amountArs }) {
  const [rates, setRates] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRates().then(r => { if (!cancelled) setRates(r); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const converted = rates ? convertFromArs(amountArs, rates) : null;

  const fmt = (v, prefix) => v == null ? '—' : `${prefix} ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Coins className="w-3.5 h-3.5" />
        </span>
        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">Ingresos en otras monedas</p>
      </div>
      {error ? (
        <p className="text-xs text-muted-foreground">Cotización no disponible</p>
      ) : !rates ? (
        <p className="text-xs text-muted-foreground">Cargando cotización…</p>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">USD oficial</span>
              <span className="font-semibold tabular-nums">{fmt(converted.usdOficial, '≈ US$')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">USD blue</span>
              <span className="font-semibold tabular-nums">{fmt(converted.usdBlue, '≈ US$')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">BRL</span>
              <span className="font-semibold tabular-nums">{fmt(converted.brl, '≈ R$')}</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Cotización ref. {rates.arsPerUsdOficial ? `$${Math.round(rates.arsPerUsdOficial).toLocaleString('es-AR')}/US$` : '—'} · {formatDateTime(rates.date)}
          </p>
        </>
      )}
    </div>
  );
}
