import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Send, Check, CheckCheck, MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatDateTime } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';
import FloatingChatCard from '@/components/FloatingChatCard';

// Pantalla propia para reportar un problema a Conectado Flow (antes era
// una tarjeta más dentro de Mi Perfil — ahora tiene su propio ítem de
// menú, "Reportar problema", debajo de Configuración). Cualquier usuario
// de la organización puede crear un reporte; el seguimiento (historial,
// cambio de estado) es exclusivo del superadmin desde el panel global —
// un usuario común no ve una lista de reportes anteriores acá a
// propósito. Lo que sí tiene es un chat directo con soporte sobre el
// reporte más reciente de su organización, como tarjeta flotante.
export default function ReportProblem() {
  const { user } = useAuth();
  const [form, setForm] = useState({ title: '', description: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    base44.support.latestReport().then(setActiveReport).catch(() => {});
  }, []);

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSending(true); setError(''); setSent(false);
    try {
      const created = await base44.entities.SupportReport.create({
        title: form.title.trim(), description: form.description.trim(),
        reported_by_id: user?.id, reported_by_name: user?.full_name,
      });
      setForm({ title: '', description: '' });
      setSent(true);
      setActiveReport(created);
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

      {activeReport && (
        <>
          {!chatOpen && (
            <button onClick={() => setChatOpen(true)}
              className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[65] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:opacity-90"
              title="Chatear con soporte">
              <MessageCircle className="w-6 h-6" />
            </button>
          )}
          <FloatingChatCard open={chatOpen} onClose={() => setChatOpen(false)}
            title="Soporte de Conectado Flow" subtitle={activeReport.title}>
            <OrgReportChat reportId={activeReport.id} active={chatOpen} />
          </FloatingChatCard>
        </>
      )}
    </div>
  );
}

// Chat del lado de la organización — mensajes propios a la derecha
// (primary), respuestas del soporte a la izquierda, con confirmación de
// lectura (doble check cuando el soporte ya leyó el mensaje).
function OrgReportChat({ reportId, active }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const bottomRef = useRef(null);

  const load = (markRead = true) => {
    base44.support.listMessages(reportId).then(rows => {
      setMessages(rows);
      if (markRead) base44.support.markMessagesRead(reportId).catch(() => {});
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { if (active) load(); }, [reportId, active]);

  // Mientras el chat está abierto, refresca cada 8s para que las
  // respuestas del soporte y la confirmación de lectura se vean sin
  // tener que cerrar y volver a abrir la tarjeta.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => load(true), 8000);
    return () => clearInterval(id);
  }, [active, reportId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true); setError('');
    try {
      await base44.support.sendMessage(reportId, draft.trim(), user?.full_name);
      setDraft('');
      load(false);
    } catch (e) { setError(e.message || 'No se pudo enviar'); }
    finally { setSending(false); }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <p className="text-xs text-muted-foreground py-2">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Todavía no hay mensajes. Escribí el primero y el equipo de soporte te responde acá.</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className={cn('max-w-[85%] rounded-2xl px-3 py-2', m.is_admin ? 'bg-secondary/60' : 'ml-auto bg-primary text-primary-foreground')}>
              <p className="text-xs font-semibold opacity-80">{m.is_admin ? 'Soporte' : (m.sender_name || 'Vos')}</p>
              <p className="text-sm whitespace-pre-wrap">{m.message}</p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <p className="text-[10px] opacity-60">{formatDateTime(m.created_date)}</p>
                {!m.is_admin && (m.read_at
                  ? <CheckCheck className="w-3 h-3 opacity-80" />
                  : <Check className="w-3 h-3 opacity-60" />)}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 space-y-1.5">
        <div className="flex items-end gap-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2} placeholder="Escribí tu mensaje…"
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
