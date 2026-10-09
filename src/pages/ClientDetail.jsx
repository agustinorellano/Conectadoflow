import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Phone, MapPin, Building2, Plus, DollarSign, Calendar, FileText, CheckCircle2, MessageCircle, TrendingUp, Edit3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SituationStatus from '@/components/SituationStatus';
import WhatsAppButton from '@/components/WhatsAppButton';
import DocumentGeneratorModal from '@/components/DocumentGeneratorModal';
import { CustomFieldsView } from '@/components/CustomFieldsSection';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import { ClientForm } from '@/pages/Clients';
import ClientPaymentMethods from '@/components/ClientPaymentMethods';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency, formatDate, formatDateTime, timeAgo, MEETING_TYPES, PAYMENT_METHODS } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const CLIENT_SUB_ENTITIES = ['Opportunity', 'Sale', 'Payment', 'Meeting', 'Activity'];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [oppForm, setOppForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [note, setNote] = useState('');

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ['Client', 'get', id],
    queryFn: () => base44.entities.Client.get(id).catch(() => null),
  });
  const subQueries = useQueries({
    queries: CLIENT_SUB_ENTITIES.map((name) => ({
      queryKey: [name, 'list', { filter: { client_id: id }, sort: undefined, limit: undefined }],
      queryFn: () => base44.entities[name].filter({ client_id: id }).catch(() => []),
    })),
  });
  const loading = loadingClient || subQueries.some(q => q.isLoading);
  const [opportunities, sales, payments, meetings, activities] = subQueries.map(q => q.data || []);

  const invalidate = (names) => names.forEach(n => queryClient.invalidateQueries({ queryKey: [n] }));

  const timeline = useMemo(() => [
    ...opportunities.map(o => ({ id: o.id, type: 'opportunity', date: o.created_date, title: `Oportunidad: ${o.title}`, subtitle: `${o.stage} · ${formatCurrency(o.amount)}`, icon: TrendingUp, color: 'text-primary' })),
    ...sales.map(s => ({ id: s.id, type: 'sale', date: s.date || s.created_date, title: `Venta ${s.number || ''}`, subtitle: `${formatCurrency(s.total_amount)} · ${s.payment_status}`, icon: DollarSign, color: 'text-success' })),
    ...payments.map(p => ({ id: p.id, type: 'payment', date: p.paid_date || p.due_date, title: `Pago ${p.installment_number}/${p.total_installments}`, subtitle: `${formatCurrency(p.amount)} · ${p.status}`, icon: DollarSign, color: p.status === 'Pagado' ? 'text-success' : 'text-warning' })),
    ...meetings.map(m => ({ id: m.id, type: 'meeting', date: m.date, title: m.title, subtitle: `${m.type} · ${formatDateTime(m.date)}`, icon: Calendar, color: 'text-cyan-600' })),
    ...activities.map(a => ({ id: a.id, type: 'activity', date: a.date, title: a.title, subtitle: a.description, icon: MessageCircle, color: 'text-muted-foreground' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)), [opportunities, sales, payments, meetings, activities]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;
  if (!client) return <div className="p-8 text-center"><p className="text-muted-foreground">Cliente no encontrado</p><button onClick={() => navigate('/clientes')} className="mt-4 text-primary">Volver</button></div>;

  const addNote = async () => {
    if (!note.trim()) return;
    await base44.entities.Activity.create({
      client_id: id, client_name: client.name, type: 'Nota', title: 'Nota', description: note,
      date: new Date().toISOString(), status: 'Realizada', owner_id: user?.id, owner_name: user?.full_name,
    });
    setNote('');
    invalidate(['Activity']);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <button onClick={() => navigate('/clientes')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Clientes
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center text-xl font-bold shrink-0">
          {client.name?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          {client.company && <p className="text-sm text-muted-foreground">{client.company}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={client.status === 'Activo' ? 'success' : 'muted'}>{client.status}</Badge>
            <Badge variant="primary">{client.type}</Badge>
            {client.segment && <Badge>{client.segment}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WhatsAppButton phone={client.phone} client={client} />
          <button onClick={() => setDocModal(true)} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:opacity-90">
            <FileText className="w-4 h-4" /> Documentos
          </button>
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent">
            <Edit3 className="w-4 h-4" /> Editar
          </button>
        </div>
      </div>

      {/* Contact info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {client.email && <InfoCard icon={Mail} label="Email" value={client.email} />}
        {client.phone && <InfoCard icon={Phone} label="Teléfono" value={client.phone} />}
        {client.tax_id && <InfoCard icon={Building2} label="DNI/CUIT" value={client.tax_id} />}
        {client.address && <InfoCard icon={MapPin} label="Dirección" value={client.address} />}
      </div>

      {/* Situation status */}
      <div className="mb-6">
        <SituationStatus client={client} opportunity={opportunities[0]} />
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total vendido</p>
          <p className="text-xl font-bold">{formatCurrency(client.total_sold || 0)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Cobrado</p>
          <p className="text-xl font-bold text-success">{formatCurrency(client.total_collected || 0)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className="text-xl font-bold text-warning">{formatCurrency(client.balance || 0)}</p>
        </div>
      </div>

      {/* Custom fields */}
      <div className="mb-6">
        <CustomFieldsView entity="Client" values={client.custom_fields} />
      </div>

      {/* Payment methods */}
      <div className="mb-6">
        <ClientPaymentMethods client={client} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunities */}
        <div className="bg-card rounded-2xl border border-border card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Oportunidades</h2>
            <button onClick={() => setOppForm(true)} className="text-sm text-primary font-medium inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nueva</button>
          </div>
          <div className="space-y-2">
            {opportunities.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Sin oportunidades</p>}
            {opportunities.map(o => (
              <div key={o.id} className="p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate">{o.title}</p>
                  <Badge variant={o.is_won ? 'success' : o.is_lost ? 'destructive' : 'primary'}>{o.stage}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatCurrency(o.amount)} · {o.probability}% · cierra {formatDate(o.expected_close_date)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick add note */}
        <div className="bg-card rounded-2xl border border-border card-shadow p-5">
          <h2 className="font-semibold mb-4">Agregar nota</h2>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Escribí una nota sobre este cliente…"
            className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-3" />
          <button onClick={addNote} disabled={!note.trim()} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">Guardar nota</button>
          <button onClick={() => setMeetingForm(true)} className="w-full mt-2 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent inline-flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" /> Programar reunión
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-6 bg-card rounded-2xl border border-border card-shadow p-5">
        <h2 className="font-semibold mb-4">Historial</h2>
        <div className="relative">
          <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-3">
            {timeline.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Sin actividad registrada</p>}
            {timeline.map(item => (
              <div key={`${item.type}-${item.id}`} className="flex gap-3 relative">
                <span className={cn('w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 z-10', item.color)}>
                  <item.icon className="w-4 h-4" />
                </span>
                <div className="flex-1 pt-1 pb-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => invalidate(['Client'])} editClient={client} user={user} />
      <OppFormModal open={oppForm} onClose={() => setOppForm(false)} onSaved={() => invalidate(['Opportunity'])} client={client} user={user} />
      <MeetingFormModal open={meetingForm} onClose={() => setMeetingForm(false)} onSaved={() => invalidate(['Meeting', 'Client'])} client={client} user={user} />
      <DocumentGeneratorModal client={docModal ? client : null} onClose={() => setDocModal(false)} />
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function OppFormModal({ open, onClose, onSaved, client, user }) {
  const [form, setForm] = useState({ title: '', product: '', amount: '', probability: 20, expected_close_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Opportunity.create({
        ...form, amount: Number(form.amount) || 0, client_id: client.id, client_name: client.name, client_company: client.company,
        stage: 'Nuevo lead', stage_order: 0, source: client.lead_source || '', owner_id: client.owner_id || user?.id, owner_name: client.owner_name || user?.full_name,
      });
      onSaved(); onClose();
      setForm({ title: '', product: '', amount: '', probability: 20, expected_close_date: '', notes: '' });
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nueva oportunidad" subtitle={client.name}
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.title} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Crear'}</button></>}>
      <div className="space-y-3">
        <Inp label="Título *" value={form.title} onChange={v => setForm({ ...form, title: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Producto/servicio" value={form.product} onChange={v => setForm({ ...form, product: v })} />
          <Inp label="Monto" type="number" value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
          <Inp label="Probabilidad (%)" type="number" value={form.probability} onChange={v => setForm({ ...form, probability: v })} />
          <Inp label="Cierre estimado" type="date" value={form.expected_close_date} onChange={v => setForm({ ...form, expected_close_date: v })} />
        </div>
      </div>
    </Modal>
  );
}

function MeetingFormModal({ open, onClose, onSaved, client, user }) {
  const [form, setForm] = useState({ title: '', date: '', type: 'Videollamada', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Meeting.create({
        ...form, date: new Date(form.date).toISOString(), client_id: client.id, client_name: client.name,
        status: 'Programada', owner_id: user?.id, owner_name: user?.full_name,
      });
      await base44.entities.Client.update(client.id, { next_meeting_date: new Date(form.date).toISOString() });
      onSaved(); onClose();
      setForm({ title: '', date: '', type: 'Videollamada', notes: '' });
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Programar reunión" subtitle={client.name}
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.title || !form.date} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Programar'}</button></>}>
      <div className="space-y-3">
        <Inp label="Título *" value={form.title} onChange={v => setForm({ ...form, title: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Fecha y hora" type="datetime-local" value={form.date} onChange={v => setForm({ ...form, date: v })} />
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <StyledSelect value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
              {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
            </StyledSelect>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Inp({ label, value, onChange, type = 'text' }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" /></div>;
}
