import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Users2, Store, GitBranch, Package, Receipt,
  UserPlus, Contact, History, ShieldAlert, Mail, Phone, Briefcase, MessageSquare,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Badge from '@/components/Badge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/flowUtils';
import { roleLabel } from '@/lib/roles';
import { AdminReportChat, ReportStatusSelect } from '@/pages/SuperAdmin';
import SlideOverPanel from '@/components/SlideOverPanel';

// Ficha detallada de una organización dentro del Panel de Administración
// Global (Etapa 3). Cada pestaña trae sus propios datos on-demand — no
// tiene sentido cargar ventas/leads/clientes de la organización si el
// superadmin solo quiere ver el resumen.
const TABS = [
  { key: 'resumen', label: 'Resumen', icon: Building2 },
  { key: 'usuarios', label: 'Usuarios', icon: Users2 },
  { key: 'comercios', label: 'Comercios y sucursales', icon: Store },
  { key: 'productos', label: 'Productos y servicios', icon: Package },
  { key: 'facturacion', label: 'Facturación', icon: Receipt },
  { key: 'contactos', label: 'Contactos y actividad', icon: Contact },
  { key: 'reportes', label: 'Reportes e incidencias', icon: ShieldAlert },
  { key: 'historial', label: 'Historial', icon: History },
];

export default function SuperAdminOrgDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('resumen');

  useEffect(() => {
    if (user && !user.is_platform_admin) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user?.is_platform_admin) return;
    setLoading(true); setError('');
    base44.admin.getOrganization(id)
      .then(data => { if (!data) setError('Organización no encontrada'); setOrg(data); })
      .catch(e => setError(e.message || 'No se pudo cargar la organización'))
      .finally(() => setLoading(false));
  }, [id, user]);

  if (!user?.is_platform_admin) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <Link to="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver al panel
      </Link>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
      ) : (
        <>
          <OrgHeader org={org} />

          <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-accent'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
                {t.key === 'reportes' && org.pending_reports_count > 0 && (
                  <span className="w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">{org.pending_reports_count}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'resumen' && <ResumenTab org={org} />}
          {tab === 'usuarios' && <UsuariosTab orgId={id} />}
          {tab === 'comercios' && <ComerciosTab orgId={id} />}
          {tab === 'productos' && <ProductosTab orgId={id} />}
          {tab === 'facturacion' && <FacturacionTab orgId={id} />}
          {tab === 'contactos' && <ContactosTab orgId={id} />}
          {tab === 'reportes' && <ReportesTab orgId={id} />}
          {tab === 'historial' && <HistorialTab orgId={id} />}
        </>
      )}
    </div>
  );
}

function OrgHeader({ org }) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6">
      <div className="flex items-start gap-4 flex-wrap">
        <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{org.name}</h1>
            <Badge variant={org.is_active ? 'success' : 'destructive'}>{org.is_active ? 'Activa' : 'Suspendida'}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Alta: {formatDate(org.created_date)} · {org.industry || 'Sin rubro registrado'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-5 pt-5 border-t border-border/70">
        <Stat label="Usuarios" value={org.member_count} />
        <Stat label="Comercios" value={org.commerces_count} />
        <Stat label="Sucursales" value={org.branches_count} />
        <Stat label="Productos" value={org.products_count} />
        <Stat label="Leads" value={org.leads_count} />
        <Stat label="Clientes" value={org.clients_count} />
        <Stat label="Facturado" value={formatCurrency(org.total_revenue, org.currency || 'ARS')} />
        <Stat label="Reportes pendientes" value={org.pending_reports_count} alert={org.pending_reports_count > 0} />
      </div>
    </div>
  );
}

function Stat({ label, value, alert }) {
  return (
    <div>
      <p className={`text-lg font-bold leading-tight ${alert ? 'text-destructive' : ''}`}>{value ?? 0}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ResumenTab({ org }) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 space-y-4">
      <h2 className="font-semibold">Información general</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <Field icon={Building2} label="Nombre comercial" value={org.company_name} />
        <Field icon={Briefcase} label="Rubro" value={org.industry} />
        <Field icon={Users2} label="Tipo de cuenta" value={org.mode} />
        <Field icon={Users2} label="Tipo de venta / a quién vende" value={[org.sale_type, org.sell_to].filter(Boolean).join(' · ')} />
        <Field icon={Receipt} label="Moneda" value={org.currency} />
        <Field label="Razón social" value={org.billing_name} />
        <Field label="CUIT/CUIL" value={org.billing_tax_id} />
        <Field label="Condición fiscal" value={org.billing_type} />
        <Field icon={Mail} label="Email de facturación" value={org.billing_email} />
        <Field icon={Phone} label="Teléfono" value={org.billing_phone} />
        <Field label="Dirección fiscal" value={org.billing_address} />
      </div>
      <p className="text-xs text-muted-foreground">Los campos vacíos no están registrados por la organización — no se completan con datos ficticios.</p>
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">{Icon && <Icon className="w-3.5 h-3.5" />} {label}</p>
      <p className="font-medium truncate">{value || <span className="text-muted-foreground font-normal">No registrado</span>}</p>
    </div>
  );
}

