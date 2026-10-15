import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ShieldAlert, Mail, Phone, Briefcase, Users2, Send, Megaphone, Trash2, Search, ChevronLeft, ChevronRight, ArrowUpDown, Store, GitBranch, Package, UserPlus, Contact, AlertTriangle, ShieldCheck, History, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Switch } from '@/components/ui/switch';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import DeleteOrganizationModal from '@/components/DeleteOrganizationModal';
import SlideOverPanel from '@/components/SlideOverPanel';
import { StyledSelect } from '@/components/ui/styled-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/flowUtils';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const SORT_OPTIONS = [
  { value: 'created_date', label: 'Fecha de alta' },
  { value: 'name', label: 'Nombre' },
  { value: 'member_count', label: 'Usuarios' },
  { value: 'sales_count', label: 'Ventas' },
  { value: 'total_revenue', label: 'Facturado' },
];
const REPORT_STATUSES = ['Pendiente', 'En revisión', 'Resuelto'];
// Un color distinto por estado, para que el selector de estado del
// reporte se reconozca de un vistazo en vez de ser un <select> gris
// genérico — igual que un Badge, pero interactivo.
const REPORT_STATUS_STYLES = {
  'Pendiente': { chip: 'bg-destructive/10 text-destructive', ring: 'focus:ring-destructive/30' },
  'En revisión': { chip: 'bg-warning/15 text-warning', ring: 'focus:ring-warning/30' },
  'Resuelto': { chip: 'bg-success/15 text-success', ring: 'focus:ring-success/30' },
};

