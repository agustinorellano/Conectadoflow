import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Plus, Edit3, Trash2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { buildWhatsAppUrl, fillTemplate } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Primer contacto','Seguimiento','Confirmación de reunión','Recordatorio','Envío de propuesta','Seguimiento de propuesta','Cierre','Agradecimiento','Facturación','Recordatorio de pago','Pago vencido','Reactivación','Postventa'];

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
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editT, setEditT] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.MessageTemplate.list().catch(() => []);
      if (list.length === 0) {
        await base44.entities.MessageTemplate.bulkCreate(DEFAULT_TEMPLATES);
        setTemplates(await base44.entities.MessageTemplate.list());
      } else {
        setTemplates(list);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const del = async (t) => {
    await base44.entities.MessageTemplate.delete(t.id);
    load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Comunicación</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Plantillas de mensajes y WhatsApp</p>
        </div>
        <button onClick={() => { setEditT(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
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
        </div>
      )}

      <TemplateForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} editT={editT} />
      <PreviewModal template={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function PreviewModal({ template, onClose }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (template) setMsg(fillTemplate(template.body, { nombre: 'Carlos', empresa: 'Acme', producto: 'Servicio Premium', monto: '$500.000', fecha: '15/10', hora: '15:00', vendedor: 'Ana' }));
  }, [template]);
  if (!template) return null;
  const send = () => window.open(buildWhatsAppUrl('+5491100000000', msg), '_blank');
  return (
    <Modal open={!!template} onClose={onClose} title="Probar plantilla" subtitle={template.name}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={send} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:opacity-90"><Send className="w-4 h-4" /> Abrir WhatsApp</button>
      </>}>
      <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={6} className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      <p className="text-xs text-muted-foreground mt-2">Variables: {'{nombre} {empresa} {producto} {monto} {fecha} {hora} {vendedor}'}</p>
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
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
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
