import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageCircle, Plus, Edit3, Trash2, Send, UserPlus, FileText, Wallet, RefreshCw, Info, ChevronLeft, ChevronRight, Mail, FileSignature } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useEntityList } from '@/lib/useEntityQuery';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { StyledSelect } from '@/components/ui/styled-select';
import { buildWhatsAppUrl, buildMailtoUrl, fillTemplate, COMMUNICATION_CHANNELS } from '@/lib/flowUtils';
import { DOC_TYPES, DEFAULT_DOCUMENT_TEMPLATES } from '@/lib/documentEngine';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Primer contacto','Seguimiento','Confirmación de reunión','Recordatorio','Envío de propuesta','Seguimiento de propuesta','Cierre','Agradecimiento','Facturación','Recordatorio de pago','Pago vencido','Reactivación','Postventa'];

// Groups the 13 categories into the stages of the customer journey. Each
// phase is now the page's primary navigation — clicking one goes straight
// to its templates — instead of a row of anchors sitting above a flat list
// of every category at once.
const JOURNEY_PHASES = [
  { key: 'contacto', label: 'Primer contacto', icon: UserPlus, color: '#465BE8', categories: ['Primer contacto'] },
  { key: 'seguimiento', label: 'Seguimiento', icon: MessageCircle, color: '#8b5cf6', categories: ['Seguimiento', 'Confirmación de reunión', 'Recordatorio'] },
  { key: 'propuesta', label: 'Propuesta', icon: FileText, color: '#f59e0b', categories: ['Envío de propuesta', 'Seguimiento de propuesta'] },
  { key: 'pagos', label: 'Pagos', icon: Wallet, color: '#0ea5e9', categories: ['Recordatorio de pago', 'Pago vencido', 'Facturación'] },
  { key: 'postventa', label: 'Post venta', icon: RefreshCw, color: '#22c55e', categories: ['Cierre', 'Agradecimiento', 'Reactivación', 'Postventa'] },
];

const DEFAULT_TEMPLATES = [
  { name: 'Primer contacto', category: 'Primer contacto', body: 'Hola {nombre}, ¿cómo estás? Soy {vendedor} de Conectado. Vi tu interés en {producto} y quería presentarme. ¿Tenés unos minutos para charlar?' },
  { name: 'Seguimiento general', category: 'Seguimiento', body: 'Hola {nombre}, ¿cómo estás? Quería saber si tenés alguna duda sobre {producto} o si avanzamos con la propuesta. Quedo a disposición.' },
  { name: 'Confirmación de reunión', category: 'Confirmación de reunión', body: 'Hola {nombre}, te confirmo nuestra reunión el {fecha} a las {hora}. ¿Te queda bien? Avisame cualquier cambio.' },
  { name: 'Seguimiento de propuesta', category: 'Seguimiento de propuesta', body: 'Hola {nombre}, ¿cómo estás? Quería consultarte si pudiste revisar la propuesta que te enviamos y si tenés alguna duda que podamos resolver.' },
  { name: 'Recordatorio de pago', category: 'Recordatorio de pago', body: 'Hola {nombre}, te recordamos que tenés un pago de {monto} con vencimiento el {fecha}. ¿Podés confirmarnos la transferencia? Gracias!' },
  { name: 'Pago vencido', category: 'Pago vencido', body: 'Hola {nombre}, tu pago de {monto} venció el {fecha}. ¿Podemos ponernos de acuerdo para regularizarlo? Avisame.' },
  { name: 'Agradecimiento post-venta', category: 'Agradecimiento', body: 'Hola {nombre}, ¡muchas gracias por tu compra! Esperamos que disfrutes {producto}. Quedamos a disposición para lo que necesites.' },
];

