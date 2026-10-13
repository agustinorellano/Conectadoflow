import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldAlert, Mail, Phone, Briefcase, Users2, Send, Megaphone, Trash2, Search, ChevronLeft, ChevronRight, ArrowUpDown, Store, GitBranch, Package, UserPlus, Contact } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Switch } from '@/components/ui/switch';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import DeleteOrganizationModal from '@/components/DeleteOrganizationModal';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency, formatDate } from '@/lib/flowUtils';
import { roleLabel } from '@/lib/roles';

const PAGE_SIZE = 20;
const SORT_OPTIONS = [
  { value: 'created_date', label: 'Fecha de alta' },
  { value: 'name', label: 'Nombre' },
  { value: 'member_count', label: 'Usuarios' },
  { value: 'sales_count', label: 'Ventas' },
  { value: 'total_revenue', label: 'Facturado' },
];

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [orgsTotal, setOrgsTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orgs');
  const [notifyTarget, setNotifyTarget] = useState(null); // { orgId, orgName } | 'broadcast' | null
  const [loadError, setLoadError] = useState('');
  const [deleteOrg, setDeleteOrg] = useState(null);

  // Filtros combinables del listado de organizaciones (Etapa 2).
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [mode, setMode] = useState('');
  const [minUsers, setMinUsers] = useState('');
  const [sort, setSort] = useState('created_date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (user && !user.is_platform_admin) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Debounce: no dispara una query por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

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
        base44.admin.listOrganizations({
          search, industry, mode, minUsers: minUsers ? Number(minUsers) : null,
          sort, sortDir, page, pageSize: PAGE_SIZE,
        }),
        base44.admin.listUsers(),
      ]);
      if (o.status === 'fulfilled') { setOrgs(o.value.rows); setOrgsTotal(o.value.total); } else { setOrgs([]); setOrgsTotal(0); }
      if (u.status === 'fulfilled') setUsers(u.value); else setUsers([]);
      const failed = [o, u].find(r => r.status === 'rejected');
      if (failed) setLoadError(failed.reason?.message || 'No se pudieron cargar los datos');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.is_platform_admin) load(); }, [user, search, industry, mode, minUsers, sort, sortDir, page]);

  const totalPages = Math.max(1, Math.ceil(orgsTotal / PAGE_SIZE));
  const clearFilters = () => { setSearchInput(''); setSearch(''); setIndustry(''); setMode(''); setMinUsers(''); setPage(1); };
  const hasFilters = search || industry || mode || minUsers;

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
        <button onClick={() => setTab('orgs')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'orgs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Organizaciones ({orgsTotal})</button>
        <button onClick={() => setTab('users')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Usuarios ({users.length})</button>
      </div>

      {tab === 'orgs' && (
        <div className="bg-card rounded-2xl border border-border card-shadow p-3 sm:p-4 mb-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Buscar por nombre, email o contacto…"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={industry} onChange={e => { setIndustry(e.target.value); setPage(1); }} placeholder="Rubro"
              className="w-36 px-3 py-2 rounded-lg border border-input bg-background text-xs outline-none focus:ring-2 focus:ring-primary/30" />
            <StyledSelect value={mode} onChange={e => { setMode(e.target.value); setPage(1); }} className="w-40 px-3 py-2 rounded-lg border border-input bg-background text-xs">
              <option value="">Tipo de cuenta (todos)</option>
              <option value="Independiente">Independiente</option>
              <option value="Equipo">Equipo</option>
            </StyledSelect>
            <input type="number" min="0" value={minUsers} onChange={e => { setMinUsers(e.target.value); setPage(1); }} placeholder="Mín. usuarios"
              className="w-32 px-3 py-2 rounded-lg border border-input bg-background text-xs outline-none focus:ring-2 focus:ring-primary/30" />
            <span className="w-px h-6 bg-border mx-1" />
            <StyledSelect value={sort} onChange={e => setSort(e.target.value)} className="w-40 px-3 py-2 rounded-lg border border-input bg-background text-xs">
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </StyledSelect>
            <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground" title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}>
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">Limpiar filtros</button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : tab === 'orgs' ? (
        <div className="space-y-3">
          {orgs.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">{hasFilters ? 'Ninguna organización coincide con estos filtros.' : 'Sin organizaciones aún'}</p>}
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
                    <p className="text-[11px] text-muted-foreground">usuarios</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{o.sales_count}</p>
                    <p className="text-[11px] text-muted-foreground">facturas</p>
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

              <div className="flex items-center gap-4 flex-wrap mt-3 pt-3 border-t border-border/70 text-xs text-muted-foreground">
                <CountPill icon={Store} value={o.commerces_count} label="comercios" />
                <CountPill icon={GitBranch} value={o.branches_count} label="sucursales" />
                <CountPill icon={Package} value={o.products_count} label="productos" />
                <CountPill icon={UserPlus} value={o.leads_count} label="leads" />
                <CountPill icon={Contact} value={o.clients_count} label="clientes" />
              </div>
            </div>
          ))}
          {orgsTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {orgsTotal} organizaciones</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
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

function CountPill({ icon: Icon, value, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="w-3 h-3" /> <span className="font-medium text-foreground">{value ?? 0}</span> {label}
    </span>
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
