import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, UserPlus, KanbanSquare, ShoppingCart,
  Wallet, Calendar, MessageCircle, FileText, BarChart3, Users2,
  Settings, Search, Bell, Plus, ChevronLeft, LogOut, X, Sparkles,
  User, ClipboardList, Package, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { cn } from '@/lib/utils';
import GlobalSearch from '@/components/GlobalSearch';
import CommerceSelector from '@/components/CommerceSelector';
import NotificationBell from '@/components/NotificationBell';
import FAB from '@/components/FAB';
import { NAV_ITEMS, NAV_SECTIONS, DEFAULT_HIDDEN_NAV } from '@/lib/navItems';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import Modal from '@/components/Modal';

const MOBILE_NAV = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/leads', label: 'Leads', icon: UserPlus },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const { user, logout } = useAuth();
  const { config, configLoading, updateConfig } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const hiddenNav = config?.hidden_nav || DEFAULT_HIDDEN_NAV;
  const visibleNav = NAV_ITEMS.filter(item => !hiddenNav.includes(item.to));

  useEffect(() => {
    setMobileMenu(false);
    setFabOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === '/onboarding') return;
    // No organization yet (brand-new signup) — always onboard first, config
    // doesn't even exist until the organization does.
    if (user && !user.organization_id) {
      navigate('/onboarding', { replace: true });
      return;
    }
    if (!configLoading && config && !config.onboarded) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, config, configLoading, location.pathname]);

  const handleLogout = () => {
    logout(false);
    navigate('/login');
  };

  if (user && user.organization_id && user.organization_active === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border card-shadow p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="font-semibold text-lg mb-1">Cuenta suspendida</h1>
          <p className="text-sm text-muted-foreground mb-5">Tu organización fue suspendida. Contactá al soporte de Conectado Flow para más información.</p>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-out',
          collapsed ? 'w-[68px]' : 'w-[244px]'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 gap-3 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <svg viewBox="0 0 40 40" className="w-5 h-5" fill="none" stroke="white" strokeWidth="2.4">
              <circle cx="15" cy="20" r="8" />
              <circle cx="25" cy="20" r="8" />
            </svg>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-semibold text-[15px] leading-tight tracking-tight">Conectado</p>
              <p className="text-[13px] text-[#9aa8ff] font-medium leading-tight">Flow</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors',
              collapsed && 'rotate-180'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto thin-scrollbar py-3 px-2.5 space-y-3">
          {NAV_SECTIONS.map(section => {
            const items = visibleNav.filter(item => item.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className="space-y-0.5">
                {!collapsed && (
                  <p className="px-3 pt-1 pb-1 text-[11px] font-semibold text-sidebar-foreground/40 tracking-wide uppercase">{section}</p>
                )}
                {items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 group relative',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-2.5 border-t border-sidebar-border space-y-0.5">
          {user?.is_platform_admin && (
            <NavLink to="/super-admin"
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'
              )}>
              <ShieldAlert className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
              {!collapsed && <span className="truncate">Admin plataforma</span>}
            </NavLink>
          )}
          <div className={cn('flex items-center gap-3 px-2.5 py-2 rounded-xl', !collapsed && 'hover:bg-sidebar-accent transition-colors')}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
              {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="overflow-hidden flex-1">
                  <p className="text-[13px] font-medium truncate">{user?.full_name || 'Usuario'}</p>
                  <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="w-7 h-7 rounded-lg flex items-center justify-center text-sidebar-foreground/60 hover:bg-destructive/20 hover:text-destructive transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
              onClick={() => setMobileMenu(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[260px] bg-sidebar text-sidebar-foreground z-50 md:hidden flex flex-col"
            >
              <div className="h-16 flex items-center px-4 gap-3 border-b border-sidebar-border">
                <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center">
                  <svg viewBox="0 0 40 40" className="w-5 h-5" fill="none" stroke="white" strokeWidth="2.4">
                    <circle cx="15" cy="20" r="8" /><circle cx="25" cy="20" r="8" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[15px] leading-tight">Conectado</p>
                  <p className="text-[13px] text-[#9aa8ff] font-medium leading-tight">Flow</p>
                </div>
                <button onClick={() => setMobileMenu(false)} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center hover:bg-sidebar-accent">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-3">
                {NAV_SECTIONS.map(section => {
                  const items = visibleNav.filter(item => item.section === section);
                  if (items.length === 0) return null;
                  return (
                    <div key={section} className="space-y-0.5">
                      <p className="px-3 pt-1 pb-1 text-[11px] font-semibold text-sidebar-foreground/40 tracking-wide uppercase">{section}</p>
                      {items.map(item => (
                        <NavLink key={item.to} to={item.to} end={item.end}
                          className={({ isActive }) => cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors',
                            isActive ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'
                          )}>
                          <item.icon className="w-[18px] h-[18px]" />
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 sticky top-0 z-30 glass border-b border-border flex items-center px-4 md:px-6 gap-3">
          <button onClick={() => setMobileMenu(true)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 h-10 px-3.5 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/60 text-muted-foreground text-sm transition-colors flex-1 max-w-md"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Buscar clientes, leads, ventas…</span>
            <span className="sm:hidden">Buscar…</span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <CommerceSelector />
            <NotificationBell />
            <button onClick={() => setModeModalOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3 h-9 rounded-xl bg-primary-soft text-primary text-[13px] font-medium hover:bg-primary/20 transition-colors">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{config?.mode === 'Equipo' ? 'Modo Equipo' : 'Modo Independiente'}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0 hover:opacity-90 transition-opacity">
                  {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium truncate">{user?.full_name || 'Usuario'}</p>
                  <p className="text-xs text-muted-foreground font-normal truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" /> Mi perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracion')} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" /> Configuración
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-border flex items-center justify-around h-16 px-2">
        {MOBILE_NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}>
            <item.icon className="w-[20px] h-[20px]" strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <FAB open={fabOpen} setOpen={setFabOpen} />
      <ModeModal open={modeModalOpen} onClose={() => setModeModalOpen(false)} config={config} updateConfig={updateConfig} />
    </div>
  );
}

function ModeModal({ open, onClose, config, updateConfig }) {
  const [mode, setMode] = useState(config?.mode === 'Equipo' ? 'Equipo' : 'Independiente');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMode(config?.mode === 'Equipo' ? 'Equipo' : 'Independiente');
  }, [open, config]);

  const save = async () => {
    if (!config?.id) return;
    setSaving(true);
    try {
      await updateConfig(config.id, { mode });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Modo de trabajo"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || mode === config?.mode} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </>}>
      <div className="space-y-3">
        <button onClick={() => setMode('Independiente')}
          className={cn('w-full text-left p-4 rounded-2xl border-2 transition-colors flex items-start gap-3',
            mode === 'Independiente' ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}>
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><User className="w-5 h-5" /></span>
          <div>
            <p className="font-semibold">Modo Independiente</p>
            <p className="text-sm text-muted-foreground mt-0.5">Gestionás vos solo tus leads, clientes y ventas.</p>
          </div>
        </button>
        <button onClick={() => setMode('Equipo')}
          className={cn('w-full text-left p-4 rounded-2xl border-2 transition-colors flex items-start gap-3',
            mode === 'Equipo' ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}>
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Users2 className="w-5 h-5" /></span>
          <div>
            <p className="font-semibold">Modo Equipo</p>
            <p className="text-sm text-muted-foreground mt-0.5">Trabajás con varios vendedores: podés invitar miembros, asignar leads y ver el rendimiento de cada uno en Equipo.</p>
          </div>
        </button>
      </div>
    </Modal>
  );
}
