import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users2, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Switch } from '@/components/ui/switch';
import Badge from '@/components/Badge';
import { formatCurrency, formatDate } from '@/lib/flowUtils';

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orgs');

  useEffect(() => {
    if (user && !user.is_platform_admin) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const [o, u] = await Promise.all([
        base44.admin.listOrganizations().catch(() => []),
        base44.admin.listUsers().catch(() => []),
      ]);
      setOrgs(o); setUsers(u);
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
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-5 h-5 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel de administración</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Organizaciones y usuarios de toda la plataforma Conectado Flow</p>

      <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-xl w-fit mb-6">
        <button onClick={() => setTab('orgs')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'orgs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Organizaciones ({orgs.length})</button>
        <button onClick={() => setTab('users')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Usuarios ({users.length})</button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : tab === 'orgs' ? (
        <div className="space-y-2">
          {orgs.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sin organizaciones aún</p>}
          {orgs.map(o => (
            <div key={o.id} className="bg-card rounded-2xl border border-border card-shadow p-4 flex items-center gap-4 flex-wrap">
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
              <Switch checked={o.is_active} onCheckedChange={() => toggleOrg(o)} onLabel="Activa" offLabel="Suspendida" />
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
              <Badge variant={u.role === 'admin' ? 'primary' : 'muted'}>{u.role === 'admin' ? 'Administrador' : 'Vendedor'}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