// Selector de estado de reporte: cada opción es un chip redondeado con el
// color propio de ese estado (no solo resaltado azul genérico), así se
// distingue de un vistazo cuál está seleccionado y a cuál se puede pasar.
export function ReportStatusSelect({ value, onChange, className }) {
  const style = REPORT_STATUS_STYLES[value] || REPORT_STATUS_STYLES['Pendiente'];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(
        'h-auto w-auto gap-1.5 rounded-full border-0 px-3 py-1.5 text-xs font-medium shadow-none',
        style.chip, style.ring, className
      )}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl p-1.5 min-w-[9rem]">
        {REPORT_STATUSES.map(s => {
          const sStyle = REPORT_STATUS_STYLES[s];
          return (
            <SelectItem key={s} value={s} className={cn(
              'rounded-full pl-3 py-1.5 mb-1 last:mb-0 text-xs font-medium cursor-pointer',
              'data-[state=checked]:font-semibold',
              sStyle.chip
            )}>
              {s}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [orgsTotal, setOrgsTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orgs');
  const [notifyTarget, setNotifyTarget] = useState(null); // { orgIds, label } | 'broadcast' | null
  const [loadError, setLoadError] = useState('');
  const [deleteOrg, setDeleteOrg] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [pendingReports, setPendingReports] = useState(0);

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

  const refreshPendingReports = () => {
    base44.admin.countPendingReports().then(setPendingReports).catch(() => {});
  };
  useEffect(() => { if (user?.is_platform_admin) refreshPendingReports(); }, [user]);

  const totalPages = Math.max(1, Math.ceil(orgsTotal / PAGE_SIZE));
  const clearFilters = () => { setSearchInput(''); setSearch(''); setIndustry(''); setMode(''); setMinUsers(''); setPage(1); };
  const hasFilters = search || industry || mode || minUsers;

  const toggleOrg = async (org) => {
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o));
    try { await base44.admin.setOrganizationActive(org.id, !org.is_active); }
    catch { setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: org.is_active } : o)); }
  };

  const toggleSelected = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allVisibleSelected = orgs.length > 0 && orgs.every(o => selected.has(o.id));
  const toggleSelectAllVisible = () => setSelected(prev => {
    if (allVisibleSelected) {
      const next = new Set(prev);
      orgs.forEach(o => next.delete(o.id));
      return next;
    }
    const next = new Set(prev);
    orgs.forEach(o => next.add(o.id));
    return next;
  });

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
        <button onClick={() => setTab('reportes')} className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'reportes' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
          Reportes
          {pendingReports > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">{pendingReports}</span>
          )}
        </button>
        <button onClick={() => setTab('permisos')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'permisos' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Permisos</button>
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
          <div className="flex items-center gap-2 pt-1 border-t border-border/70">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="rounded" />
              Seleccionar todas las visibles
            </label>
            {selected.size > 0 && (
              <>
                <span className="text-xs text-muted-foreground">· {selected.size} seleccionada{selected.size === 1 ? '' : 's'}</span>
                <button onClick={() => setNotifyTarget({ orgIds: [...selected], label: `${selected.size} organización(es) seleccionada(s)` })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20">
                  <Send className="w-3.5 h-3.5" /> Notificar a selección
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground underline">Limpiar selección</button>
              </>
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
            <div key={o.id} className={`bg-card rounded-2xl border card-shadow p-4 ${selected.has(o.id) ? 'border-primary' : 'border-border'}`}>
              <div className="flex items-center gap-4 flex-wrap mb-3">
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelected(o.id)} className="rounded shrink-0" />
                <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </span>
                <Link to={`/super-admin/organizaciones/${o.id}`} className="flex-1 min-w-[160px] hover:underline">
                  <p className="font-semibold truncate flex items-center gap-1.5">
                    {o.name}
                    {o.pending_reports_count > 0 && (
                      <span title={`${o.pending_reports_count} reporte(s) pendiente(s)`} className="inline-flex items-center gap-1 text-destructive text-[11px] font-semibold">
                        <AlertTriangle className="w-3 h-3" /> {o.pending_reports_count}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Alta: {formatDate(o.created_date)}</p>
                </Link>
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
                <button onClick={() => setNotifyTarget({ orgIds: [o.id], label: o.name })} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-primary transition-colors shrink-0" title="Enviar notificación">
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
      ) : tab === 'users' ? (
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
      ) : tab === 'reportes' ? (
        <ReportsTab onChanged={refreshPendingReports} />
      ) : (
        <PermissionsTab currentUserEmail={user?.email} />
      )}

      <NotifyModal target={notifyTarget} onClose={() => setNotifyTarget(null)} />
      <DeleteOrganizationModal org={deleteOrg} onClose={() => setDeleteOrg(null)} onDeleted={load} />
    </div>
  );
}

// Pestaña "Reportes" del panel global — todas las organizaciones, con
// filtro de estado. La ficha de cada organización (Etapa 3) tiene la
// misma vista acotada a esa organización sola.
function ReportsTab({ onChanged }) {
  const [status, setStatus] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openChat, setOpenChat] = useState(null); // report id | null

  const load = () => {
    setLoading(true); setError('');
    base44.admin.listReports({ status: status || null })
      .then(setReports)
      .catch(e => setError(e.message || 'No se pudieron cargar los reportes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status]);

  const changeStatus = async (report, newStatus) => {
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: newStatus } : r));
    try { await base44.admin.updateReportStatus(report.id, newStatus); onChanged?.(); }
    catch { setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: report.status } : r)); }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <StyledSelect value={status} onChange={e => setStatus(e.target.value)} className="w-44 px-3 py-2 rounded-lg border border-input bg-background text-xs">
          <option value="">Todos los estados</option>
          {REPORT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </StyledSelect>
      </div>
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin reportes{status ? ` en estado "${status}"` : ''}.</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="bg-card rounded-xl border border-border card-shadow p-3.5">
              <div className="flex items-center gap-3 flex-wrap mb-1.5">
                <ShieldAlert className={`w-4 h-4 shrink-0 ${r.status === 'Pendiente' ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  <Link to={`/super-admin/organizaciones/${r.organization_id}`} className="text-xs text-primary hover:underline">{r.organization_name}</Link>
                  <span className="text-xs text-muted-foreground"> · {r.reported_by_name || 'Usuario desconocido'} · {formatDateTime(r.created_date)}</span>
                </div>
                <ReportStatusSelect value={r.status} onChange={v => changeStatus(r, v)} />
              </div>
              <p className="text-sm whitespace-pre-wrap pl-7">{r.description}</p>
              <button onClick={() => setOpenChat(r.id)}
                className="mt-2 ml-7 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                <MessageSquare className="w-3.5 h-3.5" /> Ver conversación
              </button>
            </div>
          ))}
        </div>
      )}
      <SlideOverPanel open={!!openChat} onClose={() => setOpenChat(null)}
        title="Conversación del reporte" subtitle={reports.find(r => r.id === openChat)?.title}>
        {openChat && <AdminReportChat reportId={openChat} />}
      </SlideOverPanel>
    </div>
  );
}

// Chat entre la organización que reportó y el superadmin, sobre un
// reporte puntual. Se usa tanto en la pestaña global de Reportes como en
// la ficha de cada organización (SuperAdminOrgDetail.jsx).
export function AdminReportChat({ reportId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    base44.admin.listReportMessages(reportId).then(setMessages).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [reportId]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true); setError('');
    try {
      await base44.admin.sendReportMessage(reportId, draft.trim());
      setDraft('');
      load();
    } catch (e) { setError(e.message || 'No se pudo enviar'); }
    finally { setSending(false); }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <p className="text-xs text-muted-foreground py-2">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Todavía no hay mensajes. Escribí el primero.</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className={cn('max-w-[85%] rounded-xl px-3 py-2', m.is_admin ? 'ml-auto bg-primary text-primary-foreground' : 'bg-secondary/60')}>
              <p className="text-xs font-semibold opacity-80">{m.sender_name || (m.is_admin ? 'Soporte' : 'Usuario')}</p>
              <p className="text-sm whitespace-pre-wrap">{m.message}</p>
              <p className="text-[10px] opacity-60 mt-0.5">{formatDateTime(m.created_date)}</p>
            </div>
          ))
        )}
      </div>
      <div className="shrink-0 space-y-1.5">
        <div className="flex items-end gap-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="Responder…"
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          <button onClick={send} disabled={sending || !draft.trim()} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0">
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// Pestaña "Permisos" (Etapa 7) — el backend ya existía desde la Etapa 1
// (admin_grant_platform_admin/admin_revoke_platform_admin, auditados y
// con guarda para no dejar la plataforma sin ningún superadmin); esto es
// la UI que faltaba, para no tener que seguir dando de alta por SQL.
function PermissionsTab({ currentUserEmail }) {
  const [admins, setAdmins] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmGrant, setConfirmGrant] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(null); // email | null
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    Promise.all([base44.admin.listPlatformAdmins(), base44.admin.listAuditLog(50)])
      .then(([a, l]) => { setAdmins(a); setAuditLog(l); })
      .catch(e => setError(e.message || 'No se pudo cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grant = async () => {
    setBusy(true); setActionError('');
    try {
      await base44.admin.grantPlatformAdmin(newEmail.trim());
      setNewEmail(''); setConfirmGrant(false);
      load();
    } catch (e) { setActionError(e.message || 'No se pudo otorgar el acceso'); }
    finally { setBusy(false); }
  };

  const revoke = async (email) => {
    setBusy(true); setActionError('');
    try {
      await base44.admin.revokePlatformAdmin(email);
      setConfirmRevoke(null);
      load();
    } catch (e) { setActionError(e.message || 'No se pudo quitar el acceso'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="text-center py-16 text-muted-foreground">Cargando…</div>;
  if (error) return <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border card-shadow p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Superadministradores de la plataforma</h2>
        <p className="text-sm text-muted-foreground">Tienen acceso a este panel global, independiente de cualquier rol dentro de una organización. No se puede quitar al último que queda.</p>

        <div className="space-y-2">
          {admins.map(a => (
            <div key={a.email} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
              <span className="text-sm font-medium truncate">
                {a.email} {a.email === currentUserEmail && <span className="text-xs text-muted-foreground font-normal">(vos)</span>}
              </span>
              <button onClick={() => setConfirmRevoke(a.email)} disabled={admins.length <= 1}
                className="text-xs text-destructive hover:underline disabled:opacity-40 disabled:no-underline shrink-0" title={admins.length <= 1 ? 'No se puede quitar al único superadministrador' : 'Quitar acceso'}>
                Quitar acceso
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-border/70">
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="email@ejemplo.com"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={() => setConfirmGrant(true)} disabled={!newEmail.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0">
            <UserPlus className="w-4 h-4" /> Otorgar acceso
          </button>
        </div>
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Historial de auditoría</h2>
        {auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin acciones administrativas registradas todavía.</p>
        ) : (
          <div className="space-y-2">
            {auditLog.map(a => (
              <div key={a.id} className="py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-muted-foreground">{a.actor_email}</span>
                  {a.target_organization_name && (
                    a.target_organization_id ? (
                      <Link to={`/super-admin/organizaciones/${a.target_organization_id}`} className="text-primary hover:underline text-xs">{a.target_organization_name}</Link>
                    ) : (
                      <span className="text-xs text-muted-foreground" title="La organización ya no existe">{a.target_organization_name} (eliminada)</span>
                    )
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(a.created_date)}</span>
                </div>
                {/* Motivo de baja que el admin completó al eliminar su propia
                    organización desde Configuración (ver DeleteOrganizationModal) —
                    la única forma de verlo es acá, porque la organización ya no existe. */}
                {a.action === 'delete_organization' && a.details?.reason && (
                  <p className="text-xs text-muted-foreground mt-1 pl-0.5">Motivo: <span className="text-foreground">{a.details.reason}</span></p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={confirmGrant} onClose={() => setConfirmGrant(false)} title="Otorgar acceso de superadministrador"
        subtitle={`${newEmail.trim()} va a poder consultar y gestionar TODAS las organizaciones de la plataforma.`}
        footer={<>
          <button onClick={() => setConfirmGrant(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
          <button onClick={grant} disabled={busy} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{busy ? 'Otorgando…' : 'Confirmar'}</button>
        </>}>
        <p className="text-sm text-muted-foreground">Esta acción queda registrada en el historial de auditoría.</p>
      </Modal>

      <Modal open={!!confirmRevoke} onClose={() => setConfirmRevoke(null)} title="Quitar acceso de superadministrador"
        subtitle={confirmRevoke || ''}
        footer={<>
          <button onClick={() => setConfirmRevoke(null)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
          <button onClick={() => revoke(confirmRevoke)} disabled={busy} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{busy ? 'Quitando…' : 'Quitar acceso'}</button>
        </>}>
        <p className="text-sm text-muted-foreground">Esta persona deja de poder acceder al panel global. Queda registrado en el historial de auditoría.</p>
      </Modal>
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

// Flujo de 3 pasos (Etapa 6): redactar -> resumen de alcance (cuántas
// organizaciones/usuarios lo van a recibir, antes de mandar nada) ->
// confirmar. "Notificación masiva" (broadcast) y la fila/selección
// comparten este mismo modal.
function NotifyModal({ target, onClose }) {
  const [step, setStep] = useState('compose'); // compose | review | done
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const isBroadcast = target === 'broadcast';
  const orgIds = isBroadcast ? null : target?.orgIds;
  const open = !!target;

  useEffect(() => {
    if (open) { setStep('compose'); setTitle(''); setMessage(''); setPreview(null); setResult(null); setError(''); }
  }, [open]);

  const goToReview = async () => {
    if (!title.trim() || !message.trim()) return;
    setLoadingPreview(true); setError('');
    try {
      const counts = await base44.admin.countNotificationTargets(orgIds);
      setPreview(counts);
      setStep('review');
    } catch (e) {
      setError(e.message || 'No se pudo calcular el alcance');
    } finally { setLoadingPreview(false); }
  };

  const confirmSend = async () => {
    setSending(true); setError('');
    try {
      const count = await base44.admin.sendNotification(orgIds, title.trim(), message.trim());
      setResult(count);
      setStep('done');
    } catch (e) {
      setError(e.message || 'No se pudo enviar');
    } finally { setSending(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBroadcast ? 'Notificación masiva' : `Notificar a ${target?.label || ''}`}
      subtitle={
        step === 'compose' ? (isBroadcast ? 'Se envía a todos los usuarios de todas las organizaciones' : 'Redactá el mensaje — el alcance se confirma en el próximo paso')
        : step === 'review' ? 'Revisá el alcance antes de confirmar' : undefined
      }
      footer={
        step === 'compose' ? (
          <>
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
            <button onClick={goToReview} disabled={loadingPreview || !title.trim() || !message.trim()} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {loadingPreview ? 'Calculando…' : 'Continuar'}
            </button>
          </>
        ) : step === 'review' ? (
          <>
            <button onClick={() => setStep('compose')} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Volver</button>
            <button onClick={confirmSend} disabled={sending} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {sending ? 'Enviando…' : 'Confirmar envío'}
            </button>
          </>
        ) : (
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Listo</button>
        )
      }
    >
      {step === 'done' ? (
        <p className="text-sm text-center py-4">Notificación creada para <span className="font-semibold">{result}</span> usuario{result === 1 ? '' : 's'}.</p>
      ) : step === 'review' ? (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-secondary/60 space-y-1 text-sm">
            <p>Organizaciones destinatarias: <span className="font-semibold">{preview?.org_count ?? 0}</span></p>
            <p>Usuarios que la van a recibir: <span className="font-semibold">{preview?.user_count ?? 0}</span></p>
          </div>
          <div className="p-3.5 rounded-xl border border-border">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{message}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
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
