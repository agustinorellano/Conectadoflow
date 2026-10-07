import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Search, Trash2, Pencil, ChevronRight, ChevronDown, DollarSign, Wallet, Receipt, Package, Share2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { useEntityList } from '@/lib/useEntityQuery';
import { useCurrencyRates } from '@/lib/useCurrencyRates';
import { convertAmount } from '@/lib/currencyRates';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import ProgressBar from '@/components/ProgressBar';
import DateRangePicker from '@/components/DateRangePicker';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency, formatDate, inPeriod, PAYMENT_METHODS, SALE_STATUS, isOverdue, CARD_TYPES, CARD_BRANDS, INSTALLMENT_OPTIONS, SALE_CHANNELS } from '@/lib/flowUtils';
import { useCommerce } from '@/lib/CommerceContext';
import { cn } from '@/lib/utils';

// Nets out stock changes between a sale's old and new line items in one
// pass per product (avoids a stale-read bug if the same product appears
// in both with different quantities). Only affects kind='Producto' items
// that carry a product_id — free-text/service line items never touch stock.
//
// Deliberately never throws: a role without permission to edit Products
// (RLS blocks the stock update) must not make the sale itself look like it
// failed to save — the sale already exists by the time this runs. Instead
// it returns the names of any products whose stock could not be updated,
// so the caller can show a non-blocking warning.
async function syncProductStock(products, oldItems, newItems) {
  const deltas = {};
  (oldItems || []).forEach(it => { if (it.product_id) deltas[it.product_id] = (deltas[it.product_id] || 0) + (Number(it.quantity) || 0); });
  (newItems || []).forEach(it => { if (it.product_id) deltas[it.product_id] = (deltas[it.product_id] || 0) - (Number(it.quantity) || 0); });
  const jobs = Object.entries(deltas).filter(([, d]) => d !== 0).map(([productId, delta]) => {
    const p = products.find(x => x.id === productId);
    if (!p || p.kind !== 'Producto') return null;
    return { p, delta };
  }).filter(Boolean);
  const failed = [];
  await Promise.all(jobs.map(async ({ p, delta }) => {
    try {
      await base44.entities.Product.update(p.id, { stock: Math.max(0, (Number(p.stock) || 0) + delta) });
    } catch {
      failed.push(p.name);
    }
  }));
  return failed;
}

