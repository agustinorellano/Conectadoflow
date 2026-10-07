import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Plus, ArrowRight, Building2, Mail, Phone, LayoutGrid, Rows3, MessageCircle, UserCheck, Wallet, DollarSign, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import { formatCurrency, CLIENT_TYPES } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

// "Estado de situación": a quick-glance standing derived from what we
// already have on the client record (balance + status), each with its
// own default outreach message so it can be sent without opening the
// client detail page.
function getStanding(c) {
  if (c.status === 'Potencial') {
    return { key: 'potencial', label: 'Potencial', variant: 'blue',
      template: `Hola ${c.name?.split(' ')[0] || ''}! Te escribo de nuestra parte para ver si podemos coordinar los próximos pasos y avanzar juntos. ¡Quedo atento!` };
  }
  if (c.status === 'Inactivo') {
    return { key: 'inactivo', label: 'Inactivo', variant: 'muted',
      template: `Hola ${c.name?.split(' ')[0] || ''}! Hace tiempo no hablamos, ¿cómo estás? Quería saber si hay algo en lo que te pueda ayudar.` };
  }
  if (Number(c.balance) > 0) {
    return { key: 'pendiente', label: 'Saldo pendiente', variant: 'warning',
      template: `Hola ${c.name?.split(' ')[0] || ''}! Te escribo para recordarte que tenés un saldo pendiente de ${formatCurrency(c.balance)}. ¿Podemos coordinar el pago?` };
  }
  return { key: 'al_dia', label: 'Al día', variant: 'success',
    template: `Hola ${c.name?.split(' ')[0] || ''}! Quería saludarte y ver cómo va todo. ¡Cualquier cosa estamos para ayudarte!` };
}

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState('cards');
  const [messageClient, setMessageClient] = useState(null);
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

  const kpis = {
    total: clients.length,
    activos: clients.filter(c => c.status === 'Activo').length,
    conSaldo: clients.filter(c => Number(c.balance) > 0).length,
    totalVendido: clients.reduce((s, c) => s + (Number(c.total_sold) || 0), 0),
  };

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Total de clientes" value={kpis.total} icon={Users} accent="#465BE8" />
        <KpiCard label="Activos" value={kpis.activos} icon={UserCheck} accent="#22c55e" />
        <KpiCard label="Con saldo pendiente" value={kpis.conSaldo} icon={Wallet} accent="#f59e0b" />
        <KpiCard label="Total vendido" value={formatCurrency(kpis.totalVendido)} icon={DollarSign} accent="#0ea5e9" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes…"
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit shrink-0">
          <button onClick={() => setViewMode('cards')} className={cn('px-3 h-9 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors', viewMode === 'cards' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutGrid className="w-3.5 h-3.5" /> Tarjetas
          </button>
          <button onClick={() => setViewMode('rows')} className={cn('px-3 h-9 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors', viewMode === 'rows' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Rows3 className="w-3.5 h-3.5" /> Filas
          </button>
        </div>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        filtered.length === 0 ? (
          <EmptyState icon={Users} title="Sin clientes" subtitle="Convertí leads o creá clientes directamente."
            action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nuevo cliente</button>} />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            <AnimatePresence>
              {filtered.map(c => {
                const standing = getStanding(c);
                return (
                  <motion.div key={c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    className="cursor-pointer text-left bg-card rounded-2xl border border-border card-shadow p-4 hover:card-shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold shrink-0">
                        {c.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{c.name}</p>
                        {c.company && <p className="text-xs text-muted-foreground truncate">{c.company}</p>}
                        <Badge variant={standing.variant} className="mt-1">{standing.label}</Badge>
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
                      {c.phone && (
                        <button onClick={(e) => { e.stopPropagation(); setMessageClient(c); }}
                          className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 ml-2">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground ml-2" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border card-shadow overflow-hidden">
            <AnimatePresence>
              {filtered.map((c, i) => {
                const standing = getStanding(c);
                return (
                  <motion.div key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    className={cn('cursor-pointer flex items-center gap-3 p-3 sm:p-4 hover:bg-accent/50 transition-colors', i !== filtered.length - 1 && 'border-b border-border')}>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold shrink-0 text-sm">
                      {c.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.company || c.email || c.phone || '—'}</p>
                    </div>
                    <Badge variant={standing.variant} className="shrink-0 hidden sm:inline-flex">{standing.label}</Badge>
                    <div className="text-right shrink-0 hidden md:block">
                      <p className="text-xs text-muted-foreground">Vendido</p>
                      <p className="text-sm font-semibold">{formatCurrency(c.total_sold || 0)}</p>
                    </div>
                    {c.balance > 0 && (
                      <div className="text-right shrink-0 hidden lg:block">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="text-sm font-semibold text-warning">{formatCurrency(c.balance)}</p>
                      </div>
                    )}
                    {c.phone && (
                      <button onClick={(e) => { e.stopPropagation(); setMessageClient(c); }}
                        className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      <ClientForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} user={user} />
      <ClientMessageModal client={messageClient} onClose={() => setMessageClient(null)} />
    </div>
  );
}

function ClientMessageModal({ client, onClose }) {
  const [text, setText] = useState('');
  const standing = client ? getStanding(client) : null;

  useEffect(() => { if (client) setText(getStanding(client).template); }, [client]);

  const send = () => {
    if (!client?.phone) return;
    const phone = client.phone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    onClose();
  };

  return (
    <Modal open={!!client} onClose={onClose} title={client ? `Mensaje a ${client.name}` : ''}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={send} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success text-white text-sm font-medium hover:opacity-90">
          <Send className="w-4 h-4" /> Enviar por WhatsApp
        </button>
      </>}>
      {client && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={standing.variant}>{standing.label}</Badge>
            <span className="text-xs text-muted-foreground">{client.phone}</span>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Mensaje (podés personalizarlo)</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
          </div>
        </div>
      )}
    </Modal>
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
