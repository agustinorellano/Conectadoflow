import React, { useState, useEffect } from 'react';
import { Users2, Crown, User, Eye, Mail, Plus, MessageCircle, KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import { StyledSelect } from '@/components/ui/styled-select';
import { ROLE_OPTIONS, PERMISSION_MATRIX, roleLabel } from '@/lib/roles';
import { buildWhatsAppUrl, buildMailtoUrl } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const ROLE_ICONS = { admin: Crown, manager: Users2, user: User, viewer: Eye };
const ROLE_COLORS = { admin: 'text-primary', manager: 'text-violet-600', user: 'text-blue-600', viewer: 'text-muted-foreground' };
const ROLE_BADGE_VARIANT = { admin: 'primary', manager: 'violet', user: 'blue', viewer: 'muted' };
const ROLES = ROLE_OPTIONS.map(r => ({ name: r.label, icon: ROLE_ICONS[r.value], color: ROLE_COLORS[r.value], desc: r.desc }));

const ACCESS_LABEL = { full: 'Completo', own: 'Lo propio', read: 'Lectura', none: '—' };
const ACCESS_CLASS = {
  full: 'bg-success/10 text-success',
  own: 'bg-blue-500/10 text-blue-600',
  read: 'bg-secondary text-secondary-foreground',
  none: 'bg-destructive/5 text-muted-foreground',
};

function PermissionMatrixTable() {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow overflow-x-auto no-scrollbar">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left font-medium text-muted-foreground px-4 py-3">Sección</th>
            {ROLE_OPTIONS.map(r => (
              <th key={r.value} className="text-center font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">{r.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MATRIX.map((row, i) => (
            <tr key={row.section} className={i !== PERMISSION_MATRIX.length - 1 ? 'border-b border-border/50' : ''}>
              <td className="px-4 py-2.5 font-medium whitespace-nowrap">{row.section}</td>
              {ROLE_OPTIONS.map(r => (
                <td key={r.value} className="px-3 py-2.5 text-center">
                  <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', ACCESS_CLASS[row[r.value]])}>
                    {ACCESS_LABEL[row[r.value]]}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Team() {
  const { config } = useData();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6">Qué ve cada rol</h2>
          <PermissionMatrixTable />
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
              <>
                <StyledSelect value={u.role || 'user'} onChange={e => changeRole(u, e.target.value)}
                  className="w-auto h-auto px-3 py-1.5 rounded-lg border-0 bg-secondary text-sm font-medium shrink-0">
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </StyledSelect>
                <button onClick={() => setResetUser(u)} title="Restablecer contraseña"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground shrink-0">
                  <KeyRound className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Badge variant={ROLE_BADGE_VARIANT[u.role] || 'muted'} className="shrink-0">{roleLabel(u.role)}</Badge>
            )}
          </div>
        ))}
      </div>
      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Roles y permisos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
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

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Qué ve cada rol</h2>
      <PermissionMatrixTable />

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={load} />
    </div>
  );
}

// Letras/números sin ambiguos (0/O, 1/l/I) — más fácil de leer y tipear
// a mano si el admin se lo dicta o lo manda por WhatsApp.
function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function ResetPasswordModal({ user, onClose }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { if (user) { setPhone(user.phone || ''); setPassword(generatePassword()); setDone(false); setError(''); } }, [user]);

  if (!user) return null;

  const reset = async () => {
    setSaving(true); setError('');
    try {
      await base44.users.resetMemberPassword(user.id, password);
      setDone(true);
    } catch (e) {
      setError(e.message || 'No se pudo restablecer la contraseña');
    } finally { setSaving(false); }
  };

  const credentialsMessage = `Hola! Te renovamos el acceso a Conectado Flow.\n\nEmail: ${user.email}\nContraseña nueva: ${password}\n\nEntrá en ${window.location.origin}/login`;

  return (
    <Modal open={!!user} onClose={onClose} title={done ? 'Contraseña actualizada' : `Restablecer contraseña de ${user.full_name || user.email}`}
      footer={done ? (
        <button onClick={onClose} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Listo</button>
      ) : (
        <><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
          <button onClick={reset} disabled={saving || !password} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Restablecer'}</button></>
      )}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Ya quedó la contraseña nueva. Compartísela a {user.full_name || 'esta persona'}.</p>
          <div className="p-3.5 rounded-xl bg-secondary/60 text-sm space-y-1">
            <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{user.email}</span></p>
            <p><span className="text-muted-foreground">Contraseña:</span> <span className="font-medium font-mono">{password}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={buildWhatsAppUrl(phone, credentialsMessage)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366]/10 text-[#25D366] text-sm font-medium hover:bg-[#25D366]/20">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a href={buildMailtoUrl(user.email, 'Nueva contraseña — Conectado Flow', credentialsMessage)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20">
              <Mail className="w-4 h-4" /> Mail
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nadie puede ver la contraseña actual de {user.full_name || 'esta persona'} — ni vos, ni nosotros, nunca se guarda de forma legible.
            Lo que sí podés hacer es ponerle una nueva y compartírsela.
          </p>
          <div><label className="text-sm font-medium mb-1.5 block">WhatsApp (opcional, para mandarle el acceso)</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11 2345 6789" className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Contraseña nueva</label>
            <div className="flex items-center gap-2">
              <input value={password} onChange={e => setPassword(e.target.value)} className="flex-1 px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30" />
              <button type="button" onClick={() => setPassword(generatePassword())} className="px-3 py-2.5 rounded-xl border border-border text-xs font-medium hover:bg-accent whitespace-nowrap">Generar otra</button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function InviteModal({ open, onClose, onDone }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('user');
  const [password, setPassword] = useState(() => generatePassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // { email, password } una vez creada la cuenta

  const reset = () => {
    setFullName(''); setEmail(''); setPhone(''); setRole('user'); setPassword(generatePassword());
    setCreated(null); setError('');
  };

  const invite = async () => {
    setSaving(true); setError('');
    try {
      await base44.users.inviteUser(email, role, password, fullName || undefined);
      setCreated({ email, password });
      onDone();
    } catch (e) {
      setError(e.message || 'No se pudo crear la cuenta');
    } finally { setSaving(false); }
  };

  const credentialsMessage = created
    ? `Hola! Ya tenés acceso a Conectado Flow.\n\nEmail: ${created.email}\nContraseña: ${created.password}\n\nEntrá en ${window.location.origin}/login — una vez adentro podés cambiar la contraseña desde tu perfil.`
    : '';

  const close = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={close} title={created ? 'Cuenta creada' : 'Invitar miembro'}
      footer={created ? (
        <button onClick={close} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Listo</button>
      ) : (
        <><button onClick={close} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
          <button onClick={invite} disabled={saving || !email || !password} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Creando…' : 'Crear cuenta'}</button></>
      )}>
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La cuenta ya está lista para usarse. Compartile estos datos — por WhatsApp o por mail, lo que te resulte más rápido.
          </p>
          <div className="p-3.5 rounded-xl bg-secondary/60 text-sm space-y-1">
            <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{created.email}</span></p>
            <p><span className="text-muted-foreground">Contraseña:</span> <span className="font-medium font-mono">{created.password}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={buildWhatsAppUrl(phone, credentialsMessage)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366]/10 text-[#25D366] text-sm font-medium hover:bg-[#25D366]/20">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a href={buildMailtoUrl(created.email, 'Acceso a Conectado Flow', credentialsMessage)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20">
              <Mail className="w-4 h-4" /> Mail
            </a>
          </div>
          {!phone && <p className="text-xs text-muted-foreground">Para WhatsApp vas a tener que pegar el número vos — no cargaste uno acá.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div><label className="text-sm font-medium mb-1.5 block">Nombre</label><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre y apellido" className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
          <div><label className="text-sm font-medium mb-1.5 block">WhatsApp (opcional, para mandarle el acceso)</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11 2345 6789" className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Rol</label>
            <StyledSelect value={role} onChange={e => setRole(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </StyledSelect>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Contraseña inicial</label>
            <div className="flex items-center gap-2">
              <input value={password} onChange={e => setPassword(e.target.value)} className="flex-1 px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30" />
              <button type="button" onClick={() => setPassword(generatePassword())} className="px-3 py-2.5 rounded-xl border border-border text-xs font-medium hover:bg-accent whitespace-nowrap">Generar otra</button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Se la vas a compartir vos — la persona puede cambiarla después desde su perfil.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
