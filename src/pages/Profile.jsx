import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Lock, Bell, Check, Save, Shield, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [form, setForm] = useState({ phone: '', position: '', bio: '' });
  const [prefs, setPrefs] = useState({
    email_leads: true, email_meetings: true, email_payments: true,
    push_notifications: false, weekly_summary: true, payment_reminders: true,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ phone: user.phone || '', position: user.position || '', bio: user.bio || '' });
      if (user.preferences) setPrefs(p => ({ ...p, ...user.preferences }));
    }
  }, [user]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await base44.auth.updateMe({ phone: form.phone, position: form.position, bio: form.bio });
      await checkUserAuth();
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } finally { setSavingProfile(false); }
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      await base44.auth.updateMe({ preferences: prefs });
      await checkUserAuth();
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2000);
    } finally { setSavingPrefs(false); }
  };

  const togglePref = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  if (!user) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;

  const initials = (user.full_name || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[800px] mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Mi Perfil</h1>
      <p className="text-sm text-muted-foreground mb-6">Gestioná tus datos personales y preferencias</p>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-2xl font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-lg truncate">{user.full_name || 'Usuario'}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-primary font-medium">
            <Shield className="w-3 h-3" /> {user.role === 'admin' ? 'Administrador' : 'Usuario'}
          </span>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Datos personales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nombre completo</label>
            <input value={user.full_name || ''} disabled className="inp opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground mt-1">El nombre se asigna al crear la cuenta</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input value={user.email || ''} disabled className="inp opacity-60 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Teléfono</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+54 9 11…" className="inp" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Cargo</label>
            <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Ej: Vendedor, Gerente…" className="inp" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Biografía</label>
          <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Contanos sobre vos…" className="inp resize-none" />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={saveProfile} disabled={savingProfile} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {savingProfile ? 'Guardando…' : <><Save className="w-4 h-4" /> Guardar cambios</>}
          </button>
          {savedProfile && <span className="inline-flex items-center gap-1 text-sm text-success"><Check className="w-4 h-4" /> Guardado</span>}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4" /> Contraseña</h2>
        <p className="text-sm text-muted-foreground">Por seguridad, el cambio de contraseña se realiza mediante el flujo de recuperación por email.</p>
        <Link to="/forgot-password" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-accent transition-colors">
          <Lock className="w-4 h-4" /> Cambiar contraseña
        </Link>
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4" /> Preferencias de notificaciones</h2>
        <div className="space-y-1">
          <PrefRow label="Nuevos leads" desc="Recibir aviso cuando ingresa un nuevo lead" checked={prefs.email_leads} onChange={() => togglePref('email_leads')} />
          <PrefRow label="Recordatorio de reuniones" desc="Notificación antes de cada reunión programada" checked={prefs.email_meetings} onChange={() => togglePref('email_meetings')} />
          <PrefRow label="Alertas de pagos" desc="Avisos de pagos vencidos y cobros realizados" checked={prefs.email_payments} onChange={() => togglePref('email_payments')} />
          <PrefRow label="Resumen semanal" desc="Reporte semanal de actividad y resultados" checked={prefs.weekly_summary} onChange={() => togglePref('weekly_summary')} />
          <PrefRow label="Recordatorios de cobro" desc="Notificaciones de pagos próximos a vencer" checked={prefs.payment_reminders} onChange={() => togglePref('payment_reminders')} />
          <PrefRow label="Notificaciones push" desc="Alertas en el navegador o dispositivo móvil" checked={prefs.push_notifications} onChange={() => togglePref('push_notifications')} />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={savePrefs} disabled={savingPrefs} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {savingPrefs ? 'Guardando…' : <><Save className="w-4 h-4" /> Guardar preferencias</>}
          </button>
          {savedPrefs && <span className="inline-flex items-center gap-1 text-sm text-success"><Check className="w-4 h-4" /> Guardado</span>}
        </div>
      </div>
      <style>{`.inp{width:100%;padding:0.625rem 0.875rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </div>
  );
}

function PrefRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button onClick={onChange} className={cn('relative w-11 h-6 rounded-full transition-colors shrink-0', checked ? 'bg-primary' : 'bg-secondary border border-border')}>
        <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
