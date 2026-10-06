import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, Clock, Video, Phone, MapPin, MessageCircle, CheckCircle2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { formatDateTime, MEETING_TYPES } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const TYPE_ICONS = { Presencial: MapPin, Videollamada: Video, Teléfono: Phone, WhatsApp: MessageCircle, Otro: Clock };

export default function Meetings() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('upcoming');
  const [searchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([base44.entities.Meeting.list('-date', 200).catch(() => []), base44.entities.Client.list().catch(() => [])]);
      setMeetings(m); setClients(c);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (searchParams.get('new')) setShowForm(true); }, [searchParams]);

  const now = new Date();
  const upcoming = meetings.filter(m => m.status === 'Programada' && new Date(m.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = meetings.filter(m => m.status === 'Realizada' || new Date(m.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));

  const list = tab === 'upcoming' ? upcoming : past;

  const setStatus = async (m, status) => {
    await base44.entities.Meeting.update(m.id, { status });
    load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reuniones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{upcoming.length} próximas · {past.length} realizadas</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva reunión
        </button>
      </div>

      <div className="flex gap-1.5 mb-5">
        <button onClick={() => setTab('upcoming')} className={cn('px-4 py-2 rounded-xl text-sm font-medium', tab === 'upcoming' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-accent')}>Próximas</button>
        <button onClick={() => setTab('past')} className={cn('px-4 py-2 rounded-xl text-sm font-medium', tab === 'past' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-accent')}>Historial</button>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        list.length === 0 ? (
          <EmptyState icon={Calendar} title="Sin reuniones" subtitle="Programá reuniones con tus clientes y mantente al día."
            action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nueva reunión</button>} />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {list.map(m => {
                const Icon = TYPE_ICONS[m.type] || Clock;
                return (
                  <motion.div key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-card rounded-2xl border border-border card-shadow p-4 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{m.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{m.client_name} · {formatDateTime(m.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="primary">{m.type}</Badge>
                      {m.status === 'Programada' && tab === 'upcoming' && (
                        <>
                          <button onClick={() => setStatus(m, 'Realizada')} className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center hover:bg-success/20"><CheckCircle2 className="w-4 h-4" /></button>
                          <button onClick={() => setStatus(m, 'Cancelada')} className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20"><XCircle className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )
      }

      <MeetingForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} clients={clients} user={user} />
    </div>
  );
}

function MeetingForm({ open, onClose, onSaved, clients, user }) {
  const [form, setForm] = useState({ client_id: '', title: '', date: '', type: 'Videollamada', notes: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(f => ({ ...f, client_id: clients[0]?.id || '' })); }, [open, clients]);
  const save = async () => {
    const client = clients.find(c => c.id === form.client_id);
    if (!form.title || !form.date) return;
    setSaving(true);
    try {
      await base44.entities.Meeting.create({
        ...form, date: new Date(form.date).toISOString(), client_id: form.client_id, client_name: client?.name || '',
        status: 'Programada', owner_id: user?.id, owner_name: user?.full_name,
      });
      if (client) await base44.entities.Client.update(client.id, { next_meeting_date: new Date(form.date).toISOString() });
      onSaved(); onClose();
      setForm({ client_id: '', title: '', date: '', type: 'Videollamada', notes: '' });
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nueva reunión"
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.title || !form.date} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Programar'}</button></>}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Cliente</label>
          <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Seleccionar…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Inp label="Título *" value={form.title} onChange={v => setForm({ ...form, title: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Fecha y hora" type="datetime-local" value={form.date} onChange={v => setForm({ ...form, date: v })} />
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30">
              {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
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
