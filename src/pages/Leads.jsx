import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { UserPlus, Search, MoreVertical, ArrowRight, Phone, Mail, Building2, Filter, Upload, FileDown, AlertTriangle, Trash2, Users, PhoneCall, UserCheck, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useEntityList } from '@/lib/useEntityQuery';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import CustomFieldsSection, { useCustomFieldDefinitions } from '@/components/CustomFieldsSection';
import { formatDate, timeAgo, LEAD_SOURCES, normalizePhoneDigits, normalizeEmailLower } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

const STATUSES = ['Nuevo','Contactado','Calificado','Convertido','Perdido'];

// Nivel cualitativo en vez de un monto — más fácil de cargar y de leer
// de un vistazo, con los colores típicos de semáforo (bajo=rojo,
// medio=amarillo, alto=verde).
const POTENTIAL_LEVELS = [
  { value: 'Bajo', variant: 'destructive', dot: 'bg-destructive' },
  { value: 'Medio', variant: 'warning', dot: 'bg-warning' },
  { value: 'Alto', variant: 'success', dot: 'bg-success' },
];

// Same phone/email already in Clientes — the lead is almost certainly the
// same person re-entered (e.g. they wrote in again, or someone forgot an
// existing client was already loaded).
function findDuplicateClient(lead, clients) {
  const leadPhone = normalizePhoneDigits(lead.phone);
  const leadEmail = normalizeEmailLower(lead.email);
  return clients.find(c =>
    (leadPhone && normalizePhoneDigits(c.phone) === leadPhone) ||
    (leadEmail && normalizeEmailLower(c.email) === leadEmail)
  ) || null;
}

