import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Edit3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { buildWhatsAppUrl, fillTemplate } from '@/lib/flowUtils';
import Modal from '@/components/Modal';

export default function WhatsAppButton({ phone, client, opportunity, stage, compact }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedCat, setSelectedCat] = useState('');

  useEffect(() => {
    if (!open) return;
    base44.entities.MessageTemplate.list().then(setTemplates).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || !client) return;
    // suggest a template based on stage
    const catMap = {
      'Nuevo lead': 'Primer contacto',
      'Contactado': 'Seguimiento',
      'Calificado': 'Seguimiento',
      'Reunión': 'Confirmación de reunión',
      'Propuesta': 'Seguimiento de propuesta',
      'Negociación': 'Seguimiento de propuesta',
      'Ganado': 'Agradecimiento',
    };
    const cat = catMap[stage] || 'Seguimiento';
    setSelectedCat(cat);
    pickTemplate(cat);
  }, [open, stage]);

  const pickTemplate = (cat) => {
    const t = templates.find(t => t.category === cat && t.is_active !== false && (t.channel || 'WhatsApp') === 'WhatsApp');
    const vars = {
      nombre: client?.name?.split(' ')[0] || '',
      empresa: client?.company || '',
      producto: opportunity?.product || opportunity?.title || '',
      monto: opportunity?.amount ? `$${opportunity.amount.toLocaleString('es-AR')}` : '',
      fecha: opportunity?.expected_close_date ? new Date(opportunity.expected_close_date).toLocaleDateString('es-AR') : '',
      vendedor: client?.owner_name || '',
    };
    setMessage(t ? fillTemplate(t.body, vars) : `Hola ${client?.name?.split(' ')[0] || ''}, ¿cómo estás?`);
  };

  useEffect(() => {
    if (open && templates.length > 0 && selectedCat) pickTemplate(selectedCat);
  }, [templates, selectedCat, open]);

  const categories = ['Primer contacto','Seguimiento','Confirmación de reunión','Recordatorio','Envío de propuesta','Seguimiento de propuesta','Cierre','Agradecimiento','Facturación','Recordatorio de pago','Pago vencido','Reactivación','Postventa'];

  const handleSend = () => {
    const url = buildWhatsAppUrl(phone, message);
    window.open(url, '_blank');
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={compact
          ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-medium hover:opacity-90 transition-opacity'
          : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition-opacity'
        }
      >
        <MessageCircle className="w-4 h-4" />
        {!compact && <span>WhatsApp</span>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Enviar WhatsApp"
        subtitle={client?.name}
        footer={
          <>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent transition-colors">Cancelar</button>
            <button onClick={handleSend} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <Send className="w-4 h-4" /> Abrir WhatsApp
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Categoría de mensaje</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <button key={c} onClick={() => { setSelectedCat(c); pickTemplate(c); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${selectedCat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Edit3 className="w-3 h-3" /> Mensaje (editable)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              className="w-full px-3.5 py-3 rounded-xl border border-input bg-background text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Las variables se completan automáticamente. Podés editar el texto antes de enviar.</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
