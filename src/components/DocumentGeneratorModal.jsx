import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Trash2, Eye, Download, Send, Mail, MessageCircle,
  AlertTriangle, History, ArrowLeft, CheckCircle2, XCircle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import { useEntityList } from '@/lib/useEntityQuery';
import {
  DOC_TYPES, OPERATION_TYPES, DEFAULT_DOCUMENT_TEMPLATES,
  fillDocTemplate, missingDocVars, buildDocVars,
} from '@/lib/documentEngine';
import { buildDocumentPdf } from '@/lib/buildDocumentPdf';
import { buildWhatsAppUrl, buildMailtoUrl, formatCurrency, formatDate } from '@/lib/flowUtils';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

const emptyItem = () => ({ description: '', quantity: 1, delivered: '', pending: '', unit_price: '', notes: '' });

const STATUS_VARIANT = { Borrador: 'muted', Generado: 'blue', Enviado: 'success', 'Error de envío': 'destructive', Anulado: 'muted' };

export default function DocumentGeneratorModal({ client, sale, onClose }) {
  const { config } = useData();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const open = !!client;

  const { data: templates = [] } = useEntityList('DocumentTemplate', { enabled: open });
  const { data: history = [] } = useEntityList('ClientDocument', {
    filter: client ? { client_id: client.id } : undefined, sort: '-created_date', enabled: open,
  });

  const [tab, setTab] = useState('new'); // 'new' | 'history'
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [operationType, setOperationType] = useState('B2B');
  const [templateId, setTemplateId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([emptyItem()]);
  const [conditions, setConditions] = useState('');
  const [observations, setObservations] = useState('');
  const [showPrices, setShowPrices] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [issuer, setIssuer] = useState({});
  const [clientData, setClientData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // the created ClientDocument row, once generated

  // First-ever use: no templates exist yet for this org, seed the defaults.
  useEffect(() => {
    if (open && templates.length === 0) {
      base44.entities.DocumentTemplate.bulkCreate(DEFAULT_DOCUMENT_TEMPLATES.map(t => ({ ...t, is_system: true })))
        .then(() => queryClient.invalidateQueries({ queryKey: ['DocumentTemplate'] }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templates.length]);

  useEffect(() => {
    if (!open) return;
    setTab('new');
    setResult(null);
    setError('');
    setOperationType(client.type === 'Empresa' ? 'B2B' : 'B2C');
    setDate(new Date().toISOString().slice(0, 10));
    // Generating from an existing sale: pull its line items as a starting
    // point (already-delivered quantities default to the sold quantity —
    // the user edits them if a partial delivery happened) instead of
    // making the seller retype what was already sold.
    setItems(sale?.items?.length
      ? sale.items.map(it => ({ description: it.description || '', quantity: it.quantity ?? 1, delivered: it.quantity ?? '', pending: 0, unit_price: it.unit_price ?? '', notes: '' }))
      : [emptyItem()]);
    setIssuer({
      company_name: config?.company_name || '', billing_name: config?.billing_name || '',
      billing_tax_id: config?.billing_tax_id || '', billing_address: config?.billing_address || config?.address || '',
      billing_email: config?.billing_email || config?.email || '', billing_phone: config?.billing_phone || config?.phone || '',
      logo_url: config?.logo_url || '',
    });
    setClientData({
      name: client.name || '', company: client.company || '', tax_id: client.tax_id || '',
      address: client.address || '', email: client.email || '', phone: client.phone || '',
    });
  }, [open, client, sale, config]);

  // Template matching this doc_type/operation_type, preferring an exact
  // operation_type match over one marked "Ambos".
  const matchingTemplates = useMemo(() =>
    templates.filter(t => t.doc_type === docType && (t.operation_type === operationType || t.operation_type === 'Ambos')),
    [templates, docType]);

  useEffect(() => {
    if (matchingTemplates.length === 0) { setTemplateId(''); return; }
    const exact = matchingTemplates.find(t => t.operation_type === operationType);
    setTemplateId((exact || matchingTemplates[0]).id);
  }, [matchingTemplates, operationType]);

  const template = templates.find(t => t.id === templateId);

  useEffect(() => {
    if (template) {
      setConditions(template.conditions_text || '');
      setShowPrices(template.show_prices !== false);
      setShowSignature(template.show_signature !== false);
    }
  }, [template]);

  const totalAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0), [items]);
  const currency = sale?.currency || config?.currency || 'ARS';

  const vars = useMemo(() => buildDocVars({
    client: clientData, issuer, documentNumber: null, saleNumber: sale?.number, totalAmount, currency,
  }), [clientData, issuer, totalAmount, currency, sale]);

  const filledIntro = fillDocTemplate(template?.intro_text, vars);
  const filledConditions = fillDocTemplate(conditions, vars);
  const missing = [...missingDocVars(template?.intro_text, vars), ...missingDocVars(conditions, vars)];

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const buildPdfBlob = (documentNumber) => {
    const pdf = buildDocumentPdf({
      doc: { doc_type: docType, document_number: documentNumber, date, observations, total_amount: showPrices ? totalAmount : null },
      issuer, filledIntro, filledConditions, items, showPrices, showSignature, currency,
    });
    return pdf;
  };

  const preview = () => {
    const pdf = buildPdfBlob('(previsualización)');
    const blobUrl = pdf.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  const generate = async () => {
    if (!clientData.name) { setError('Falta el nombre del cliente.'); return; }
    if (items.every(it => !it.description)) { setError('Agregá al menos un producto o servicio.'); return; }
    setError('');
    setSaving(true);
    try {
      const documentNumber = await base44.documents.nextNumber(docType);
      const pdf = buildPdfBlob(documentNumber);
      const blob = pdf.output('blob');
      const { file_uri } = await base44.integrations.Core.UploadPrivateBlob({ blob, filename: `${documentNumber}.pdf` });

      const row = await base44.entities.ClientDocument.create({
        client_id: client.id, sale_id: sale?.id || null, template_id: templateId || null,
        doc_type: docType, operation_type: operationType, document_number: documentNumber,
        status: 'Generado', issuer_snapshot: issuer, client_snapshot: clientData,
        items, conditions: filledConditions, observations, currency,
        total_amount: showPrices ? totalAmount : null, file_uri,
      });
      setResult(row);
      queryClient.invalidateQueries({ queryKey: ['ClientDocument'] });
    } catch (err) {
      setError(err?.message || 'No se pudo generar el documento. Probá de nuevo.');
    } finally { setSaving(false); }
  };

  const markSent = async (channel, to) => {
    if (!result) return;
    await base44.entities.ClientDocument.update(result.id, { status: 'Enviado', sent_channel: channel, sent_to: to, sent_date: new Date().toISOString() });
    setResult(r => ({ ...r, status: 'Enviado', sent_channel: channel, sent_to: to }));
    queryClient.invalidateQueries({ queryKey: ['ClientDocument'] });
  };

  const markSendError = async (message) => {
    setError(message);
    if (!result) return;
    try {
      await base44.entities.ClientDocument.update(result.id, { status: 'Error de envío' });
      setResult(r => ({ ...r, status: 'Error de envío' }));
      queryClient.invalidateQueries({ queryKey: ['ClientDocument'] });
    } catch { /* best-effort status flag — the error message already reached the user */ }
  };

  const sendWhatsApp = async () => {
    if (!result || !client.phone) return;
    setError('');
    try {
      const { signed_url } = await base44.integrations.Core.CreateDocumentSignedUrl({ file_uri: result.file_uri });
      const msg = `Hola ${client.name?.split(' ')[0] || ''}! Te comparto el documento ${result.document_number} (${docType}): ${signed_url}`;
      window.open(buildWhatsAppUrl(client.phone, msg), '_blank');
      await markSent('WhatsApp', client.phone);
    } catch (err) {
      await markSendError(err?.message || 'No se pudo generar el link para enviar por WhatsApp. Probá de nuevo.');
    }
  };

  const sendEmail = async () => {
    if (!result || !client.email) return;
    setError('');
    try {
      const { signed_url } = await base44.integrations.Core.CreateDocumentSignedUrl({ file_uri: result.file_uri });
      const msg = `Hola ${client.name?.split(' ')[0] || ''},\n\nTe compartimos el documento ${result.document_number} (${docType}).\n\nPodés verlo acá: ${signed_url}\n\nSaludos.`;
      window.open(buildMailtoUrl(client.email, `${docType} ${result.document_number}`, msg), '_self');
      await markSent('Email', client.email);
    } catch (err) {
      await markSendError(err?.message || 'No se pudo generar el link para enviar por mail. Probá de nuevo.');
    }
  };

  const downloadHistoryDoc = async (d) => {
    if (!d.file_uri) return;
    const { signed_url } = await base44.integrations.Core.CreateDocumentSignedUrl({ file_uri: d.file_uri });
    window.open(signed_url, '_blank');
  };

  return (
    <Modal open={open} onClose={onClose} title={client ? `Documentos — ${client.name}` : ''}
      subtitle={sale ? `A partir de la venta ${sale.number || ''}` : undefined} size="lg"
      footer={result ? (
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cerrar</button>
          <button onClick={() => downloadHistoryDoc(result)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-accent"><Download className="w-4 h-4" /> Descargar</button>
          {client.phone && <button onClick={sendWhatsApp} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:opacity-90"><MessageCircle className="w-4 h-4" /> WhatsApp</button>}
          {client.email && <button onClick={sendEmail} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Mail className="w-4 h-4" /> Mail</button>}
        </>
      ) : tab === 'new' ? (
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
          <button onClick={preview} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-accent"><Eye className="w-4 h-4" /> Vista previa</button>
          <button onClick={generate} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <FileText className="w-4 h-4" /> {saving ? 'Generando…' : 'Generar documento'}
          </button>
        </>
      ) : (
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cerrar</button>
      )}>
      {!client ? null : result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <p className="text-sm">
              <span className="font-medium">{docType}</span> generado como <span className="font-mono font-medium">{result.document_number}</span>.
              {result.status === 'Enviado' && ` Enviado por ${result.sent_channel} a ${result.sent_to}.`}
            </p>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <XCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {!client.phone && !client.email && (
            <p className="text-xs text-muted-foreground">Este cliente no tiene teléfono ni email cargado, así que no se puede enviar desde acá todavía — podés descargarlo igual.</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit mb-4">
            <button onClick={() => setTab('new')} className={cn('px-3 h-8 rounded-lg text-xs font-medium inline-flex items-center gap-1.5', tab === 'new' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
              <FileText className="w-3.5 h-3.5" /> Nuevo documento
            </button>
            <button onClick={() => setTab('history')} className={cn('px-3 h-8 rounded-lg text-xs font-medium inline-flex items-center gap-1.5', tab === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
              <History className="w-3.5 h-3.5" /> Historial {history.length > 0 ? `(${history.length})` : ''}
            </button>
          </div>

          {tab === 'history' ? (
            <div className="space-y-2">
              {history.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sin documentos generados todavía.</p>}
              {history.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.doc_type} · {d.document_number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(d.created_date)} · {d.operation_type}{d.version > 1 ? ` · v${d.version}` : ''}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[d.status] || 'muted'}>{d.status}</Badge>
                  {d.file_uri && (
                    <button onClick={() => downloadHistoryDoc(d)} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground shrink-0"><Download className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {error && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Tipo de documento</label>
                  <StyledSelect value={docType} onChange={e => setDocType(e.target.value)} className="inp">
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </StyledSelect>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Tipo de operación</label>
                  <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl h-[42px]">
                    {OPERATION_TYPES.map(o => (
                      <button key={o} type="button" onClick={() => setOperationType(o)}
                        className={cn('flex-1 h-full rounded-lg text-xs font-medium', operationType === o ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                        {o === 'B2B' ? 'Empresa (B2B)' : 'Consumidor (B2C)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {matchingTemplates.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Plantilla</label>
                  <StyledSelect value={templateId} onChange={e => setTemplateId(e.target.value)} className="inp">
                    {matchingTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </StyledSelect>
                </div>
              )}

              <Inp label="Fecha" type="date" value={date} onChange={setDate} />

              {missing.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Faltan datos para completar la plantilla: <span className="font-medium text-foreground">{missing.join(', ')}</span>. Completalos abajo (datos de tu empresa o del cliente) o el documento va a mostrar <code>{'{{...}}'}</code> literal en su lugar.
                  </p>
                </div>
              )}

              <details className="group">
                <summary className="text-sm font-medium cursor-pointer select-none mb-2">Datos de la empresa (solo para este documento)</summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input value={issuer.company_name || ''} onChange={e => setIssuer({ ...issuer, company_name: e.target.value })} placeholder="Nombre comercial" className="inp" />
                  <input value={issuer.billing_name || ''} onChange={e => setIssuer({ ...issuer, billing_name: e.target.value })} placeholder="Razón social" className="inp" />
                  <input value={issuer.billing_tax_id || ''} onChange={e => setIssuer({ ...issuer, billing_tax_id: e.target.value })} placeholder="CUIT" className="inp" />
                  <input value={issuer.billing_address || ''} onChange={e => setIssuer({ ...issuer, billing_address: e.target.value })} placeholder="Domicilio" className="inp" />
                  <input value={issuer.billing_email || ''} onChange={e => setIssuer({ ...issuer, billing_email: e.target.value })} placeholder="Email" className="inp" />
                  <input value={issuer.billing_phone || ''} onChange={e => setIssuer({ ...issuer, billing_phone: e.target.value })} placeholder="Teléfono" className="inp" />
                </div>
              </details>

              <details className="group" open>
                <summary className="text-sm font-medium cursor-pointer select-none mb-2">Datos del cliente (solo para este documento)</summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input value={clientData.name || ''} onChange={e => setClientData({ ...clientData, name: e.target.value })} placeholder="Nombre / Razón social *" className="inp" />
                  <input value={clientData.company || ''} onChange={e => setClientData({ ...clientData, company: e.target.value })} placeholder="Empresa" className="inp" />
                  <input value={clientData.tax_id || ''} onChange={e => setClientData({ ...clientData, tax_id: e.target.value })} placeholder="CUIT / DNI" className="inp" />
                  <input value={clientData.address || ''} onChange={e => setClientData({ ...clientData, address: e.target.value })} placeholder="Domicilio" className="inp" />
                  <input value={clientData.email || ''} onChange={e => setClientData({ ...clientData, email: e.target.value })} placeholder="Email" className="inp" />
                  <input value={clientData.phone || ''} onChange={e => setClientData({ ...clientData, phone: e.target.value })} placeholder="Teléfono" className="inp" />
                </div>
              </details>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Productos / servicios</label>
                  <button onClick={addItem} className="text-sm text-primary font-medium inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="p-2.5 rounded-xl border border-border space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Producto o servicio" className="inp flex-1" />
                        {items.length > 1 && <button onClick={() => removeItem(i)} className="w-8 h-8 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      <div className={cn('grid gap-1.5', showPrices ? 'grid-cols-4' : 'grid-cols-3')}>
                        <input type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Cant. acordada" className="inp" />
                        <input type="number" value={it.delivered} onChange={e => updateItem(i, 'delivered', e.target.value)} placeholder="Entregada" className="inp" />
                        <input type="number" value={it.pending} onChange={e => updateItem(i, 'pending', e.target.value)} placeholder="Pendiente" className="inp" />
                        {showPrices && <input type="number" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} placeholder="Precio unit." className="inp" />}
                      </div>
                    </div>
                  ))}
                </div>
                {showPrices && <p className="text-right text-sm font-semibold mt-2">Total: {formatCurrency(totalAmount, currency)}</p>}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={showPrices} onChange={e => setShowPrices(e.target.checked)} className="w-4 h-4 accent-primary" /> Mostrar precios</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={showSignature} onChange={e => setShowSignature(e.target.checked)} className="w-4 h-4 accent-primary" /> Espacio para firma</label>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Condiciones</label>
                <textarea value={conditions} onChange={e => setConditions(e.target.value)} rows={2} className="inp resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Observaciones</label>
                <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} className="inp resize-none" />
              </div>
            </div>
          )}
        </>
      )}
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}

function Inp({ label, value, onChange, type = 'text' }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="inp" /></div>;
}