export default function Sales() {
  const { user } = useAuth();
  const { config } = useData();
  const { filterByCommerce, currentCommerceId } = useCommerce();
  const queryClient = useQueryClient();
  const { data: sales = [], isLoading: loadingSales } = useEntityList('Sale', { sort: '-date', limit: 200 });
  const { data: payments = [], isLoading: loadingPayments } = useEntityList('Payment');
  const { data: clients = [], isLoading: loadingClients } = useEntityList('Client');
  const { data: products = [], isLoading: loadingProducts } = useEntityList('Product');
  const loading = loadingSales || loadingPayments || loadingClients || loadingProducts;
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all');
  const [searchParams] = useSearchParams();

  const currency = config?.currency || 'ARS';
  const rates = useCurrencyRates();
  // A sale can be in a different currency than the org's default (e.g. a
  // USD-priced product sold while the org's base is ARS) — summing
  // total_amount/collected_amount/balance across sales only makes sense
  // once everything is expressed in the same currency.
  const toBase = (amount, saleCurrency) => convertAmount(amount, saleCurrency || 'ARS', currency, rates);

  // Mutations below touch Sale/Payment/Client/Product in combination
  // (e.g. cancelling a sale restores Product stock and adjusts Client
  // totals), so a single invalidate covers whichever of the four actually
  // changed instead of each call site tracking that itself.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['Sale'] });
    queryClient.invalidateQueries({ queryKey: ['Payment'] });
    queryClient.invalidateQueries({ queryKey: ['Client'] });
    queryClient.invalidateQueries({ queryKey: ['Product'] });
  };

  useEffect(() => { if (searchParams.get('new')) setShowForm(true); }, [searchParams]);

  const fSales = filterByCommerce(sales).filter(s => period === 'all' || inPeriod(s.date, period));
  const filtered = fSales.filter(s => {
    const q = search.toLowerCase();
    return !q || [s.number, s.client_name].some(v => (v || '').toLowerCase().includes(q));
  });

  const statusVariant = (s) => ({ Pendiente: 'warning', Confirmada: 'success', Cancelada: 'destructive' }[s] || 'muted');
  const payVariant = (s) => ({ Pagado: 'success', Parcial: 'warning', Pendiente: 'muted', Vencido: 'destructive', Cancelado: 'muted' }[s] || 'muted');

  const changeStatus = async (saleId, newStatus) => {
    const s = sales.find(x => x.id === saleId);
    await base44.entities.Sale.update(saleId, { status: newStatus });
    // Cancelling a sale means what it reserved was never actually sold —
    // give the stock back. Un-cancelling re-reserves it.
    if (s && s.status !== newStatus) {
      if (newStatus === 'Cancelada') await syncProductStock(products, s.items, []);
      else if (s.status === 'Cancelada') await syncProductStock(products, [], s.items);
    }
    invalidate();
  };

  const handleEdit = (s) => { setEditingSale(s); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingSale(null); };

  const handleDelete = async (s) => {
    if (!confirm(`¿Eliminar la venta ${s.number}? Esta acción no se puede deshacer y también va a borrar su plan de pagos.`)) return;
    const salePayments = payments.filter(p => p.sale_id === s.id);
    await Promise.all(salePayments.map(p => base44.entities.Payment.delete(p.id)));
    await base44.entities.Sale.delete(s.id);
    await syncProductStock(products, s.items, []);
    if (s.client_id) {
      const client = clients.find(c => c.id === s.client_id);
      if (client) {
        await base44.entities.Client.update(client.id, {
          total_sold: Math.max(0, (Number(client.total_sold) || 0) - toBase(s.total_amount, s.currency)),
          balance: Math.max(0, (Number(client.balance) || 0) - toBase(s.balance, s.currency)),
          total_collected: Math.max(0, (Number(client.total_collected) || 0) - toBase(s.collected_amount, s.currency)),
        });
      }
    }
    invalidate();
  };

  const totals = {
    count: fSales.length,
    billed: fSales.reduce((s, x) => s + toBase(x.total_amount, x.currency), 0),
    collected: fSales.reduce((s, x) => s + toBase(x.collected_amount, x.currency), 0),
    pending: fSales.reduce((s, x) => s + toBase(x.balance, x.currency), 0),
  };

  // Ventas por producto: breaks the totals above down item by item, since
  // "Total ventas" etc. only count sale documents, not what was actually
  // sold within each one.
  const productSales = useMemo(() => {
    const map = {};
    fSales.filter(s => s.status !== 'Cancelada').forEach(s => {
      (s.items || []).forEach(it => {
        const key = it.description || 'Sin nombre';
        if (!map[key]) map[key] = { name: key, units: 0, revenue: 0 };
        map[key].units += Number(it.quantity) || 0;
        const itemAmount = Number(it.subtotal) || (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
        map[key].revenue += toBase(itemAmount, s.currency);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [fSales, rates, currency]);

  // Ventas por canal: which channel (WhatsApp, Instagram, Web, Local…)
  // actually closes sales, not just which one brings leads in.
  const channelSales = useMemo(() => {
    const map = {};
    fSales.filter(s => s.status !== 'Cancelada').forEach(s => {
      const key = s.channel || 'Sin especificar';
      if (!map[key]) map[key] = { name: key, count: 0, revenue: 0 };
      map[key].count += 1;
      map[key].revenue += toBase(s.total_amount, s.currency);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [fSales, rates, currency]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totals.count} ventas · {formatCurrency(totals.billed, currency)}
          </p>
        </div>
        <div className="flex gap-2">
          <DateRangePicker value={period} onChange={setPeriod} presets={[
            { key: 'all', label: 'Todo' },
            { key: 'today', label: 'Hoy' },
            { key: '7d', label: 'Últimos 7 días' },
            { key: '30d', label: 'Últimos 30 días' },
            { key: 'month', label: 'Este mes' },
            { key: '3m', label: 'Últimos 3 meses' },
            { key: 'year', label: 'Este año' },
          ]} />
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nueva venta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Total ventas" value={totals.count} icon={ShoppingCart} accent="#465BE8" />
        <KpiCard label="Facturado" value={formatCurrency(totals.billed, currency)} icon={DollarSign} accent="#22c55e" />
        <KpiCard label="Cobrado" value={formatCurrency(totals.collected, currency)} icon={Receipt} accent="#0ea5e9" />
        <KpiCard label="Pendiente" value={formatCurrency(totals.pending, currency)} icon={Wallet} accent="#f59e0b" />
      </div>

      {(productSales.length > 0 || channelSales.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          {productSales.length > 0 && (
            <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </span>
                <h2 className="font-semibold text-sm">Ventas por producto</h2>
              </div>
              <div className="space-y-3.5">
                {productSales.map(p => (
                  <ProgressBar key={p.name} label={p.name} value={p.revenue} max={productSales[0].revenue}
                    formatValue={v => formatCurrency(v, currency)} sublabel={`${p.units} unidad${p.units === 1 ? '' : 'es'} vendida${p.units === 1 ? '' : 's'}`} />
                ))}
              </div>
            </div>
          )}
          {channelSales.length > 0 && (
            <div className="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </span>
                <h2 className="font-semibold text-sm">Ventas por canal</h2>
              </div>
              <div className="space-y-3.5">
                {channelSales.map(c => (
                  <ProgressBar key={c.name} label={c.name} value={c.revenue} max={channelSales[0].revenue}
                    formatValue={v => formatCurrency(v, currency)} sublabel={`${c.count} venta${c.count === 1 ? '' : 's'}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ventas…"
          className="w-full pl-10 pr-4 h-11 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        filtered.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Sin ventas" subtitle="Registrá tu primera venta para empezar a cobrar."
            action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nueva venta</button>} />
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {filtered.map(s => {
                const salePayments = payments.filter(p => p.sale_id === s.id);
                const isOpen = expanded === s.id;
                return (
                  <motion.div key={s.id} layout className="bg-card rounded-2xl border border-border card-shadow overflow-hidden">
                    <div onClick={() => setExpanded(isOpen ? null : s.id)} className="w-full flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors text-left cursor-pointer">
                      <span className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{s.number} · {s.client_name}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(s.date)} · {s.items?.length || 0} ítem(s){s.channel ? ` · ${s.channel}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">{formatCurrency(s.total_amount, s.currency || currency)}</p>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                           <Badge variant={statusVariant(s.status)}>Venta: {s.status}</Badge>
                           <Badge variant={payVariant(s.payment_status)} dot>Cobro: {s.payment_status}</Badge>
                         </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleEdit(s)} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center" title="Editar venta">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(s)} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center" title="Eliminar venta">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {isOpen ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                          className="border-t border-border overflow-hidden">
                          <div className="p-4 space-y-4">
                            {/* Status changer */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado de situación</span>
                              <div className="ml-auto">
                                <StyledSelect
                                  value={s.status}
                                  onChange={e => changeStatus(s.id, e.target.value)}
                                  className="pl-3 pr-3 py-1.5 h-auto rounded-lg border border-border bg-card text-sm font-medium"
                                >
                                  {SALE_STATUS.map(st => <option key={st} value={st}>{st}</option>)}
                                </StyledSelect>
                              </div>
                            </div>
                            {/* Items */}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Detalle</p>
                              <div className="space-y-1.5">
                                {(s.items || []).map((it, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50">
                                    <span className="flex-1">{it.description} <span className="text-muted-foreground">× {it.quantity}</span></span>
                                    <span className="font-medium">{formatCurrency(it.subtotal || (it.unit_price * it.quantity), s.currency || currency)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between pt-2 text-sm">
                                  <span className="text-muted-foreground">Bruto</span><span>{formatCurrency(s.gross_amount, s.currency || currency)}</span>
                                </div>
                                {s.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Descuento</span><span>-{formatCurrency(s.discount, s.currency || currency)}</span></div>}
                                {s.tax > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Impuestos</span><span>{formatCurrency(s.tax, s.currency || currency)}</span></div>}
                                <div className="flex justify-between font-bold pt-1"><span>Total</span><span>{formatCurrency(s.total_amount, s.currency || currency)}</span></div>
                              </div>
                            </div>
                            {/* Payments */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pagos</p>
                                <span className="text-xs text-muted-foreground">{formatCurrency(s.collected_amount, s.currency || currency)} / {formatCurrency(s.total_amount, s.currency || currency)}</span>
                              </div>
                              <PaymentPlan sale={s} payments={salePayments} currency={s.currency || currency} onPaid={invalidate} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )
      }

      <SaleForm open={showForm} onClose={closeForm} onSaved={invalidate} clients={clients} products={products} user={user} config={config} sale={editingSale} />
    </div>
  );
}

function PaymentPlan({ sale, payments, currency, onPaid }) {
  const [amount, setAmount] = useState('');
  const register = async (p) => {
    await base44.entities.Payment.update(p.id, { status: 'Pagado', paid_date: new Date().toISOString().slice(0, 10) });
    // recalc sale
    const allP = payments.map(x => x.id === p.id ? { ...x, status: 'Pagado' } : x);
    const collected = allP.filter(x => x.status === 'Pagado').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const balance = sale.total_amount - collected;
    let ps = 'Pendiente';
    if (balance <= 0) ps = 'Pagado';
    else if (collected > 0) ps = 'Parcial';
    await base44.entities.Sale.update(sale.id, { collected_amount: collected, balance, payment_status: ps });
    onPaid();
  };

  return (
    <div className="space-y-1.5">
      {payments.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin plan de pagos. La venta completa está pendiente de cobro.</p>}
      {payments.map(p => (
        <div key={p.id} className={cn('flex items-center justify-between p-2.5 rounded-xl border', p.status === 'Pagado' ? 'bg-success/5 border-success/20' : isOverdue(p.due_date) && p.status !== 'Pagado' ? 'bg-destructive/5 border-destructive/20' : 'border-border')}>
          <div>
            <p className="text-sm font-medium">Pago {p.installment_number}/{p.total_installments}</p>
            <p className="text-xs text-muted-foreground">Vence {formatDate(p.due_date)} · {p.method}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{formatCurrency(p.amount, currency)}</span>
            {p.status !== 'Pagado' && (
              <button onClick={() => register(p)} className="px-3 py-1.5 rounded-lg bg-success text-white text-xs font-medium hover:opacity-90">Cobrar</button>
            )}
            {p.status === 'Pagado' && <Badge variant="success">Pagado</Badge>}
            {isOverdue(p.due_date) && p.status !== 'Pagado' && <Badge variant="destructive">Vencido</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}

const CURRENCY_OPTIONS = ['ARS', 'USD', 'EUR'];

function emptySaleFormFor(config) {
  return {
    client_id: '', client_mode: 'existing', new_client_name: '', new_client_phone: '',
    date: new Date().toISOString().slice(0, 10), currency: config?.currency || 'ARS',
    discount_pct: '', apply_tax: !!config?.tax_rate, payment_method: 'Transferencia', status: 'Confirmada',
    installments: 1, observations: '', bank_entity: '', card_type: '', card_brand: '', installments_count: 1, channel: '',
  };
}
const CUSTOM_ITEM = '__custom__';

function SaleForm({ open, onClose, onSaved, clients, products, user, config, sale }) {
  const [form, setForm] = useState(() => emptySaleFormFor(config));
  const { currentCommerceId: curCommerceId } = useCommerce();
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const taxRate = (config?.tax_rate || 0) / 100;
  const isEditing = !!sale;
  // Client.total_sold/balance/total_collected are always kept in the org's
  // base currency — a sale entered in a different one needs converting
  // before it's added to those running totals, same as every other
  // aggregate that touches multiple currencies.
  const rates = useCurrencyRates();
  const orgCurrency = config?.currency || 'ARS';
  const toOrgBase = (amount, cur) => convertAmount(amount, cur || 'ARS', orgCurrency, rates);

  useEffect(() => {
    if (!open) return;
    setError(''); setWarning('');
    if (sale) {
      setForm({
        client_id: sale.client_id || '', client_mode: 'existing', new_client_name: '', new_client_phone: '',
        date: (sale.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        currency: sale.currency || config?.currency || 'ARS',
        discount_pct: sale.gross_amount ? String(((Number(sale.discount) || 0) / sale.gross_amount * 100).toFixed(2)).replace(/\.00$/, '') : '',
        apply_tax: Number(sale.tax) > 0,
        payment_method: sale.payment_method || 'Transferencia',
        status: sale.status || 'Confirmada', installments: sale.installments_count || 1, observations: sale.observations || '',
        bank_entity: sale.bank_entity || '', card_type: sale.card_type || '', card_brand: sale.card_brand || '',
        installments_count: sale.installments_count || 1, channel: sale.channel || '',
      });
      setItems(sale.items?.length ? sale.items.map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, product_id: it.product_id, custom: !it.product_id })) : [{ description: '', quantity: 1, unit_price: '' }]);
    } else {
      const firstClient = clients[0];
      setForm({ ...emptySaleFormFor(config), client_id: firstClient?.id || '', channel: firstClient?.lead_source || '' });
      setItems([{ description: '', quantity: 1, unit_price: '' }]);
    }
  }, [open, sale, clients, config]);

  const gross = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  const discountPct = Math.min(100, Math.max(0, Number(form.discount_pct) || 0));
  const discount = gross * (discountPct / 100);
  const tax = form.apply_tax ? (gross - discount) * taxRate : 0;
  const total = gross - discount + tax;

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: '' }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const save = async () => {
    setError('');
    if (form.client_mode === 'existing' && !form.client_id) { setError('Elegí un cliente.'); return; }
    if (form.client_mode === 'new' && !form.new_client_name.trim()) { setError('Ingresá el nombre del cliente nuevo.'); return; }
    if (items.length === 0 || gross <= 0) { setError('Agregá al menos un producto o servicio con precio.'); return; }
    setSaving(true);
    try {
      let client = clients.find(c => c.id === form.client_id);
      if (form.client_mode === 'new') {
        client = await base44.entities.Client.create({
          name: form.new_client_name.trim(), phone: form.new_client_phone.trim(), type: 'Consumidor',
          status: 'Activo', total_sold: 0, total_collected: 0, balance: 0,
          owner_id: user?.id, owner_name: user?.full_name,
        });
      }
      if (!client) { setError('No se encontró el cliente seleccionado.'); setSaving(false); return; }

      const computedItems = items.map(it => ({ ...it, subtotal: (Number(it.unit_price) || 0) * (Number(it.quantity) || 1) }));

      if (isEditing) {
        const oldTotal = Number(sale.total_amount) || 0;
        const collected = Number(sale.collected_amount) || 0;
        const newBalance = Math.max(0, total - collected);
        let paymentStatus = 'Pendiente';
        if (newBalance <= 0) paymentStatus = 'Pagado';
        else if (collected > 0) paymentStatus = 'Parcial';

        await base44.entities.Sale.update(sale.id, {
          client_id: client.id, client_name: client.name,
          items: computedItems, gross_amount: gross, discount, tax, total_amount: total, currency: form.currency,
          date: form.date, payment_method: form.payment_method, bank_entity: form.bank_entity,
          card_type: form.card_type, card_brand: form.card_brand, installments_count: Number(form.installments_count) || 1,
          status: form.status, observations: form.observations, channel: form.channel || null,
          balance: newBalance, payment_status: paymentStatus,
        });
        const failed = await syncProductStock(products, sale.items, computedItems);
        if (failed.length) setWarning(`La venta se guardó, pero no se pudo actualizar el stock de: ${failed.join(', ')}. Pedile a un administrador que lo ajuste.`);

        // oldTotal was recorded in the sale's previous currency (which may
        // differ from the one just chosen), so each side of the delta is
        // converted to the org base on its own before subtracting.
        const delta = toOrgBase(total, form.currency) - toOrgBase(oldTotal, sale.currency);
        if (delta !== 0 && client.id === sale.client_id) {
          await base44.entities.Client.update(client.id, {
            total_sold: Math.max(0, (Number(client.total_sold) || 0) + delta),
            balance: Math.max(0, (Number(client.balance) || 0) + delta),
          });
        }
      } else {
        const num = `V-${Date.now().toString().slice(-6)}`;
        const newSale = await base44.entities.Sale.create({
          number: num, client_id: client.id, client_name: client.name,
          items: computedItems, gross_amount: gross, discount, tax, total_amount: total, currency: form.currency,
          date: form.date, payment_method: form.payment_method, bank_entity: form.bank_entity, card_type: form.card_type, card_brand: form.card_brand, installments_count: Number(form.installments_count) || 1, status: form.status,
          channel: form.channel || null,
          commerce_id: curCommerceId !== 'all' ? curCommerceId : undefined,
          collected_amount: 0, balance: total, payment_status: 'Pendiente', observations: form.observations,
          owner_id: user?.id, owner_name: user?.full_name,
        });
        const failed = await syncProductStock(products, [], computedItems);
        if (failed.length) setWarning(`La venta se registró, pero no se pudo actualizar el stock de: ${failed.join(', ')}. Pedile a un administrador que lo ajuste.`);
        // create payment plan
        const inst = Number(form.installments_count) || Number(form.installments) || 1;
        const installmentAmount = total / inst;
        const paymentRecords = [];
        for (let i = 0; i < inst; i++) {
          const due = new Date();
          due.setDate(due.getDate() + 30 * (i + 1));
          paymentRecords.push({
            sale_id: newSale.id, sale_number: num, client_id: client.id, client_name: client.name,
            installment_number: i + 1, total_installments: inst, amount: installmentAmount, currency: form.currency,
            due_date: due.toISOString().slice(0, 10), method: form.payment_method, status: 'Pendiente', commerce_id: curCommerceId !== 'all' ? curCommerceId : undefined,
          });
        }
        await base44.entities.Payment.bulkCreate(paymentRecords);
        // update client totals
        const totalInBase = toOrgBase(total, form.currency);
        const newSold = (client.total_sold || 0) + totalInBase;
        const newBalance = (client.balance || 0) + totalInBase;
        await base44.entities.Client.update(client.id, { total_sold: newSold, balance: newBalance, last_contact: new Date().toISOString() });
      }

      onSaved();
      setItems([{ description: '', quantity: 1, unit_price: '' }]);
      setForm(emptySaleFormFor(config));
      if (!warning) onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la venta. Probá de nuevo.');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar venta' : 'Nueva venta'} size="lg"
      footer={<>
        <div className="mr-auto text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{formatCurrency(total, form.currency)}</p>
        </div>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">{warning ? 'Cerrar' : 'Cancelar'}</button>
        {!warning && <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Registrar venta'}</button>}
      </>}>
      <div className="space-y-4">
        {error && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>}
        {warning && <div className="p-3 rounded-xl bg-warning/10 text-warning text-sm">{warning}</div>}

        <div>
          <label className="text-sm font-medium mb-1.5 block">Cliente *</label>
          <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit mb-2">
            <button type="button" onClick={() => setForm({ ...form, client_mode: 'existing' })}
              className={cn('px-3 h-8 rounded-lg text-xs font-medium transition-colors', form.client_mode === 'existing' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              Cliente existente (B2B)
            </button>
            <button type="button" onClick={() => setForm({ ...form, client_mode: 'new' })}
              className={cn('px-3 h-8 rounded-lg text-xs font-medium transition-colors', form.client_mode === 'new' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              Cliente nuevo (B2C)
            </button>
          </div>
          {form.client_mode === 'existing' ? (
            <StyledSelect value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="inp">
              <option value="">Seleccionar…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </StyledSelect>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input value={form.new_client_name} onChange={e => setForm({ ...form, new_client_name: e.target.value })} placeholder="Nombre del cliente *" className="inp" />
              <input value={form.new_client_phone} onChange={e => setForm({ ...form, new_client_phone: e.target.value })} placeholder="Teléfono (opcional)" className="inp" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Inp label="Fecha" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
          <div>
            <label className="text-sm font-medium mb-1.5 block">Moneda</label>
            <StyledSelect value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="inp">
              {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </StyledSelect>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Canal de venta</label>
          <input list="sale-channels" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}
            placeholder="Ej: WhatsApp, Instagram, Ecommerce…" className="inp" />
          <datalist id="sale-channels">{SALE_CHANNELS.map(c => <option key={c} value={c} />)}</datalist>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Productos / servicios</label>
            <button onClick={addItem} className="text-sm text-primary font-medium inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => {
              const linkedProduct = it.product_id ? products.find(x => x.id === it.product_id) : null;
              const overStock = linkedProduct?.kind === 'Producto' && Number(it.quantity) > (Number(linkedProduct.stock) || 0);
              const showCustomInput = it.custom && !it.product_id;
              return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  {showCustomInput ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} autoFocus
                        placeholder="Descripción del producto o servicio" className="inp flex-1" />
                      <button type="button" onClick={() => setItems(items.map((x, idx) => idx === i ? { ...x, custom: false, description: '' } : x))}
                        className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap px-1">Elegir del catálogo</button>
                    </div>
                  ) : (
                    <StyledSelect
                      value={it.product_id || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === CUSTOM_ITEM) {
                          setItems(items.map((x, idx) => idx === i ? { ...x, product_id: undefined, description: '', custom: true } : x));
                        } else {
                          const p = products.find(x => x.id === val);
                          setItems(items.map((x, idx) => idx === i ? { ...x, description: p?.name || '', unit_price: p ? p.price : x.unit_price, product_id: p?.id, custom: false } : x));
                        }
                      }}
                      className="inp flex-1"
                    >
                      <option value="">Seleccionar producto o servicio…</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.kind === 'Producto' ? ` (stock: ${p.stock ?? 0})` : ''}</option>
                      ))}
                      <option value={CUSTOM_ITEM}>Personalizado / otro…</option>
                    </StyledSelect>
                  )}
                  <input type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="inp w-16" placeholder="Cant" />
                  <input type="number" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} className="inp w-28" placeholder="Precio" />
                  <span className="text-sm font-medium w-24 text-right">{formatCurrency((Number(it.unit_price) || 0) * (Number(it.quantity) || 1), form.currency)}</span>
                  {items.length > 1 && <button onClick={() => removeItem(i)} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>}
                </div>
                {overStock && <p className="text-xs text-warning mt-1 ml-1">Supera el stock disponible ({linkedProduct.stock ?? 0} unidades)</p>}
              </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Inp label="Descuento (%)" type="number" value={form.discount_pct} onChange={v => setForm({ ...form, discount_pct: v })} placeholder="0" />
          <div>
            <label className="text-sm font-medium mb-1.5 block">Impuestos</label>
            <label className="inp flex items-center gap-2 cursor-pointer select-none h-[38px]">
              <input type="checkbox" checked={form.apply_tax} onChange={e => setForm({ ...form, apply_tax: e.target.checked })} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Aplicar {config?.tax_rate || 0}%</span>
            </label>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Cuotas</label>
            <StyledSelect value={form.installments_count} onChange={e => setForm({ ...form, installments_count: e.target.value, installments: e.target.value })} className="inp">{INSTALLMENT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}</StyledSelect>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Medio de pago</label>
            <StyledSelect value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="inp">{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</StyledSelect>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Estado</label>
            <StyledSelect value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="inp">{SALE_STATUS.map(s => <option key={s}>{s}</option>)}</StyledSelect>
          </div>
        </div>
        {(form.payment_method === 'Tarjeta' || form.payment_method === 'Crédito' || form.payment_method === 'Débito') && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-secondary/50">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Entidad / Banco</label>
              <input value={form.bank_entity} onChange={e => setForm({ ...form, bank_entity: e.target.value })} placeholder="Ej: Santander" className="inp" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo de tarjeta</label>
              <StyledSelect value={form.card_type} onChange={e => setForm({ ...form, card_type: e.target.value })} className="inp"><option value="">—</option>{CARD_TYPES.map(t => <option key={t}>{t}</option>)}</StyledSelect>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Marca</label>
              <StyledSelect value={form.card_brand} onChange={e => setForm({ ...form, card_brand: e.target.value })} className="inp"><option value="">—</option>{CARD_BRANDS.map(t => <option key={t}>{t}</option>)}</StyledSelect>
            </div>
          </div>
        )}
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}

function Inp({ label, value, onChange, type = 'text', placeholder }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="inp" /></div>;
}
