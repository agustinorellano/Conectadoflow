import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, Building2, FileBadge, Pencil, Send, Package2, Clock, PackageCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { useEntityList, useEntityMutations } from '@/lib/useEntityQuery';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { SupplierFormModal } from '@/pages/Suppliers';
import { formatCurrency, formatDate, timeAgo } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useData();
  const currency = config?.currency || 'ARS';
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sendingNote, setSendingNote] = useState(false);

  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ['Supplier', 'get', id],
    queryFn: () => base44.entities.Supplier.get(id).catch(() => null),
  });
  const { data: orders = [], isLoading: loadingOrders } = useEntityList('SupplierOrder', { filter: { supplier_id: id }, sort: '-order_date' });
  const { data: notes = [], isLoading: loadingNotes } = useEntityList('SupplierNote', { filter: { supplier_id: id }, sort: '-created_date' });
  const supplierMutations = useEntityMutations('Supplier');

  const invalidateNotes = () => queryClient.invalidateQueries({ queryKey: ['SupplierNote'] });

  const addNote = async () => {
    if (!note.trim()) return;
    setSendingNote(true);
    try {
      await base44.entities.SupplierNote.create({ supplier_id: id, note: note.trim(), created_by_name: user?.full_name });
      setNote('');
      invalidateNotes();
    } finally { setSendingNote(false); }
  };

  const loading = loadingSupplier || loadingOrders || loadingNotes;

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;
  if (!supplier) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">Proveedor no encontrado</p>
      <button onClick={() => navigate('/proveedores')} className="mt-4 text-primary">Volver</button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto">
      <button onClick={() => navigate('/proveedores')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Proveedores
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center text-xl font-bold shrink-0">
          {supplier.name?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{supplier.name}</h1>
            {supplier.category && <Badge variant="primary">{supplier.category}</Badge>}
            {supplier.is_active === false && <Badge variant="muted">Inactivo</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            {supplier.company && <span className="inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {supplier.company}</span>}
            {supplier.tax_id && <span className="inline-flex items-center gap-1.5"><FileBadge className="w-3.5 h-3.5" /> CUIT {supplier.tax_id}</span>}
            {supplier.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {supplier.phone}</span>}
            {supplier.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {supplier.email}</span>}
          </div>
          {supplier.notes && <p className="text-sm text-muted-foreground mt-2">{supplier.notes}</p>}
        </div>
        <button onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-input text-sm font-medium hover:bg-accent shrink-0">
          <Pencil className="w-4 h-4" /> Editar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <p className="text-sm font-semibold mb-3">Pedidos</p>
          {orders.length === 0 ? (
            <EmptyState icon={Package2} title="Sin pedidos" subtitle="Todavía no hay pedidos registrados con este proveedor." />
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="bg-card rounded-xl border border-border card-shadow p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium">{o.description}</p>
                    <p className="text-sm font-semibold shrink-0">{formatCurrency(o.amount, o.currency || currency)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-muted-foreground">{formatDate(o.order_date)}</span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium',
                      o.status === 'Recibido' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
                      {o.status === 'Recibido' ? <PackageCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {o.status}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded-full font-medium',
                      o.payment_status === 'Pagado' ? 'bg-success/15 text-success' : o.payment_status === 'Parcial' ? 'bg-warning/15 text-warning' : 'bg-destructive/10 text-destructive')}>
                      {o.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-3">Historial de conversación</p>
          <div className="bg-card rounded-xl border border-border card-shadow p-3.5 mb-3">
            <div className="flex items-end gap-2">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Agregar una nota (llamada, acuerdo, lo que se habló)…"
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              <button onClick={addNote} disabled={sendingNote || !note.trim()}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> {sendingNote ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin notas todavía.</p>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="bg-secondary/40 rounded-xl p-3">
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  <p className="text-xs text-muted-foreground mt-1">{n.created_by_name || 'Usuario'} · {timeAgo(n.created_date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SupplierFormModal form={editOpen ? supplier : null} onClose={() => setEditOpen(false)} mutations={supplierMutations} />
    </div>
  );
}
