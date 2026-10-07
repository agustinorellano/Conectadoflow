import React from 'react';
import { PartyPopper, Package } from 'lucide-react';

export default function TopProductCard({ product }) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <PartyPopper className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">¡Felicitaciones!</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {product ? 'Este es tu producto más vendido del período' : 'Todavía no hay ventas en este período'}
      </p>
      {product ? (
        <div className="mt-auto flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
          <span className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.units} unidades vendidas</p>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-center justify-center py-6 text-muted-foreground text-sm">
          Sin datos aún
        </div>
      )}
    </div>
  );
}
