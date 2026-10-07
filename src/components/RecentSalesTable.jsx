import React from 'react';
import { Receipt } from 'lucide-react';
import { formatDate } from '@/lib/flowUtils';

export default function RecentSalesTable({ sales, formatValue, onRowClick }) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
      <h2 className="font-semibold text-sm mb-3">Últimas transacciones</h2>
      {sales.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin ventas en el período</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="font-medium px-1 pb-2">Venta</th>
                <th className="font-medium px-1 pb-2">Cliente</th>
                <th className="font-medium px-1 pb-2 hidden sm:table-cell">Fecha</th>
                <th className="font-medium px-1 pb-2 hidden sm:table-cell">Medio</th>
                <th className="font-medium px-1 pb-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr
                  key={s.id}
                  onClick={() => onRowClick?.(s)}
                  className={onRowClick ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}
                >
                  <td className="px-1 py-2 rounded-l-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Receipt className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-medium whitespace-nowrap">{s.number || '—'}</span>
                    </div>
                  </td>
                  <td className="px-1 py-2 max-w-[140px] truncate">{s.client_name || '—'}</td>
                  <td className="px-1 py-2 text-muted-foreground whitespace-nowrap hidden sm:table-cell">{formatDate(s.date)}</td>
                  <td className="px-1 py-2 text-muted-foreground whitespace-nowrap hidden sm:table-cell">{s.bank_entity || s.payment_method || '—'}</td>
                  <td className="px-1 py-2 text-right font-semibold rounded-r-lg whitespace-nowrap">{formatValue(s.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
