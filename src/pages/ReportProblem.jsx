import React, { useState } from 'react';
import { ShieldAlert, Send, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// Pantalla propia para reportar un problema a Conectado Flow (antes era
// una tarjeta más dentro de Mi Perfil — ahora tiene su propio ítem de
// menú, "Reportar problema", debajo de Configuración). Cualquier usuario
// de la organización puede crear un reporte; el seguimiento (historial,
// cambio de estado, conversación con quien reportó) es exclusivo del
// superadmin desde el panel global — un usuario común no ve una lista de
// reportes anteriores acá a propósito.
export default function ReportProblem() {
  const { user } = useAuth();
  const [form, setForm] = useState({ title: '', description: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

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
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      setError(e.message || 'No se pudo enviar el reporte');
    } finally { setSending(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-6 h-6 text-destructive" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reportar un problema</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Si algo no funciona como esperás en Conectado Flow, contanos acá. Lo recibe directo el equipo de la plataforma.
      </p>

      <div className="bg-card rounded-2xl border border-destructive/30 card-shadow p-5 sm:p-6 space-y-3">
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título del problema"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
          placeholder="Contanos qué pasó, en qué pantalla y qué esperabas que pasara…"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={sending || !form.title.trim() || !form.description.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Send className="w-4 h-4" /> {sending ? 'Enviando…' : 'Enviar reporte'}
          </button>
          {sent && <span className="inline-flex items-center gap-1 text-sm text-success"><Check className="w-4 h-4" /> Enviado, gracias por avisarnos</span>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
