import React, { useState, useEffect } from 'react';
import { Users2, Crown, User, Eye, Mail, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import { StyledSelect } from '@/components/ui/styled-select';
import { ROLE_OPTIONS, roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';

const ROLE_ICONS = { admin: Crown, manager: Users2, user: User, viewer: Eye };
const ROLE_COLORS = { admin: 'text-primary', manager: 'text-violet-600', user: 'text-blue-600', viewer: 'text-muted-foreground' };
const ROLE_BADGE_VARIANT = { admin: 'primary', manager: 'violet', user: 'blue', viewer: 'muted' };
const ROLES = ROLE_OPTIONS.map(r => ({ name: r.label, icon: ROLE_ICONS[r.value], color: ROLE_COLORS[r.value], desc: r.desc }));

export default function Team() {
  const { config } = useData();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const isAdmin = me?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try { setUsers(await base44.entities.User.list().catch(() => [])); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (u, role) => {
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x));
    await base44.entities.User.update(u.id, { role });
  };

  if (config?.mode === 'Independiente') {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[800px] mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Equipo</h1>
        <p className="text-sm text-muted-foreground mb-6">Estás en modo independiente</p>
        <EmptyState icon={Users2} title="Modo independiente" subtitle="Para gestionar un equipo con varios vendedores, cambiá a modo equipo en Configuración."
          action={<button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Invitar vendedor</button>} />
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Roles disponibles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.map(r => (
              <div key={r.name} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <r.icon className={cn('w-5 h-5', r.color)} />
                  <p className="font-semibold">{r.name}</p>
                </div>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={load} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} miembros</p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Invitar miembro
        </button>
      </div>

      <div className="space-y-2 mb-8">
        {users.map(u => (
          <div key={u.id} className="bg-card rounded-2xl border border-border card-shadow p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold shrink-0">
              {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{u.full_name || 'Sin nombre'}</p>
              <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5"><Mail className="w-3 h-3" /> {u.email}</p>
            </div>
            {isAdmin ? (
              <StyledSelect value={u.role || 'user'} onChange={e => changeRole(u, e.target.value)}
                className="w-auto h-auto px-3 py-1.5 rounded-lg border-0 bg-secondary text-sm font-medium shrink-0">
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </StyledSelect>
            ) : (
              <Badge variant={ROLE_BADGE_VARIANT[u.role] || 'muted'} className="shrink-0">{roleLabel(u.role)}</Badge>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Roles y permisos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ROLES.map(r => (
          <div key={r.name} className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <r.icon className={cn('w-5 h-5', r.color)} />
              <p className="font-semibold">{r.name}</p>
            </div>
            <p className="text-sm text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={load} />
    </div>
  );
}

function InviteModal({ open, onClose, onDone }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const invite = async () => {
    setSaving(true); setError('');
    try {
      await base44.users.inviteUser(email, role);
      setEmail(''); onDone(); onClose();
    } catch (e) {
      setError(e.message || 'No se pudo invitar');
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Invitar miembro"
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={invite} disabled={saving || !email} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Enviando…' : 'Enviar invitación'}</button></>}>
      <div className="space-y-3">
        <div><label className="text-sm font-medium mb-1.5 block">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Rol</label>
          <StyledSelect value={role} onChange={e => setRole(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </StyledSelect>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}
