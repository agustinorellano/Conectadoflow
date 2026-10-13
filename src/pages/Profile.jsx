import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Lock, Bell, Check, Save, Shield, Mail, Upload, Camera, CalendarDays, RefreshCw, Unlink, ShieldAlert, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Switch } from '@/components/ui/switch';
import { roleLabel } from '@/lib/roles';
import { googleCalendar, getGoogleAuthUrl } from '@/lib/googleCalendar';

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [form, setForm] = useState({ full_name: '', phone: '', position: '', bio: '' });
  const [prefs, setPrefs] = useState({
    email_leads: true, email_meetings: true, email_payments: true,
    push_notifications: false, weekly_summary: true, payment_reminders: true,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name || '', phone: user.phone || '', position: user.position || '', bio: user.bio || '' });
      if (user.preferences) setPrefs(p => ({ ...p, ...user.preferences }));
    }
  }, [user]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await base44.auth.updateMe({ full_name: form.full_name, phone: form.phone, position: form.position, bio: form.bio });
      await checkUserAuth();
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } finally { setSavingProfile(false); }
  };

  const uploadAvatar = async (file) => {
    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      await checkUserAuth();
    } finally { setUploadingAvatar(false); }
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
        <label className="relative shrink-0 cursor-pointer group">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name || 'Foto de perfil'} className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-2xl font-bold">
              {initials}
            </div>
          )}
          <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploadingAvatar ? (
              <span className="text-white text-[10px] font-medium">…</span>
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
        </label>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-lg truncate">{user.full_name || 'Usuario'}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-primary font-medium">
            <Shield className="w-3 h-3" /> {roleLabel(user.role)}
          </span>
        </div>
        <label className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-accent transition-colors cursor-pointer shrink-0">
          <Upload className="w-4 h-4" /> {uploadingAvatar ? 'Subiendo…' : 'Cambiar foto'}
          <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
        </label>
      </div>

      <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Datos personales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nombre completo</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Tu nombre y apellido" className="inp" />
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

      <GoogleCalendarCard />
      <SupportReportCard />

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

// Cada usuario conecta su propia cuenta de Google (calendar_connections
// es 1 fila por user_id, ver 0007_calendar_sync.sql) — por eso vive en el
// perfil personal y no en Configuración, que es por organización.
function GoogleCalendarCard() {
  const [connected, setConnected] = useState(null); // null = cargando
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

  const refresh = () => {
    googleCalendar.isConnected().then(setConnected);
  };

  useEffect(() => { refresh(); }, []);

  const connect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setMessage({ type: 'error', text: 'La integración con Google Calendar todavía no está configurada en este entorno.' });
      return;
    }
    window.location.href = getGoogleAuthUrl();
  };

  const syncNow = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await googleCalendar.pullEvents();
      setMessage({ type: 'success', text: `Listo: ${res.created} reuniones nuevas, ${res.updated} actualizadas.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'No se pudo sincronizar' });
    } finally { setSyncing(false); }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      await googleCalendar.disconnect();
      setConnected(false);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'No se pudo desconectar' });
    } finally { setDisconnecting(false); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Google Calendar</h2>
      <p className="text-sm text-muted-foreground">
        Conectá tu Google Calendar para que las reuniones que creás en Conectado Flow aparezcan ahí, y para traer de vuelta los cambios que hagas directo en Google.
      </p>

      {connected === null ? (
        <p className="text-sm text-muted-foreground">Verificando conexión…</p>
      ) : connected ? (
        <>
          <div className="flex items-center gap-2 text-sm text-success font-medium">
            <Check className="w-4 h-4" /> Conectado
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={syncNow} disabled={syncing} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            <button onClick={disconnect} disabled={disconnecting} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
              <Unlink className="w-4 h-4" /> {disconnecting ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>
        </>
      ) : (
        <button onClick={connect} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <CalendarDays className="w-4 h-4" /> Conectar con Google Calendar
        </button>
      )}

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-success'}`}>{message.text}</p>
      )}
    </div>
  );
}

// Reportar un problema a Conectado Flow (Panel de Administración Global,
// Etapa 5 — ver 0038_support_reports.sql). Cualquier usuario de la
// organización puede crear uno y ver el estado de los que ya mandó —
// cambiar el estado es exclusivo del superadmin, desde el panel global.
function SupportReportCard() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [form, setForm] = useState({ title: '', description: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const loadReports = () => {
    setLoadingReports(true);
    base44.entities.SupportReport.list('-created_date')
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false));
  };

  useEffect(() => { loadReports(); }, []);

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSending(true); setError(''); setSent(false);
    try {
      await base44.entities.SupportReport.create({
        title: form.title.trim(), description: form.description.trim(),
        reported_by_id: user?.id, reported_by_name: user?.full_name,
      });
      setForm({ title: '', description: '' });
      setSent(true);
      loadReports();
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      setError(e.message || 'No se pudo enviar el reporte');
    } finally { setSending(false); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 mb-6 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Reportar un problema</h2>
      <p className="text-sm text-muted-foreground">
        Si algo no funciona como esperás en Conectado Flow, contanos acá. Lo recibe directo el equipo de la plataforma.
      </p>
      <div className="space-y-3">
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título del problema"
          className="inp" />
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
          placeholder="Contanos qué pasó, en qué pantalla y qué esperabas que pasara…" className="inp resize-none" />
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={sending || !form.title.trim() || !form.description.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Send className="w-4 h-4" /> {sending ? 'Enviando…' : 'Enviar reporte'}
          </button>
          {sent && <span className="inline-flex items-center gap-1 text-sm text-success"><Check className="w-4 h-4" /> Enviado</span>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {!loadingReports && reports.length > 0 && (
        <div className="pt-3 border-t border-border/70 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reportes anteriores de tu organización</p>
          {reports.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate flex-1 min-w-0">{r.title}</span>
              <span className={`text-xs font-medium shrink-0 ${r.status === 'Resuelto' ? 'text-success' : r.status === 'En revisión' ? 'text-primary' : 'text-destructive'}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
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
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
