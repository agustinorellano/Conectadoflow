import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Upload, Download, File, Image } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

const DOC_TYPES = ['Factura','Presupuesto','Orden de compra','Contrato','Comprobante','Otro'];

export default function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([base44.entities.Document.list('-created_date', 200).catch(() => []), base44.entities.Client.list().catch(() => [])]);
      setDocs(d); setClients(c);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const typeVariant = (t) => ({ Factura: 'primary', Presupuesto: 'amber', Contrato: 'violet', 'Orden de compra': 'cyan', Comprobante: 'success', Otro: 'muted' }[t] || 'muted');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Documentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{docs.length} documentos</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Subir documento
        </button>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        docs.length === 0 ? (
          <EmptyState icon={FileText} title="Sin documentos" subtitle="Subí facturas, presupuestos, contratos y más."
            action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Upload className="w-4 h-4" /> Subir documento</button>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <AnimatePresence>
              {docs.map(d => (
                <motion.div key={d.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-card rounded-2xl border border-border card-shadow p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{d.name}</p>
                      <Badge variant={typeVariant(d.type)} className="mt-1">{d.type}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground mb-3">
                    {d.client_name && <p className="truncate">Cliente: {d.client_name}</p>}
                    {d.date && <p>Fecha: {formatDate(d.date)}</p>}
                    {d.amount && <p className="font-medium text-foreground">{d.amount}</p>}
                  </div>
                  {d.file_uri && <DocDownload doc={d} />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      }
      <DocForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} clients={clients} />
    </div>
  );
}

function DocDownload({ doc }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const get = async () => {
    setLoading(true);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: doc.file_uri });
      setUrl(signed_url);
    } finally { setLoading(false); }
  };
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm font-medium hover:bg-accent">
      <Download className="w-3.5 h-3.5" /> Descargar
    </a>
  ) : (
    <button onClick={get} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm font-medium hover:bg-accent disabled:opacity-50">
      <Download className="w-3.5 h-3.5" /> {loading ? '…' : 'Descargar'}
    </button>
  );
}

function DocForm({ open, onClose, onSaved, clients }) {
  const [form, setForm] = useState({ name: '', type: 'Factura', client_id: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(f => ({ ...f, client_id: clients[0]?.id || '' })); }, [open, clients]);

  const save = async () => {
    if (!file || !form.name) return;
    setSaving(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const client = clients.find(c => c.id === form.client_id);
      await base44.entities.Document.create({
        ...form, file_uri, client_name: client?.name || '',
      });
      onSaved(); onClose();
      setForm({ name: '', type: 'Factura', client_id: '', date: new Date().toISOString().slice(0, 10), notes: '' });
      setFile(null);
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Subir documento"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !file || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Subiendo…' : 'Subir'}</button>
      </>}>
      <div className="space-y-3">
        <Inp label="Nombre *" value={form.name} onChange={v => setForm({ ...form, name: v })} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <StyledSelect value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </StyledSelect>
          </div>
          <Inp label="Fecha" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Cliente</label>
          <StyledSelect value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
            <option value="">Sin cliente</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Archivo (PDF, JPG, PNG)</label>
          <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{file ? file.name : 'Hacé clic para seleccionar'}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setFile(e.target.files[0])} />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function Inp({ label, value, onChange, type = 'text' }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" /></div>;
}