export default function Communication() {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading: loading } = useEntityList('MessageTemplate');
  const { data: docTemplates = [], isLoading: loadingDocTemplates } = useEntityList('DocumentTemplate');
  const [showForm, setShowForm] = useState(false);
  const [editT, setEditT] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [editDocT, setEditDocT] = useState(null);

  const countFor = (phase) => templates.filter(t => phase.categories.includes(t.category)).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['MessageTemplate'] });
  const invalidateDocT = () => queryClient.invalidateQueries({ queryKey: ['DocumentTemplate'] });

  // First-ever load of this org: no templates exist yet, seed the defaults
  // once so there's something to show.
  useEffect(() => {
    if (!loading && templates.length === 0) {
      base44.entities.MessageTemplate.bulkCreate(DEFAULT_TEMPLATES).then(invalidate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, templates.length]);

  // Same seeding pattern for document templates (also done from the
  // document generator itself, in case this page is never visited —
  // whichever loads first wins, the other's check just finds them already there).
  useEffect(() => {
    if (!loadingDocTemplates && docTemplates.length === 0) {
      base44.entities.DocumentTemplate.bulkCreate(DEFAULT_DOCUMENT_TEMPLATES.map(t => ({ ...t, is_system: true }))).then(invalidateDocT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDocTemplates, docTemplates.length]);

  const del = async (t) => {
    await base44.entities.MessageTemplate.delete(t.id);
    invalidate();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Comunicación</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" /> Elegí una etapa y mandá el mensaje por WhatsApp en un clic.
          </p>
        </div>
        <button onClick={() => { setEditT(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mensajes por WhatsApp / Mail</h2>

      <div className={cn('mb-6', !selectedPhase && 'bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5')}>
        {selectedPhase ? (
          <button onClick={() => setSelectedPhase(null)} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:gap-2 transition-all">
            <ChevronLeft className="w-4 h-4" /> Todas las etapas
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {JOURNEY_PHASES.map(phase => {
              const count = countFor(phase);
              return (
                <button key={phase.key} onClick={() => setSelectedPhase(phase.key)}
                  className="group flex flex-col items-center gap-2 p-4 rounded-2xl border border-border hover:border-current hover:-translate-y-0.5 hover:card-shadow transition-all text-center"
                  style={{ color: phase.color }}>
                  <span className="w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-105" style={{ background: phase.color + '1a' }}>
                    <phase.icon className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{phase.label}</span>
                  <span className="text-xs text-muted-foreground">{count} plantilla{count === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> : !selectedPhase ? (
        <EmptyState icon={MessageCircle} title="Elegí una etapa" subtitle="Tocá una de las etapas de arriba para ver sus plantillas de mensaje." />
      ) : (
        <div className="space-y-6">
          {JOURNEY_PHASES.find(p => p.key === selectedPhase).categories.map(cat => {
            const items = templates.filter(t => t.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(t => (
                    <motion.div key={t.id} layout className="bg-card rounded-2xl border border-border card-shadow p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold">{t.name}</p>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditT(t); setShowForm(true); }} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => del(t)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{t.body}</p>
                      <button onClick={() => setPreview(t)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-medium hover:opacity-90">
                        <MessageCircle className="w-3.5 h-3.5" /> Probar en WhatsApp
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
          {JOURNEY_PHASES.find(p => p.key === selectedPhase).categories.every(cat => templates.filter(t => t.category === cat).length === 0) && (
            <EmptyState icon={MessageCircle} title="Sin plantillas en esta etapa" subtitle="Creá una nueva plantilla y elegí una categoría de esta etapa."
              action={<button onClick={() => { setEditT(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nueva plantilla</button>} />
          )}
        </div>
      )}

      <div className="mt-10 pt-8 border-t border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Modelos de documentos</h2>
        <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1.5">
          <FileSignature className="w-3.5 h-3.5 shrink-0" /> El texto por defecto de cada tipo de documento (constancias, acuerdos, etc.) que se genera desde Clientes. Editalo acá una vez y queda así para todos los clientes — no hace falta rearmarlo cada vez.
        </p>
        {loadingDocTemplates ? <div className="text-center py-10 text-muted-foreground text-sm">Cargando…</div> : (
          <div className="space-y-4">
            {DOC_TYPES.filter(dt => dt !== 'Documento personalizado').map(docType => {
              const items = docTemplates.filter(t => t.doc_type === docType);
              if (items.length === 0) return null;
              return (
                <div key={docType}>
                  <h3 className="text-sm font-semibold mb-2">{docType}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(t => (
                      <div key={t.id} className="bg-card rounded-2xl border border-border card-shadow p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant={t.operation_type === 'B2B' ? 'primary' : t.operation_type === 'B2C' ? 'blue' : 'muted'}>{t.operation_type}</Badge>
                          <button onClick={() => setEditDocT(t)} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">{t.intro_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TemplateForm open={showForm} onClose={() => setShowForm(false)} onSaved={invalidate} editT={editT} />
      <PreviewModal template={preview} onClose={() => setPreview(null)} />
      <DocTemplateForm docT={editDocT} onClose={() => setEditDocT(null)} onSaved={invalidateDocT} />
    </div>
  );
}

function PreviewModal({ template, onClose }) {
  const [msg, setMsg] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [phone, setPhone] = useState('+5491100000000');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  useEffect(() => {
    if (template) {
      setMsg(fillTemplate(template.body, { nombre: 'Carlos', empresa: 'Acme', producto: 'Servicio Premium', monto: '$500.000', fecha: '15/10', hora: '15:00', vendedor: 'Ana' }));
      setSubject(template.name);
      setChannel('WhatsApp');
    }
  }, [template]);
  if (!template) return null;
  const canSend = channel === 'WhatsApp' ? !!phone : !!email;
  const send = () => {
    const url = channel === 'WhatsApp' ? buildWhatsAppUrl(phone, msg) : buildMailtoUrl(email, subject, msg);
    window.open(url, channel === 'WhatsApp' ? '_blank' : '_self');
  };
  return (
    <Modal open={!!template} onClose={onClose} title="Probar plantilla" subtitle={template.name}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={send} disabled={!canSend} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Send className="w-4 h-4" /> {channel === 'WhatsApp' ? 'Abrir WhatsApp' : 'Abrir mail'}
        </button>
      </>}>
      <div className="space-y-3">
        <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit">
          {COMMUNICATION_CHANNELS.map(c => (
            <button key={c} type="button" onClick={() => setChannel(c)}
              className={cn('px-3 h-8 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors', channel === c ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {c === 'WhatsApp' ? <MessageCircle className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />} {c === 'Email' ? 'Mail' : c}
            </button>
          ))}
        </div>
        {channel === 'WhatsApp' ? (
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono de prueba"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Mail de prueba"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        )}
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={6} className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        <p className="text-xs text-muted-foreground">Variables: {'{nombre} {empresa} {producto} {monto} {fecha} {hora} {vendedor}'}</p>
      </div>
    </Modal>
  );
}

function DocTemplateForm({ docT, onClose, onSaved }) {
  const [form, setForm] = useState({ intro_text: '', conditions_text: '', show_prices: true, show_signature: true });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (docT) setForm({ intro_text: docT.intro_text || '', conditions_text: docT.conditions_text || '', show_prices: docT.show_prices !== false, show_signature: docT.show_signature !== false });
  }, [docT]);
  if (!docT) return null;
  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.DocumentTemplate.update(docT.id, form);
      onSaved(); onClose();
    } finally { setSaving(false); }
  };
  return (
    <Modal open={!!docT} onClose={onClose} title={docT.name} subtitle={`${docT.doc_type} · ${docT.operation_type}`}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Introducción</label>
          <textarea value={form.intro_text} onChange={e => setForm({ ...form, intro_text: e.target.value })} rows={4} className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Condiciones</label>
          <textarea value={form.conditions_text} onChange={e => setForm({ ...form, conditions_text: e.target.value })} rows={3} className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.show_prices} onChange={e => setForm({ ...form, show_prices: e.target.checked })} className="w-4 h-4 accent-primary" /> Mostrar precios por defecto</label>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.show_signature} onChange={e => setForm({ ...form, show_signature: e.target.checked })} className="w-4 h-4 accent-primary" /> Espacio para firma por defecto</label>
        </div>
        <p className="text-xs text-muted-foreground">Variables: {'{{nombre_cliente}} {{empresa_cliente}} {{cuit_cliente}} {{nombre_empresa}} {{razon_social_empresa}} {{cuit_empresa}} {{numero_venta}}'} y las demás disponibles al generar el documento.</p>
      </div>
    </Modal>
  );
}

function TemplateForm({ open, onClose, onSaved, editT }) {
  const [form, setForm] = useState({ name: '', category: 'Seguimiento', body: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (editT) setForm({ name: editT.name, category: editT.category, body: editT.body });
    else setForm({ name: '', category: 'Seguimiento', body: '' });
  }, [editT, open]);
  const save = async () => {
    setSaving(true);
    try {
      if (editT) await base44.entities.MessageTemplate.update(editT.id, form);
      else await base44.entities.MessageTemplate.create({ ...form, is_active: true });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={editT ? 'Editar plantilla' : 'Nueva plantilla'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name || !form.body} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <div><label className="text-sm font-medium mb-1.5 block">Nombre</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Categoría</label>
          <StyledSelect value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Mensaje</label>
          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={6} placeholder="Hola {nombre}, ¿cómo estás?…" className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          <p className="text-xs text-muted-foreground mt-1.5">Variables disponibles: {'{nombre} {empresa} {producto} {monto} {fecha} {hora} {vendedor}'}</p>
        </div>
      </div>
    </Modal>
  );
}
