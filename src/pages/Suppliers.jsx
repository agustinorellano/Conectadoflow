import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Pencil, Trash2, Package2, Wallet, Clock, Phone, Mail, PackageCheck, PackageSearch } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { useEntityList, useEntityMutations } from '@/lib/useEntityQuery';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import Modal from '@/components/Modal';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency, formatDate } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const PAYMENT_STATUS_STYLES = {
  'Pendiente': 'destructive',
  'Parcial': 'warning',
  'Pagado': 'success',
};

export default function Suppliers() {
  const navigate = useNavigate();
  const { config } = useData();
  const currency = config?.currency || 'ARS';
  const { data: suppliers = [], isLoading: loadingSuppliers } = useEntityList('Supplier', { sort: 'name' });
  const { data: orders = [], isLoading: loadingOrders } = useEntityList('SupplierOrder', { sort: '-order_date' });
  const supplierMutations = useEntityMutations('Supplier');
  const orderMutations = useEntityMutations('SupplierOrder');

  const [tab, setTab] = useState('pedidos');
  const [supplierForm, setSupplierForm] = useState(null); // null | {} (new) | supplier (edit)
  const [orderForm, setOrderForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind: 'supplier'|'order', item }

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const activeSuppliers = suppliers.filter(s => s.is_active !== false);

  const kpis = useMemo(() => {
    const pending = orders.filter(o => o.status === 'Pendiente');
    const pendingPayment = orders.reduce((s, o) => s + Math.max(0, (Number(o.amount) || 0) - (Number(o.paid_amount) || 0)), 0);
    return {
      activeSuppliers: activeSuppliers.length,
      pendingOrders: pending.length,
      pendingPayment,
    };
  }, [orders, activeSuppliers]);

  const toggleOrderStatus = (order) => {
    const next = order.status === 'Pendiente' ? 'Recibido' : 'Pendiente';
    orderMutations.update.mutate({ id: order.id, status: next, received_date: next === 'Recibido' ? new Date().toISOString() : null });
  };

  const changePaymentStatus = (order, payment_status) => {
    orderMutations.update.mutate({ id: order.id, payment_status, paid_amount: payment_status === 'Pagado' ? order.amount : order.paid_amount });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'supplier') await supplierMutations.remove.mutateAsync(deleteTarget.item.id);
    else await orderMutations.remove.mutateAsync(deleteTarget.item.id);
    setDeleteTarget(null);
  };

  const loading = loadingSuppliers || loadingOrders;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 sm:w-7 sm:h-7 text-primary" /> Proveedores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Seguimiento día a día de pedidos, pagos y envíos.</p>
        </div>
        <button
          onClick={() => tab === 'pedidos' ? setOrderForm({}) : setSupplierForm({})}
          disabled={tab === 'pedidos' && activeSuppliers.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Plus className="w-4 h-4" /> {tab === 'pedidos' ? 'Nuevo pedido' : 'Nuevo proveedor'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiCard label="Proveedores activos" value={kpis.activeSuppliers} icon={Truck} />
        <KpiCard label="Pedidos pendientes" value={kpis.pendingOrders} icon={PackageSearch} accent="hsl(var(--warning))" />
        <KpiCard label="Pendiente de pago" value={formatCurrency(kpis.pendingPayment, currency)} icon={Wallet} accent="hsl(var(--destructive))" />
      </div>

      <div className="flex items-center gap-1.5 mb-5">
        {[{ id: 'pedidos', label: 'Pedidos' }, { id: 'proveedores', label: 'Proveedores' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : tab === 'pedidos' ? (
        orders.length === 0 ? (
          <EmptyState icon={Package2} title="Sin pedidos todavía"
            subtitle={activeSuppliers.length === 0 ? 'Primero agregá un proveedor en la pestaña Proveedores.' : 'Registrá tu primer pedido para empezar a hacer seguimiento.'} />
        ) : (
          <div className="space-y-2.5">
            {orders.map(o => (
              <div key={o.id} className="bg-card rounded-2xl border border-border card-shadow p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-sm">{supplierById[o.supplier_id]?.name || 'Proveedor eliminado'}</p>
                    <p className="text-sm text-muted-foreground">{o.description}</p>
                  </div>
                  <p className="font-bold text-base shrink-0">{formatCurrency(o.amount, o.currency || currency)}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-3">
                  <span>Pedido: {formatDate(o.order_date)}</span>
                  {o.expected_date && <span>· Estimado: {formatDate(o.expected_date)}</span>}
                  {o.tracking_info && <span>· Envío: {o.tracking_info}</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => toggleOrderStatus(o)}
                    className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity',
                      o.status === 'Recibido' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
                    {o.status === 'Recibido' ? <PackageCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {o.status}
                  </button>
                  <StyledSelect value={o.payment_status} onChange={e => changePaymentStatus(o, e.target.value)}
                    className={cn('h-auto w-auto px-3 py-1.5 rounded-full text-xs font-medium border-0',
                      PAYMENT_STATUS_STYLES[o.payment_status] === 'success' ? 'bg-success/15 text-success' :
                      PAYMENT_STATUS_STYLES[o.payment_status] === 'warning' ? 'bg-warning/15 text-warning' : 'bg-destructive/10 text-destructive')}>
                    <option value="Pendiente">Pago pendiente</option>
                    <option value="Parcial">Pago parcial</option>
                    <option value="Pagado">Pagado</option>
                  </StyledSelect>
                  <div className="flex-1" />
                  <button onClick={() => setOrderForm(o)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteTarget({ kind: 'order', item: o })} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        suppliers.length === 0 ? (
          <EmptyState icon={Truck} title="Sin proveedores todavía" subtitle="Agregá tu primer proveedor para empezar a registrar pedidos." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.map(s => (
              <div key={s.id} onClick={() => navigate(`/proveedores/${s.id}`)}
                className={cn('bg-card rounded-2xl border border-border card-shadow p-4 cursor-pointer hover:border-primary/40 transition-colors', s.is_active === false && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-semibold text-sm">{s.name}</p>
                  {s.category && <Badge variant="primary">{s.category}</Badge>}
                </div>
                {s.company && <p className="text-xs text-muted-foreground">{s.company}{s.tax_id ? ` · CUIT ${s.tax_id}` : ''}</p>}
                {s.contact_name && <p className="text-xs text-muted-foreground mb-1.5">{s.contact_name}</p>}
                <div className="space-y-0.5 mb-3">
                  {s.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" /> {s.phone}</p>}
                  {s.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> {s.email}</p>}
                </div>
                {s.is_active === false && <Badge variant="muted" className="mb-2">Inactivo</Badge>}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setSupplierForm(s)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteTarget({ kind: 'supplier', item: s })} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <SupplierFormModal form={supplierForm} onClose={() => setSupplierForm(null)} mutations={supplierMutations} />
      <OrderFormModal form={orderForm} onClose={() => setOrderForm(null)} mutations={orderMutations} suppliers={activeSuppliers} />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="¿Eliminar?" size="sm"
        footer={<>
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
          <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90">Eliminar</button>
        </>}>
        <p className="text-sm text-muted-foreground">
          {deleteTarget?.kind === 'supplier'
            ? `Se va a eliminar "${deleteTarget?.item?.name}" y sus pedidos asociados.`
            : 'Se va a eliminar este pedido.'}
        </p>
      </Modal>
    </div>
  );
}

export function SupplierFormModal({ form, onClose, mutations }) {
  const [values, setValues] = useState({});
  React.useEffect(() => {
    if (form) setValues({ name: '', company: '', tax_id: '', contact_name: '', phone: '', email: '', category: '', notes: '', is_active: true, ...form });
  }, [form]);
  if (!form) return null;
  const isEdit = !!form.id;

  const save = async () => {
    if (!values.name?.trim()) return;
    if (isEdit) await mutations.update.mutateAsync({ id: form.id, ...values });
    else await mutations.create.mutateAsync(values);
    onClose();
  };

  return (
    <Modal open={!!form} onClose={onClose} title={isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={!values.name?.trim()} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">Guardar</button>
      </>}>
      <div className="space-y-3">
        <input value={values.name || ''} onChange={e => setValues(v => ({ ...v, name: e.target.value }))} placeholder="Nombre del proveedor"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <input value={values.company || ''} onChange={e => setValues(v => ({ ...v, company: e.target.value }))} placeholder="Razón social"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <input value={values.tax_id || ''} onChange={e => setValues(v => ({ ...v, tax_id: e.target.value }))} placeholder="CUIT"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <input value={values.contact_name || ''} onChange={e => setValues(v => ({ ...v, contact_name: e.target.value }))} placeholder="Persona de contacto"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <div className="grid grid-cols-2 gap-2">
          <input value={values.phone || ''} onChange={e => setValues(v => ({ ...v, phone: e.target.value }))} placeholder="Número de contacto"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <input value={values.email || ''} onChange={e => setValues(v => ({ ...v, email: e.target.value }))} placeholder="Email"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <input value={values.category || ''} onChange={e => setValues(v => ({ ...v, category: e.target.value }))} placeholder="Rubro (ej. Insumos, Packaging)"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <textarea value={values.notes || ''} onChange={e => setValues(v => ({ ...v, notes: e.target.value }))} rows={2} placeholder="Notas"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={values.is_active !== false} onChange={e => setValues(v => ({ ...v, is_active: e.target.checked }))} />
          Proveedor activo
        </label>
      </div>
    </Modal>
  );
}

function OrderFormModal({ form, onClose, mutations, suppliers }) {
  const [values, setValues] = useState({});
  React.useEffect(() => {
    if (form) setValues({
      supplier_id: suppliers[0]?.id || '', description: '', amount: '', order_date: new Date().toISOString().slice(0, 10),
      expected_date: '', tracking_info: '', notes: '', ...form,
    });
  }, [form, suppliers]);
  if (!form) return null;
  const isEdit = !!form.id;

  const save = async () => {
    if (!values.supplier_id || !values.description?.trim()) return;
    const payload = { ...values, amount: Number(values.amount) || 0, expected_date: values.expected_date || null };
    if (isEdit) await mutations.update.mutateAsync({ id: form.id, ...payload });
    else await mutations.create.mutateAsync(payload);
    onClose();
  };

  return (
    <Modal open={!!form} onClose={onClose} title={isEdit ? 'Editar pedido' : 'Nuevo pedido'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={!values.supplier_id || !values.description?.trim()} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">Guardar</button>
      </>}>
      <div className="space-y-3">
        <StyledSelect value={values.supplier_id || ''} onChange={e => setValues(v => ({ ...v, supplier_id: e.target.value }))}
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </StyledSelect>
        <input value={values.description || ''} onChange={e => setValues(v => ({ ...v, description: e.target.value }))} placeholder="Qué se pidió"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <input type="number" value={values.amount} onChange={e => setValues(v => ({ ...v, amount: e.target.value }))} placeholder="Monto"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha de pedido</label>
            <input type="date" value={values.order_date || ''} onChange={e => setValues(v => ({ ...v, order_date: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entrega estimada</label>
            <input type="date" value={values.expected_date || ''} onChange={e => setValues(v => ({ ...v, expected_date: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <input value={values.tracking_info || ''} onChange={e => setValues(v => ({ ...v, tracking_info: e.target.value }))} placeholder="Envío (transportista, nº de seguimiento)"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <textarea value={values.notes || ''} onChange={e => setValues(v => ({ ...v, notes: e.target.value }))} rows={2} placeholder="Notas"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
    </Modal>
  );
}
