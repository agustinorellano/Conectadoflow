import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Search, MoreVertical, ArrowRight, Phone, Mail, Building2, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import WhatsAppButton from '@/components/WhatsAppButton';
import { formatCurrency, formatDate, timeAgo, LEAD_SOURCES } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

const STATUSES = ['Nuevo','Contactado','Calificado','Convertido','Perdido'];

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [convertLead, setConvertLead] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Lead.list('-created_date', 200);
      setLeads(list);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{leads.length} leads · {leads.filter(l => l.status === 'Nuevo').length} nuevos</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <UserPlus className="w-4 h-4" /> Nuevo lead
        </button>
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
            {filtered.map(l => (
              <motion.div key={l.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card rounded-2xl border border-border card-shadow p-4 hover:card-shadow-lg transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center font-semibold shrink-0">
                      {(l.first_name || '?').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{l.first_name} {l.last_name}</p>
                      {l.company && <p className="text-xs text-muted-foreground truncate">{l.company}</p>}
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
                    {l.potential_value ? <p className="text-sm font-semibold">{formatCurrency(l.potential_value)}</p> : <p className="text-xs text-muted-foreground">Sin valor</p>}
                    <p className="text-xs text-muted-foreground">{l.source} · {timeAgo(l.created_date)}</p>
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
            ))}
          </AnimatePresence>
        </div>
      )}

      <LeadForm open={showForm} onClose={() => { setShowForm(false); }} onSaved={load} user={user} />
      <ConvertModal lead={convertLead} onClose={() => setConvertLead(null)} onConverted={(id) => { load(); navigate(`/clientes/${id}`); }} user={user} />
    </div>
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

function LeadForm({ open, onClose, onSaved, user }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', company: '', phone: '', email: '', source: 'WhatsApp', interest: '', potential_value: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.first_name) return;
    setSaving(true);
    try {
      await base44.entities.Lead.create({
        ...form,
        potential_value: Number(form.potential_value) || 0,
        status: 'Nuevo',
        owner_id: user?.id,
        owner_name: user?.full_name,
      });
      setForm({ first_name: '', last_name: '', company: '', phone: '', email: '', source: 'WhatsApp', interest: '', potential_value: '', notes: '' });
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
        <Input label="Valor potencial" value={form.potential_value} onChange={v => setForm({ ...form, potential_value: v })} type="number" />
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Notas</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
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
        potential_value: lead.potential_value || 0,
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
          amount: lead.potential_value || 0,
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
