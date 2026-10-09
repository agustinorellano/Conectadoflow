import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldAlert, Mail, Phone, Briefcase, Users2, Send, Megaphone, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Switch } from '@/components/ui/switch';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import DeleteOrganizationModal from '@/components/DeleteOrganizationModal';
import { formatCurrency, formatDate } from '@/lib/flowUtils';
import { roleLabel } from '@/lib/roles';

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orgs');
  const [notifyTarget, setNotifyTarget] = useState(null); // { orgId, orgName } | 'broadcast' | null
  const [loadError, setLoadError] = useState('');
  const [deleteOrg, setDeleteOrg] = useState(null);

  useEffect(() => {
    if (user && !user.is_platform_admin) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Antes tragaba cualquier error de admin_list_organizations/admin_list_users
  // (.catch(() => [])) y mostraba 0/0 sin ninguna pista de qué pasó — si la
  // función no estaba autorizada o ni siquiera existía todavía en el caché
  // de PostgREST, quedaba indistinguible de "no hay datos". Ahora se ve el
  // motivo real.
  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [o, u] = await Promise.allSettled([
        base44.admin.listOrganizations(),
        base44.admin.listUsers(),
      ]);
      if (o.status === 'fulfilled') setOrgs(o.value); else setOrgs([]);
      if (u.status === 'fulfilled') setUsers(u.value); else setUsers([]);
      const failed = [o, u].find(r => r.status === 'rejected');
      if (failed) setLoadError(failed.reason?.message || 'No se pudieron cargar los datos');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.is_platform_admin) load(); }, [user]);

  const toggleOrg = async (org) => {
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o));
    try { await base44.admin.setOrganizationActive(org.id, !org.is_active); }
    catch { setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: org.is_active } : o)); }
  };

  if (!user?.is_platform_admin) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel de administración</h1>
        </div>
        <button onClick={() => setNotifyTarget('broadcast')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 shrink-0">
          <Megaphone className="w-4 h-4" /> Notificación masiva
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Organizaciones y usuarios de toda la plataforma Conectado Flow</p>

      {loadError && (
        <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 text-destructive text-sm">
          No se pudieron cargar los datos: {loadError}
        </div>
      )}

      <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-xl w-fit mb-6">
        <button onClick={() => setTab('orgs')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'orgs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Organizaciones ({orgs.length})</button>
        <button onClick={() => setTab('users')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Usuarios ({users.length})</button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : tab === 'orgs' ? (
        <div className="space-y-3">
          {orgs.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sin organizaciones aún</p>}
          {orgs.map(o => (
            <div key={o.id} className="bg-card rounded-2xl border border-border card-shadow p-4">
              <div className="flex items-center gap-4 flex-wrap mb-3">
                <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-[160px]">
                  <p className="font-semibold truncate">{o.name}</p>
                  <p className="text-xs text-muted-foreground">Alta: {formatDate(o.created_date)}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-semibold">{o.member_count}</p>
                    <p className="text-[11px] text-muted-foreground">miembros</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{o.sales_count}</p>
                    <p className="text-[11px] text-muted-foreground">ventas</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{formatCurrency(o.total_revenue, 'ARS')}</p>
                    <p className="text-[11px] text-muted-foreground">facturado</p>
                  </div>
                </div>
                <button onClick={() => setNotifyTarget({ orgId: o.id, orgName: o.name })} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-primary transition-colors shrink-0" title="Enviar notificación">
                  <Send className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteOrg(o)} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" title="Eliminar organización">
                  <Trash2 className="w-4 h-4" />
                </button>
                <Switch checked={o.is_active} onCheckedChange={() => toggleOrg(o)} onLabel="Activa" offLabel="Suspendida" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 pt-3 border-t border-border/70 text-xs">
                <InfoField icon={Briefcase} label="Rubro" value={o.industry || '—'} />
                <InfoField icon={Users2} label="Tipo de cuenta" value={o.mode || '—'} />
                <InfoField icon={Mail} label="Contacto" value={o.admin_email || o.billing_email || '—'} />
                <InfoField icon={Phone} label="Teléfono" value={o.admin_phone || o.billing_phone || '—'} />
              </div>
              {o.admin_name && <p className="text-xs text-muted-foreground mt-2">Admin: {o.admin_name}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sin usuarios aún</p>}
          {users.map(u => (
            <div key={u.id} className="bg-card rounded-2xl border border-border card-shadow p-4 flex items-center gap-4 flex-wrap">
              <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold shrink-0">
                {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-[160px]">
                <p className="font-semibold truncate">{u.full_name || 'Sin nombre'}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="min-w-[140px]">
                <p className="text-sm truncate">{u.organization_name || '— sin organización —'}</p>
                <p className="text-[11px] text-muted-foreground">Alta: {formatDate(u.created_date)}</p>
              </div>
              <Badge variant={u.role === 'admin' ? 'primary' : 'muted'}>{roleLabel(u.role)}</Badge>
            </div>
          ))}
        </div>
      )}

      <NotifyModal target={notifyTarget} onClose={() => setNotifyTarget(null)} />
      <DeleteOrganizationModal org={deleteOrg} onClose={() => setDeleteOrg(null)} onDeleted={load} />
    </div>
  );
}

function InfoField({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground leading-tight">{label}</p>
        <p className="font-medium truncate leading-tight">{value}</p>
      </div>
    </div>
  );
}

function NotifyModal({ target, onClose }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const isBroadcast = target === 'broadcast';
  const open = !!target;

  useEffect(() => {
    if (open) { setTitle(''); setMessage(''); setResult(null); setError(''); }
  }, [open]);

  const send = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true); setError('');
    try {
      const orgId = isBroadcast ? null : target.orgId;
      const count = await base44.admin.sendNotification(orgId, title.trim(), message.trim());
      setResult(count);
    } catch (e) {
      setError(e.message || 'No se pudo enviar');
    } finally { setSending(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBroadcast ? 'Notificación masiva' : `Notificar a ${target?.orgName || ''}`}
      subtitle={isBroadcast ? 'Se envía a todos los usuarios de todas las organizaciones' : 'Se envía a todos los miembros de esta organización'}
      footer={
        result == null ? (
          <>
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
            <button onClick={send} disabled={sending || !title.trim() || !message.trim()} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </>
        ) : (
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Listo</button>
        )
      }
    >
      {result != null ? (
        <p className="text-sm text-center py-4">Notificación enviada a <span className="font-semibold">{result}</span> usuario{result === 1 ? '' : 's'}.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Mantenimiento programado" className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Mensaje</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Escribí el mensaje…" className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
