import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Search, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency, formatDate, PAYMENT_METHODS, SALE_STATUS, isOverdue, CARD_TYPES, CARD_BRANDS, INSTALLMENT_OPTIONS } from '@/lib/flowUtils';
import { useCommerce } from '@/lib/CommerceContext';
import { cn } from '@/lib/utils';

export default function Sales() {
  const { user } = useAuth();
  const { config } = useData();
  const { filterByCommerce, currentCommerceId } = useCommerce();
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();

  const currency = config?.currency || 'ARS';

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, c, pr] = await Promise.all([
        base44.entities.Sale.list('-date', 200).catch(() => []),
        base44.entities.Payment.list().catch(() => []),
        base44.entities.Client.list().catch(() => []),
        base44.entities.Product.list().catch(() => []),
      ]);
      setSales(s); setPayments(p); setClients(c); setProducts(pr);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (searchParams.get('new')) setShowForm(true); }, [searchParams]);

  const filtered = filterByCommerce(sales).filter(s => {
    const q = search.toLowerCase();
    return !q || [s.number, s.client_name].some(v => (v || '').toLowerCase().includes(q));
  });

  const statusVariant = (s) => ({ Pendiente: 'warning', Confirmada: 'success', Cancelada: 'destructive' }[s] || 'muted');
  const payVariant = (s) => ({ Pagado: 'success', Parcial: 'warning', Pendiente: 'muted', Vencido: 'destructive', Cancelado: 'muted' }[s] || 'muted');

  const changeStatus = async (saleId, newStatus) => {
    await base44.entities.Sale.update(saleId, { status: newStatus });
    load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sales.length} ventas · {formatCurrency(sales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0), currency)}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva venta
        </button>
      </div>

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
                    <button onClick={() => setExpanded(isOpen ? null : s.id)} className="w-full flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors text-left">
                      <span className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{s.number} · {s.client_name}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(s.date)} · {s.items?.length || 0} ítem(s)</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">{formatCurrency(s.total_amount, currency)}</p>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                           <Badge variant={statusVariant(s.status)}>Venta: {s.status}</Badge>
                           <Badge variant={payVariant(s.payment_status)} dot>Cobro: {s.payment_status}</Badge>
                         </div>
                      </div>
                      {isOpen ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    </button>
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
                                    <span className="font-medium">{formatCurrency(it.subtotal || (it.unit_price * it.quantity), currency)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between pt-2 text-sm">
                                  <span className="text-muted-foreground">Bruto</span><span>{formatCurrency(s.gross_amount, currency)}</span>
                                </div>
                                {s.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Descuento</span><span>-{formatCurrency(s.discount, currency)}</span></div>}
                                {s.tax > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Impuestos</span><span>{formatCurrency(s.tax, currency)}</span></div>}
                                <div className="flex justify-between font-bold pt-1"><span>Total</span><span>{formatCurrency(s.total_amount, currency)}</span></div>
                              </div>
                            </div>
                            {/* Payments */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pagos</p>
                                <span className="text-xs text-muted-foreground">{formatCurrency(s.collected_amount, currency)} / {formatCurrency(s.total_amount, currency)}</span>
                              </div>
                              <PaymentPlan sale={s} payments={salePayments} currency={currency} onPaid={load} />
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

      <SaleForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} clients={clients} products={products} user={user} config={config} />
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

function SaleForm({ open, onClose, onSaved, clients, products, user, config }) {
  const [form, setForm] = useState({ client_id: '', date: new Date().toISOString().slice(0, 10), discount: '', tax: '', payment_method: 'Transferencia', status: 'Confirmada', installments: 1, observations: '', bank_entity: '', card_type: '', card_brand: '', installments_count: 1 });
  const { currentCommerceId: curCommerceId } = useCommerce();
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: '' }]);
  const [saving, setSaving] = useState(false);
  const currency = config?.currency || 'ARS';
  const taxRate = (config?.tax_rate || 0) / 100;

  useEffect(() => { if (open) setForm(f => ({ ...f, client_id: clients[0]?.id || '' })); }, [open, clients]);

  const gross = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  const discount = Number(form.discount) || 0;
  const tax = Number(form.tax) || (gross - discount) * taxRate;
  const total = gross - discount + tax;

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: '' }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const pickProduct = (i, productId) => {
    const p = products.find(x => x.id === productId);
    if (p) updateItem(i, 'description', p.name) || updateItem(i, 'unit_price', p.price);
  };

  const save = async () => {
    const client = clients.find(c => c.id === form.client_id);
    if (!client || items.length === 0) return;
    setSaving(true);
    try {
      const num = `V-${Date.now().toString().slice(-6)}`;
      const computedItems = items.map(it => ({ ...it, subtotal: (Number(it.unit_price) || 0) * (Number(it.quantity) || 1) }));
      const sale = await base44.entities.Sale.create({
        number: num, client_id: client.id, client_name: client.name,
        items: computedItems, gross_amount: gross, discount, tax, total_amount: total,
        date: form.date, payment_method: form.payment_method, bank_entity: form.bank_entity, card_type: form.card_type, card_brand: form.card_brand, installments_count: Number(form.installments_count) || 1, status: form.status,
        commerce_id: curCommerceId !== 'all' ? curCommerceId : undefined,
        collected_amount: 0, balance: total, payment_status: 'Pendiente', observations: form.observations,
        owner_id: user?.id, owner_name: user?.full_name,
      });
      // create payment plan
      const inst = Number(form.installments_count) || Number(form.installments) || 1;
      const installmentAmount = total / inst;
      const paymentRecords = [];
      for (let i = 0; i < inst; i++) {
        const due = new Date();
        due.setDate(due.getDate() + 30 * (i + 1));
        paymentRecords.push({
          sale_id: sale.id, sale_number: num, client_id: client.id, client_name: client.name,
          installment_number: i + 1, total_installments: inst, amount: installmentAmount,
          due_date: due.toISOString().slice(0, 10),           method: form.payment_method, status: 'Pendiente', commerce_id: curCommerceId !== 'all' ? curCommerceId : undefined,
        });
      }
      await base44.entities.Payment.bulkCreate(paymentRecords);
      // update client totals
      const newSold = (client.total_sold || 0) + total;
      const newBalance = (client.balance || 0) + total;
      await base44.entities.Client.update(client.id, { total_sold: newSold, balance: newBalance, last_contact: new Date().toISOString() });
      onSaved(); onClose();
      setItems([{ description: '', quantity: 1, unit_price: '' }]);
      setForm({ client_id: '', date: new Date().toISOString().slice(0, 10), discount: '', tax: '', payment_method: 'Transferencia', status: 'Confirmada', installments: 1, observations: '', bank_entity: '', card_type: '', card_brand: '', installments_count: 1 });
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva venta" size="lg"
      footer={<>
        <div className="mr-auto text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{formatCurrency(total, currency)}</p>
        </div>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.client_id} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Registrar venta'}</button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Cliente *</label>
            <StyledSelect value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="inp">
              <option value="">Seleccionar…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </StyledSelect>
          </div>
          <Inp label="Fecha" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Productos / servicios</label>
            <button onClick={addItem} className="text-sm text-primary font-medium inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input list="products-list" value={it.description} onChange={e => { updateItem(i, 'description', e.target.value); const p = products.find(x => x.name === e.target.value); if (p) updateItem(i, 'unit_price', p.price); }}
                  placeholder="Descripción" className="inp flex-1" />
                <datalist id="products-list">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
                <input type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="inp w-16" placeholder="Cant" />
                <input type="number" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} className="inp w-28" placeholder="Precio" />
                <span className="text-sm font-medium w-24 text-right">{formatCurrency((Number(it.unit_price) || 0) * (Number(it.quantity) || 1), currency)}</span>
                {items.length > 1 && <button onClick={() => removeItem(i)} className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Inp label="Descuento" type="number" value={form.discount} onChange={v => setForm({ ...form, discount: v })} />
          <Inp label="Impuestos" type="number" value={form.tax} onChange={v => setForm({ ...form, tax: v })} placeholder={`Auto ${config?.tax_rate || 0}%`} />
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
