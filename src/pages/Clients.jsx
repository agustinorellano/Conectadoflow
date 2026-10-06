import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Plus, ArrowRight, Building2, Mail, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { formatCurrency, CLIENT_TYPES } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { setClients(await base44.entities.Client.list('-created_date', 200)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (searchParams.get('new')) setShowForm(true); }, [searchParams]);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || [c.name, c.company, c.email, c.phone].some(v => (v || '').toLowerCase().includes(q));
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients.length} clientes</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes…"
          className="w-full pl-10 pr-4 h-11 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        filtered.length === 0 ? (
          <EmptyState icon={Users} title="Sin clientes" subtitle="Convertí leads o creá clientes directamente."
            action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nuevo cliente</button>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            <AnimatePresence>
              {filtered.map(c => (
                <motion.button key={c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="text-left bg-card rounded-2xl border border-border card-shadow p-4 hover:card-shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold shrink-0">
                      {c.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      {c.company && <p className="text-xs text-muted-foreground truncate">{c.company}</p>}
                      <Badge variant={c.status === 'Activo' ? 'success' : 'muted'} className="mt-1">{c.status}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground mb-3">
                    {c.email && <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /> {c.email}</p>}
                    {c.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {c.phone}</p>}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendido</p>
                      <p className="text-sm font-semibold">{formatCurrency(c.total_sold || 0)}</p>
                    </div>
                    {c.balance > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="text-sm font-semibold text-warning">{formatCurrency(c.balance)}</p>
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

      <ClientForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} user={user} />
    </div>
  );
}

export function ClientForm({ open, onClose, onSaved, user, editClient }) {
  const [form, setForm] = useState({ name: '', company: '', tax_id: '', phone: '', email: '', address: '', type: 'Consumidor', segment: '', notes: '', potential_value: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editClient) setForm({ ...editClient, potential_value: editClient.potential_value || '' });
    else setForm({ name: '', company: '', tax_id: '', phone: '', email: '', address: '', type: 'Consumidor', segment: '', notes: '', potential_value: '' });
  }, [editClient, open]);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editClient) {
        await base44.entities.Client.update(editClient.id, { ...form, potential_value: Number(form.potential_value) || 0 });
      } else {
        await base44.entities.Client.create({ ...form, potential_value: Number(form.potential_value) || 0, status: 'Activo', total_sold: 0, total_collected: 0, balance: 0, owner_id: user?.id, owner_name: user?.full_name });
      }
      onSaved?.();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editClient ? 'Editar cliente' : 'Nuevo cliente'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Nombre / Razón social *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="inp" /></Field></div>
        <Field label="Empresa"><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="inp" /></Field>
        <Field label="DNI / CUIT"><input value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} className="inp" /></Field>
        <Field label="Teléfono"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="inp" /></Field>
        <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="inp" /></Field>
        <Field label="Tipo"><StyledSelect value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="inp">{CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}</StyledSelect></Field>
        <Field label="Segmento"><input value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })} className="inp" /></Field>
        <div className="col-span-2"><Field label="Dirección"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="inp" /></Field></div>
        <Field label="Valor potencial"><input type="number" value={form.potential_value} onChange={e => setForm({ ...form, potential_value: e.target.value })} className="inp" /></Field>
        <div className="col-span-2"><Field label="Notas"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="inp resize-none" /></Field></div>
      </div>
      <style>{`.inp{width:100%;padding:0.625rem 0.875rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}

function Field({ label, children }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>{children}</div>;
}