function useTabData(fetcher, orgId) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true); setError('');
    fetcher(orgId).then(setData).catch(e => setError(e.message || 'No se pudo cargar')).finally(() => setLoading(false));
  }, [orgId]);
  return { data, loading, error };
}

function TabShell({ loading, error, empty, emptyLabel, children }) {
  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Cargando…</div>;
  if (error) return <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>;
  if (empty) return <div className="text-center py-12 text-muted-foreground text-sm bg-card rounded-2xl border border-border">{emptyLabel}</div>;
  return children;
}

function UsuariosTab({ orgId }) {
  const { data, loading, error } = useTabData(base44.admin.listOrganizationMembers, orgId);
  return (
    <TabShell loading={loading} error={error} empty={data.length === 0} emptyLabel="Esta organización no tiene usuarios registrados.">
      <div className="space-y-2">
        {data.map(u => (
          <div key={u.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
            <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold text-sm shrink-0">
              {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-[160px]">
              <p className="font-medium text-sm truncate">{u.full_name || 'Sin nombre'}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
            </div>
            <p className="text-xs text-muted-foreground">Alta: {formatDate(u.created_date)}</p>
            <Badge variant={u.role === 'admin' ? 'primary' : 'muted'}>{roleLabel(u.role)}</Badge>
          </div>
        ))}
      </div>
    </TabShell>
  );
}

function ComerciosTab({ orgId }) {
  const commerces = useTabData(base44.admin.listOrganizationCommerces, orgId);
  const branches = useTabData(base44.admin.listOrganizationBranches, orgId);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold mb-3 text-sm">Comercios ({commerces.data.length})</h2>
        <TabShell loading={commerces.loading} error={commerces.error} empty={commerces.data.length === 0} emptyLabel="Sin comercios registrados.">
          <div className="space-y-2">
            {commerces.data.map(c => (
              <div key={c.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
                <Store className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.industry || '—'} {c.address ? `· ${c.address}` : ''}</p>
                </div>
                <p className="text-xs text-muted-foreground">{c.branches_count} sucursal{c.branches_count === 1 ? '' : 'es'}</p>
                <Badge variant={c.is_active ? 'success' : 'muted'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge>
              </div>
            ))}
          </div>
        </TabShell>
      </div>
      <div>
        <h2 className="font-semibold mb-3 text-sm">Sucursales ({branches.data.length})</h2>
        <TabShell loading={branches.loading} error={branches.error} empty={branches.data.length === 0} emptyLabel="Sin sucursales registradas.">
          <div className="space-y-2">
            {branches.data.map(b => (
              <div key={b.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
                <GitBranch className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium text-sm truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.commerce_name || '—'} {b.address ? `· ${b.address}` : ''}</p>
                </div>
                <Badge variant={b.is_active ? 'success' : 'muted'}>{b.is_active ? 'Activa' : 'Inactiva'}</Badge>
              </div>
            ))}
          </div>
        </TabShell>
      </div>
    </div>
  );
}

function ProductosTab({ orgId }) {
  const { data, loading, error } = useTabData(base44.admin.listOrganizationProducts, orgId);
  return (
    <TabShell loading={loading} error={error} empty={data.length === 0} emptyLabel="Esta organización no tiene productos ni servicios registrados.">
      <div className="space-y-2">
        {data.map(p => (
          <div key={p.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
            <Package className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-[160px]">
              <p className="font-medium text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">{p.category || '—'} · {p.commerce_name || 'Sin comercio'}</p>
            </div>
            <Badge variant="muted">{p.kind}</Badge>
            <p className="text-sm font-medium">{formatCurrency(p.price, 'ARS')}</p>
          </div>
        ))}
      </div>
    </TabShell>
  );
}

function FacturacionTab({ orgId }) {
  const { data, loading, error } = useTabData(base44.admin.listOrganizationSales, orgId);
  return (
    <TabShell loading={loading} error={error} empty={data.length === 0} emptyLabel="Esta organización no tiene ventas registradas.">
      <div className="space-y-2">
        {data.map(s => (
          <div key={s.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
            <Receipt className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-[160px]">
              <p className="font-medium text-sm truncate">{s.number || '(sin número)'} · {s.client_name || 'Sin cliente'}</p>
              <p className="text-xs text-muted-foreground">{formatDate(s.date)}</p>
            </div>
            {s.arca_status === 'Facturada' && s.arca_cae && <Badge variant="success">CAE {s.arca_cae}</Badge>}
            <Badge variant={s.status === 'Cancelada' ? 'destructive' : 'muted'}>{s.status}</Badge>
            <p className="text-sm font-medium">{formatCurrency(s.total_amount, 'ARS')}</p>
          </div>
        ))}
      </div>
    </TabShell>
  );
}

function ContactosTab({ orgId }) {
  const leads = useTabData(base44.admin.listOrganizationLeads, orgId);
  const clients = useTabData(base44.admin.listOrganizationClients, orgId);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold mb-3 text-sm flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Leads ({leads.data.length})</h2>
        <TabShell loading={leads.loading} error={leads.error} empty={leads.data.length === 0} emptyLabel="Sin leads registrados.">
          <div className="space-y-2">
            {leads.data.map(l => (
              <div key={l.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium text-sm truncate">{l.full_name || '(sin nombre)'}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.company || '—'} · {l.source || '—'}</p>
                </div>
                <Badge variant="muted">{l.status}</Badge>
              </div>
            ))}
          </div>
        </TabShell>
      </div>
      <div>
        <h2 className="font-semibold mb-3 text-sm flex items-center gap-1.5"><Contact className="w-4 h-4" /> Clientes ({clients.data.length})</h2>
        <TabShell loading={clients.loading} error={clients.error} empty={clients.data.length === 0} emptyLabel="Sin clientes registrados.">
          <div className="space-y-2">
            {clients.data.map(c => (
              <div key={c.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.company || '—'}</p>
                </div>
                <Badge variant="muted">{c.status}</Badge>
              </div>
            ))}
          </div>
        </TabShell>
      </div>
    </div>
  );
}

const REPORT_STATUSES = ['Pendiente', 'En revisión', 'Resuelto'];

function ReportesTab({ orgId }) {
  const { data, loading, error } = useTabData(base44.admin.listOrganizationReports, orgId);
  const [items, setItems] = useState(data);
  const [openChat, setOpenChat] = useState(null);
  useEffect(() => { setItems(data); }, [data]);

  const changeStatus = async (report, status) => {
    setItems(prev => prev.map(r => r.id === report.id ? { ...r, status } : r));
    try { await base44.admin.updateReportStatus(report.id, status); }
    catch { setItems(prev => prev.map(r => r.id === report.id ? { ...r, status: report.status } : r)); }
  };

  return (
    <TabShell loading={loading} error={error} empty={items.length === 0} emptyLabel="Esta organización no reportó ningún problema.">
      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id} className="bg-card rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              <ShieldAlert className={`w-4 h-4 shrink-0 ${r.status === 'Pendiente' ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-[160px]">
                <p className="font-medium text-sm truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.reported_by_name || 'Usuario desconocido'} · {formatDateTime(r.created_date)}</p>
              </div>
              <ReportStatusSelect value={r.status} onChange={v => changeStatus(r, v)} />
            </div>
            <p className="text-sm whitespace-pre-wrap pl-7">{r.description}</p>
            {r.resolution_notes && <p className="text-xs text-muted-foreground pl-7 mt-1.5">Notas: {r.resolution_notes}</p>}
            <button onClick={() => setOpenChat(r.id)}
              className="mt-2 ml-7 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
              <MessageSquare className="w-3.5 h-3.5" /> Ver conversación
            </button>
          </div>
        ))}
      </div>
      <SlideOverPanel open={!!openChat} onClose={() => setOpenChat(null)}
        title="Conversación del reporte" subtitle={items.find(r => r.id === openChat)?.title}>
        {openChat && <AdminReportChat reportId={openChat} />}
      </SlideOverPanel>
    </TabShell>
  );
}

function HistorialTab({ orgId }) {
  const { data, loading, error } = useTabData(base44.admin.listOrganizationAuditLog, orgId);
  return (
    <TabShell loading={loading} error={error} empty={data.length === 0} emptyLabel="Sin modificaciones administrativas registradas sobre esta organización.">
      <div className="space-y-2">
        {data.map(a => (
          <div key={a.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 flex-wrap">
            <History className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm font-medium">{a.action}</p>
              <p className="text-xs text-muted-foreground">{a.actor_email}</p>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateTime(a.created_date)}</p>
          </div>
        ))}
      </div>
    </TabShell>
  );
}