export default function Leads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: leads = [], isLoading: loading } = useEntityList('Lead', { sort: '-created_date', limit: 200 });
  // Same cache key Clientes/Ventas already use (sort/limit match) — opening
  // Leads doesn't re-fetch the client list if one of those was open first.
  const { data: clients = [] } = useEntityList('Client', { sort: '-created_date', limit: 200 });
  const { definitions: customDefs } = useCustomFieldDefinitions('Lead');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [convertLead, setConvertLead] = useState(null);
  const [duplicateLead, setDuplicateLead] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['Lead'] });
  const invalidateConversion = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['Client'] });
    queryClient.invalidateQueries({ queryKey: ['Opportunity'] });
  };

  useEffect(() => { if (searchParams.get('new')) setShowForm(true); }, [searchParams]);

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || [l.first_name, l.last_name, l.company, l.email, l.phone].some(v => (v || '').toLowerCase().includes(q));
    const matchS = statusFilter === 'all' || l.status === statusFilter;
    return matchQ && matchS;
  });

  const statusVariant = (s) => ({
    Nuevo: 'muted', Contactado: 'blue', Calificado: 'violet', Convertido: 'success', Perdido: 'destructive'
  }[s] || 'muted');

  const exportExcel = () => {
    const rows = filtered.map(l => ({
      Nombre: l.first_name, Apellido: l.last_name || '', Empresa: l.company || '', Teléfono: l.phone || '',
      Email: l.email || '', Origen: l.source || '', Interés: l.interest || '', Estado: l.status,
      'Valor potencial': l.potential_value || '', 'Último contacto': l.last_contact ? formatDate(l.last_contact) : '',
      'Próxima acción': l.next_action || '',
      ...Object.fromEntries(customDefs.map(d => [d.label, l.custom_fields?.[d.id] ?? ''])),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{leads.length} leads · {leads.filter(l => l.status === 'Nuevo').length} nuevos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent">
            <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button onClick={() => navigate('/importar?entity=Lead')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span>
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <UserPlus className="w-4 h-4" /> Nuevo lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Total" value={leads.length} icon={Users} accent="#465BE8" />
        <KpiCard label="Falta contactar" value={leads.filter(l => l.status === 'Nuevo').length} icon={PhoneCall} accent="#f59e0b" onClick={() => setStatusFilter('Nuevo')} />
        <KpiCard label="En contacto" value={leads.filter(l => l.status === 'Contactado' || l.status === 'Calificado').length} icon={UserCheck} accent="#3b82f6" onClick={() => setStatusFilter('Contactado')} />
        <KpiCard label="Convertidos" value={leads.filter(l => l.status === 'Convertido').length} icon={CheckCircle2} accent="#22c55e" onClick={() => setStatusFilter('Convertido')} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads…"
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todos</FilterChip>
          {STATUSES.map(s => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</FilterChip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserPlus} title="Sin leads" subtitle="Creá tu primer lead para empezar a gestionar tu pipeline comercial."
          action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><UserPlus className="w-4 h-4" /> Nuevo lead</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          <AnimatePresence>
            {filtered.map(l => {
              const dup = findDuplicateClient(l, clients);
              return (
              <motion.div key={l.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className={cn('bg-card rounded-2xl border card-shadow p-4 hover:card-shadow-lg transition-all', dup ? 'border-destructive/40' : 'border-border')}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center font-semibold">
                        {(l.first_name || '?').charAt(0)}
                      </div>
                      {dup && (
                        <button onClick={() => setDuplicateLead(l)} title="Dato duplicado"
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive ring-2 ring-card animate-pulse hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{l.first_name} {l.last_name}</p>
                      {l.company && <p className="text-xs text-muted-foreground truncate">{l.company}</p>}
                      {dup && (
                        <button onClick={() => setDuplicateLead(l)} className="text-[11px] font-medium text-destructive hover:underline">Dato duplicado</button>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusVariant(l.status)} dot>{l.status}</Badge>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                  {l.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {l.phone}</p>}
                  {l.email && <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /> {l.email}</p>}
                  {l.interest && <p className="flex items-center gap-2 truncate"><Building2 className="w-3.5 h-3.5 shrink-0" /> {l.interest}</p>}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    {l.potential_value ? (
                      <Badge variant={POTENTIAL_LEVELS.find(p => p.value === l.potential_value)?.variant} dot>{l.potential_value}</Badge>
                    ) : <p className="text-xs text-muted-foreground">Sin valor</p>}
                    <p className="text-xs text-muted-foreground mt-1">{l.source} · {timeAgo(l.created_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.phone && <WhatsAppButton phone={l.phone} client={{ name: `${l.first_name} ${l.last_name}` }} stage={l.status} compact />}
                    {l.status !== 'Convertido' && (
                      <button onClick={() => setConvertLead(l)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                        Convertir <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <LeadForm open={showForm} onClose={() => { setShowForm(false); }} onSaved={invalidate} user={user} />
      <ConvertModal lead={convertLead} onClose={() => setConvertLead(null)} onConverted={(id) => { invalidateConversion(); navigate(`/clientes/${id}`); }} user={user} />
      <DuplicateLeadModal lead={duplicateLead} client={duplicateLead ? findDuplicateClient(duplicateLead, clients) : null}
        onClose={() => setDuplicateLead(null)} onDeleted={invalidate} />
    </div>
  );
}

function DuplicateLeadModal({ lead, client, onClose, onDeleted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  if (!lead) return null;

  const del = async () => {
    setDeleting(true);
    try {
      await base44.entities.Lead.delete(lead.id);
      onDeleted();
      onClose();
    } finally { setDeleting(false); }
  };

  return (
    <Modal open={!!lead} onClose={onClose} title="Dato duplicado"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">No, dejarlo</button>
        <button onClick={del} disabled={deleting} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Trash2 className="w-4 h-4" /> {deleting ? 'Eliminando…' : 'Eliminar lead'}
        </button>
      </>}>
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm">
            <span className="font-medium">{lead.first_name} {lead.last_name}</span> ya figura como cliente
            {client && <> — <button onClick={() => navigate(`/clientes/${client.id}`)} className="font-medium text-primary hover:underline">{client.name}</button></>}.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Coincide el teléfono o el email con un cliente ya cargado. Probablemente este lead quedó duplicado — podés eliminarlo para mantener la base ordenada, o dejarlo así si en realidad son personas distintas.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick}
      className={cn('px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-accent')}>
      {children}
    </button>
  );
}

const emptyLeadForm = { first_name: '', last_name: '', company: '', phone: '', email: '', source: 'WhatsApp', interest: '', potential_value: '', notes: '', custom_fields: {} };

function LeadForm({ open, onClose, onSaved, user }) {
  const [form, setForm] = useState(emptyLeadForm);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.first_name) return;
    setSaving(true);
    try {
      await base44.entities.Lead.create({
        ...form,
        potential_value: form.potential_value || null,
        status: 'Nuevo',
        owner_id: user?.id,
        owner_name: user?.full_name,
      });
      setForm(emptyLeadForm);
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo lead" subtitle="Capturá un nuevo contacto comercial"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.first_name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre *" value={form.first_name} onChange={v => setForm({ ...form, first_name: v })} />
        <Input label="Apellido" value={form.last_name} onChange={v => setForm({ ...form, last_name: v })} />
        <Input label="Empresa" value={form.company} onChange={v => setForm({ ...form, company: v })} />
        <Input label="Teléfono" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
        <Input label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
        <Select label="Fuente" value={form.source} options={LEAD_SOURCES} onChange={v => setForm({ ...form, source: v })} />
        <Input label="Interés" value={form.interest} onChange={v => setForm({ ...form, interest: v })} />
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Valor potencial</label>
          <div className="flex items-center gap-2">
            {POTENTIAL_LEVELS.map(p => (
              <button key={p.value} type="button" onClick={() => setForm({ ...form, potential_value: form.potential_value === p.value ? '' : p.value })}
                className={cn('inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all',
                  form.potential_value === p.value ? 'border-transparent ring-2 ring-offset-1 ring-current' : 'border-border hover:border-primary/40',
                  form.potential_value === p.value && (p.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : p.variant === 'warning' ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success'))}>
                <span className={cn('w-2 h-2 rounded-full', p.dot)} /> {p.value}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Notas</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <CustomFieldsSection entity="Lead" values={form.custom_fields} onChange={v => setForm({ ...form, custom_fields: v })} />
      </div>
    </Modal>
  );
}

function ConvertModal({ lead, onClose, onConverted, user }) {
  const [saving, setSaving] = useState(false);
  const convert = async () => {
    setSaving(true);
    try {
      const client = await base44.entities.Client.create({
        name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
        company: lead.company || '',
        phone: lead.phone || '',
        email: lead.email || '',
        type: lead.company ? 'Empresa' : 'Consumidor',
        status: 'Activo',
        owner_id: lead.owner_id || user?.id,
        owner_name: lead.owner_name || user?.full_name,
        lead_source: lead.source,
      });
      if (lead.interest || lead.potential_value) {
        await base44.entities.Opportunity.create({
          client_id: client.id,
          client_name: client.name,
          client_company: client.company,
          title: lead.interest || 'Oportunidad inicial',
          product: lead.interest || '',
          amount: 0,
          probability: 20,
          stage: 'Nuevo lead',
          stage_order: 0,
          source: lead.source,
          owner_id: lead.owner_id || user?.id,
          owner_name: lead.owner_name || user?.full_name,
        });
      }
      await base44.entities.Lead.update(lead.id, { status: 'Convertido', converted_client_id: client.id });
      onConverted(client.id);
      onClose();
    } finally { setSaving(false); }
  };
  return (
    <Modal open={!!lead} onClose={onClose} title="Convertir en cliente" subtitle={lead ? `${lead.first_name} ${lead.last_name || ''}` : ''}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={convert} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Convirtiendo…' : 'Convertir'}</button>
      </>}>
      <p className="text-sm text-muted-foreground">Se creará un cliente y una oportunidad inicial asociada. El lead quedará marcado como convertido y conservará su historial.</p>
    </Modal>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      <StyledSelect value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </StyledSelect>
    </div>
  );
}
