import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Users, Search, Plus, ArrowRight, Building2, Mail, Phone, LayoutGrid, Rows3, MessageCircle, UserCheck, Wallet, DollarSign, Send, Clock, ChevronLeft, ChevronRight, Package, FileText, Upload, FileDown, AlertTriangle, Trash2 } from 'lucide-react';
import DocumentGeneratorModal from '@/components/DocumentGeneratorModal';
import CustomFieldsSection, { useCustomFieldDefinitions } from '@/components/CustomFieldsSection';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useEntityList } from '@/lib/useEntityQuery';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import { formatCurrency, formatDateShort, CLIENT_TYPES, CLIENT_PRIORITIES, SITUATION_PRIORITY_SUGGESTION, COMMUNICATION_CHANNELS, buildWhatsAppUrl, buildMailtoUrl, normalizePhoneDigits, normalizeEmailLower } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

// "Estado de situación": a relationship stage the user sets and changes
// themselves (not derived from balance/status), each with its own default
// outreach message. Editable inline from the Clientes list, no need to
// open the client detail page.
// `c.top_product` (injected from the client's purchase history — see
// topProductByClient in Clients()) lets each template mention what this
// client actually buys, instead of a generic line, without the seller
// having to remember or look it up before writing.
const SITUATION_STAGES = [
  { key: 'Primer contacto', variant: 'blue',
    template: (c) => `Hola ${c.name?.split(' ')[0] || ''}! Un gusto contactarte. Quería presentarme y ver en qué te podemos ayudar.` },
  { key: 'Seguimiento', variant: 'violet',
    template: (c) => `Hola ${c.name?.split(' ')[0] || ''}! Te escribo para hacer un seguimiento${c.top_product ? ` sobre ${c.top_product}` : ''} y ver si tenés alguna consulta o si podemos avanzar con algo.` },
  { key: 'Propuesta enviada', variant: 'amber',
    template: (c) => `Hola ${c.name?.split(' ')[0] || ''}! Quería saber si pudiste revisar la propuesta que te enviamos. ¡Quedo atento a tus comentarios!` },
  { key: 'Cliente activo', variant: 'success',
    template: (c) => `Hola ${c.name?.split(' ')[0] || ''}! Quería saludarte y ver cómo va todo${c.top_product ? ` con ${c.top_product}` : ''}. ¡Cualquier cosa estamos para ayudarte!` },
  { key: 'Saldo pendiente', variant: 'warning',
    template: (c) => `Hola ${c.name?.split(' ')[0] || ''}! Te escribo para recordarte que tenés un saldo pendiente de ${formatCurrency(c.balance)}. ¿Podemos coordinar el pago?` },
  { key: 'Inactivo', variant: 'muted',
    template: (c) => `Hola ${c.name?.split(' ')[0] || ''}! Hace tiempo no hablamos, ¿cómo estás?${c.top_product ? ` La última vez te interesó ${c.top_product} —` : ''} Quería saber si hay algo en lo que te pueda ayudar.` },
];

function getStanding(c) {
  const stage = SITUATION_STAGES.find(s => s.key === c.situation_status) || SITUATION_STAGES[0];
  return { key: stage.key, label: stage.key, variant: stage.variant, template: stage.template(c) };
}

const PAGE_SIZE = 24;

export default function Clients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: clients = [], isLoading: loading } = useEntityList('Client', { sort: '-created_date', limit: 200 });
  // Shares its cache key with Ventas (same sort/limit) — opening Clientes
  // after Ventas doesn't re-fetch sales again.
  const { data: sales = [] } = useEntityList('Sale', { sort: '-date', limit: 200 });
  const { definitions: customDefs } = useCustomFieldDefinitions('Client');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState('rows');
  const [messageClient, setMessageClient] = useState(null);
  const [messageChannel, setMessageChannel] = useState('WhatsApp');
  const openMessage = (c, ch) => { setMessageClient(c); setMessageChannel(ch); };
  const [docClient, setDocClient] = useState(null);
  const [duplicateClient, setDuplicateClient] = useState(null);
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['Client'] });

  // Cambiar el estado de situación también sugiere una prioridad acorde
  // (ej: "Saldo pendiente" -> Urgente) — la prioridad sigue siendo
  // editable aparte en cualquier momento hasta el próximo cambio de estado.
  const updateSituation = async (client, situation_status) => {
    const priority = SITUATION_PRIORITY_SUGGESTION[situation_status] || client.priority;
    queryClient.setQueryData(['Client', 'list', { filter: undefined, sort: '-created_date', limit: 200 }],
      (prev) => (prev || []).map(c => c.id === client.id ? { ...c, situation_status, priority } : c));
    await base44.entities.Client.update(client.id, { situation_status, priority });
  };

  useEffect(() => { if (searchParams.get('new')) setShowForm(true); }, [searchParams]);
  useEffect(() => { setPage(1); }, [search]);

  // What each client actually buys: units per product across their
  // non-cancelled sales, so a seller can see or mention it before even
  // opening the chat, instead of having to dig through Ventas first.
  const topProductByClient = useMemo(() => {
    const byClient = {};
    sales.filter(s => s.status !== 'Cancelada' && s.client_id).forEach(s => {
      const units = byClient[s.client_id] || (byClient[s.client_id] = {});
      (s.items || []).forEach(it => {
        const name = it.description || 'Sin nombre';
        units[name] = (units[name] || 0) + (Number(it.quantity) || 0);
      });
    });
    const top = {};
    Object.entries(byClient).forEach(([clientId, units]) => {
      const sorted = Object.entries(units).sort((a, b) => b[1] - a[1]);
      if (sorted.length) top[clientId] = { name: sorted[0][0], count: sorted.length };
    });
    return top;
  }, [sales]);

  const withTopProduct = (c) => ({ ...c, top_product: topProductByClient[c.id]?.name || null });

  // Same phone/email on two different client rows — almost always a
  // double entry (loaded twice, or converted from a lead that already
  // had a client). Maps each client's id to the other duplicate row
  // found, so the card/row for that specific client can flag it.
  const duplicateClientMap = useMemo(() => {
    const map = {};
    for (let i = 0; i < clients.length; i++) {
      const a = clients[i];
      const aPhone = normalizePhoneDigits(a.phone);
      const aEmail = normalizeEmailLower(a.email);
      if (!aPhone && !aEmail) continue;
      for (let j = 0; j < clients.length; j++) {
        if (i === j) continue;
        const b = clients[j];
        if ((aPhone && normalizePhoneDigits(b.phone) === aPhone) || (aEmail && normalizeEmailLower(b.email) === aEmail)) {
          map[a.id] = b;
          break;
        }
      }
    }
    return map;
  }, [clients]);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || [c.name, c.company, c.email, c.phone].some(v => (v || '').toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Exports whatever's currently filtered by the search box, not the
  // whole table — matches what the user is actually looking at.
  const exportExcel = () => {
    const rows = filtered.map(c => ({
      Nombre: c.name, Empresa: c.company || '', Tipo: c.type, Email: c.email || '', Teléfono: c.phone || '',
      'DNI/CUIT': c.tax_id || '', Dirección: c.address || '', Segmento: c.segment || '', Estado: c.status,
      Situación: c.situation_status || '', 'Total vendido': c.total_sold || 0, Cobrado: c.total_collected || 0,
      Saldo: c.balance || 0, 'Último contacto': c.last_contact ? formatDateShort(c.last_contact) : '',
      ...Object.fromEntries(customDefs.map(d => [d.label, c.custom_fields?.[d.id] ?? ''])),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const kpis = {
    total: clients.length,
    activos: clients.filter(c => c.status === 'Activo').length,
    conSaldo: clients.filter(c => Number(c.balance) > 0).length,
    totalVendido: clients.reduce((s, c) => s + (Number(c.total_sold) || 0), 0),
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients.length} clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent">
            <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button onClick={() => navigate('/importar?entity=Client')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span>
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nuevo cliente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Total de clientes" value={kpis.total} icon={Users} accent="#465BE8" />
        <KpiCard label="Activos" value={kpis.activos} icon={UserCheck} accent="#22c55e" />
        <KpiCard label="Con saldo pendiente" value={kpis.conSaldo} icon={Wallet} accent="#f59e0b" />
        <KpiCard label="Total vendido" value={formatCurrency(kpis.totalVendido)} icon={DollarSign} accent="#0ea5e9" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes…"
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit shrink-0">
          <button onClick={() => setViewMode('cards')} className={cn('px-3 h-9 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors', viewMode === 'cards' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutGrid className="w-3.5 h-3.5" /> Tarjetas
          </button>
          <button onClick={() => setViewMode('rows')} className={cn('px-3 h-9 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors', viewMode === 'rows' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Rows3 className="w-3.5 h-3.5" /> Filas
          </button>
        </div>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        filtered.length === 0 ? (
          <EmptyState icon={Users} title="Sin clientes" subtitle="Convertí leads o creá clientes directamente."
            action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nuevo cliente</button>} />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            <AnimatePresence>
              {paged.map(rawC => {
                const c = withTopProduct(rawC);
                const standing = getStanding(c);
                const dup = duplicateClientMap[c.id];
                return (
                  <motion.div key={c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    className={cn('cursor-pointer text-left bg-card rounded-2xl border card-shadow p-4 hover:card-shadow-lg hover:-translate-y-0.5 transition-all', dup ? 'border-destructive/40' : 'border-border')}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold">
                          {c.name?.charAt(0).toUpperCase()}
                        </div>
                        {dup && (
                          <button onClick={(e) => { e.stopPropagation(); setDuplicateClient(c); }} title="Dato duplicado"
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive ring-2 ring-card animate-pulse hover:scale-110 transition-transform" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{c.name}</p>
                        {c.company && <p className="text-xs text-muted-foreground truncate">{c.company}</p>}
                        {dup && (
                          <button onClick={(e) => { e.stopPropagation(); setDuplicateClient(c); }} className="text-[11px] font-medium text-destructive hover:underline">Dato duplicado</button>
                        )}
                        <div onClick={e => e.stopPropagation()} className="mt-1.5">
                          <SituationSelect client={c} onChange={updateSituation} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground mb-3">
                      {c.email && <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /> {c.email}</p>}
                      {c.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {c.phone}</p>}
                      {c.top_product && <p className="flex items-center gap-2 truncate text-primary"><Package className="w-3.5 h-3.5 shrink-0" /> Compra: {c.top_product}</p>}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Vendido</p>
                        <p className="text-sm font-semibold">{formatCurrency(c.total_sold || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className={cn('text-sm font-semibold', c.balance > 0 ? 'text-warning' : 'text-muted-foreground')}>{c.balance > 0 ? formatCurrency(c.balance) : '—'}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {c.phone && (
                          <button onClick={(e) => { e.stopPropagation(); openMessage(c, 'WhatsApp'); }} title="Mandar WhatsApp"
                            className="w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center hover:bg-[#25D366]/20">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        {c.email && (
                          <button onClick={(e) => { e.stopPropagation(); openMessage(c, 'Email'); }} title="Mandar mail"
                            className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setDocClient(c); }} title="Documentos"
                          className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center hover:bg-violet-500/20">
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground ml-2" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border card-shadow overflow-hidden">
            <AnimatePresence>
              {paged.map((rawC, i) => {
                const c = withTopProduct(rawC);
                const dup = duplicateClientMap[c.id];
                return (
                  <motion.div key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    className={cn('cursor-pointer flex items-center gap-3 p-3 sm:p-4 hover:bg-accent/50 transition-colors', i !== paged.length - 1 && 'border-b border-border', dup && 'bg-destructive/5')}>
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-white flex items-center justify-center font-semibold text-sm">
                        {c.name?.charAt(0).toUpperCase()}
                      </div>
                      {dup && (
                        <button onClick={(e) => { e.stopPropagation(); setDuplicateClient(c); }} title="Dato duplicado"
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive ring-2 ring-card animate-pulse hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {dup ? (
                        <button onClick={(e) => { e.stopPropagation(); setDuplicateClient(c); }} className="text-[11px] font-medium text-destructive hover:underline">Dato duplicado</button>
                      ) : c.top_product ? (
                        <p className="text-xs text-primary truncate flex items-center gap-1"><Package className="w-3 h-3 shrink-0" /> {c.top_product}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">{c.company || c.email || c.phone || '—'}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 hidden lg:block w-[104px]">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> Últ. contacto</p>
                      <p className="text-xs font-medium">{c.last_contact ? formatDateShort(c.last_contact) : 'Nunca'}</p>
                    </div>
                    <div onClick={e => e.stopPropagation()} className="shrink-0 hidden sm:flex sm:justify-end w-[150px]">
                      <SituationSelect client={c} onChange={updateSituation} />
                    </div>
                    <div className="text-right shrink-0 hidden md:block w-[90px]">
                      <p className="text-xs text-muted-foreground">Vendido</p>
                      <p className="text-sm font-semibold">{formatCurrency(c.total_sold || 0)}</p>
                    </div>
                    <div className="text-right shrink-0 hidden lg:block w-[90px]">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className={cn('text-sm font-semibold', c.balance > 0 ? 'text-warning' : 'text-muted-foreground')}>{c.balance > 0 ? formatCurrency(c.balance) : '—'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.phone && (
                        <button onClick={(e) => { e.stopPropagation(); openMessage(c, 'WhatsApp'); }} title="Mandar WhatsApp"
                          className="w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center hover:bg-[#25D366]/20">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      {c.email && (
                        <button onClick={(e) => { e.stopPropagation(); openMessage(c, 'Email'); }} title="Mandar mail"
                          className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setDocClient(c); }} title="Documentos"
                        className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center hover:bg-violet-500/20">
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {filtered.length} clientes</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center disabled:opacity-40 hover:bg-accent">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center disabled:opacity-40 hover:bg-accent">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ClientForm open={showForm} onClose={() => setShowForm(false)} onSaved={invalidate} user={user} />
      <ClientMessageModal client={messageClient} initialChannel={messageChannel} onClose={() => setMessageClient(null)} />
      <DocumentGeneratorModal client={docClient} onClose={() => setDocClient(null)} />
      <DuplicateClientModal client={duplicateClient} other={duplicateClient ? duplicateClientMap[duplicateClient.id] : null}
        sales={sales} onClose={() => setDuplicateClient(null)} onDeleted={invalidate} />
    </div>
  );
}

const SITUATION_BADGE_CLASSES = {
  blue: 'bg-blue-500/10 text-blue-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber: 'bg-amber-500/10 text-amber-600',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  muted: 'bg-secondary text-secondary-foreground',
};

// Pill-styled select so the "estado de situación" can be changed right
// from the Clientes list (cards or rows) without opening the client.
function SituationSelect({ client, onChange }) {
  const standing = getStanding(client);
  return (
    <StyledSelect
      value={client.situation_status || SITUATION_STAGES[0].key}
      onChange={(e) => onChange(client, e.target.value)}
      className={cn(
        'h-auto w-fit border-0 shadow-none rounded-full px-2.5 py-0.5 text-xs font-medium gap-1 focus:ring-1',
        SITUATION_BADGE_CLASSES[standing.variant] || SITUATION_BADGE_CLASSES.muted
      )}
    >
      {SITUATION_STAGES.map(s => <option key={s.key} value={s.key}>{s.key}</option>)}
    </StyledSelect>
  );
}

function DuplicateClientModal({ client, other, sales, onClose, onDeleted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  if (!client) return null;

  // sales.client_id is "on delete restrict" in the DB — a client with
  // sales can't be deleted at all without losing that history, so the
  // option is hidden instead of letting the delete fail. Opportunities/
  // activities would cascade-delete, which is an acceptable loss for a
  // genuine duplicate that never actually sold anything.
  const hasSales = sales.some(s => s.client_id === client.id);

  const del = async () => {
    setError('');
    setDeleting(true);
    try {
      await base44.entities.Client.delete(client.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar el cliente.');
    } finally { setDeleting(false); }
  };

  return (
    <Modal open={!!client} onClose={onClose} title="Dato duplicado"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">No, son distintos</button>
        {!hasSales && (
          <button onClick={del} disabled={deleting} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> {deleting ? 'Eliminando…' : 'Eliminar este'}
          </button>
        )}
      </>}>
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm">
            <span className="font-medium">{client.name}</span> coincide en teléfono o email con otro cliente ya cargado
            {other && <> — <button onClick={() => navigate(`/clientes/${other.id}`)} className="font-medium text-primary hover:underline">{other.name}</button></>}.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Probablemente uno de los dos quedó duplicado (cargado dos veces, o convertido desde un lead que ya era cliente).
            Si en realidad son personas distintas que comparten el dato (por ejemplo, familiares con el mismo teléfono), dejalo así.
          </p>
          {hasSales && (
            <p className="text-sm text-warning mt-2">Este cliente tiene ventas registradas, así que no se puede eliminar directamente sin perder ese historial — revisá cuál de los dos es el correcto y pasá manualmente lo que haga falta.</p>
          )}
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}

function ClientMessageModal({ client, initialChannel, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const standing = client ? getStanding(client) : null;

  useEffect(() => {
    if (!client) return;
    setText(getStanding(client).template);
    // The icon clicked (WhatsApp or mail) picks the channel directly; if
    // opened without one (e.g. from elsewhere) fall back to the client's
    // preferred_channel, adjusted for whichever contact info they actually
    // have.
    const preferred = initialChannel || client.preferred_channel || 'WhatsApp';
    setChannel(preferred === 'Email' && !client.email && client.phone ? 'WhatsApp' : preferred === 'WhatsApp' && !client.phone && client.email ? 'Email' : preferred);
    setSubject(standing ? standing.label : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, initialChannel]);

  const canSend = channel === 'WhatsApp' ? !!client?.phone : !!client?.email;

  const send = () => {
    if (!canSend) return;
    const url = channel === 'WhatsApp' ? buildWhatsAppUrl(client.phone, text) : buildMailtoUrl(client.email, subject, text);
    window.open(url, channel === 'WhatsApp' ? '_blank' : '_self');
    base44.entities.Activity.create({
      client_id: client.id, client_name: client.name, type: channel, title: `Mensaje por ${channel === 'WhatsApp' ? 'WhatsApp' : 'mail'}`,
      description: channel === 'Email' ? `Asunto: ${subject}\n\n${text}` : text, date: new Date().toISOString(), status: 'Realizada',
      owner_id: user?.id, owner_name: user?.full_name,
    }).then(() => queryClient.invalidateQueries({ queryKey: ['Activity'] })).catch(() => {});
    onClose();
  };

  return (
    <Modal open={!!client} onClose={onClose} title={client ? `Mensaje a ${client.name}` : ''}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={send} disabled={!canSend} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Send className="w-4 h-4" /> Enviar por {channel === 'WhatsApp' ? 'WhatsApp' : 'mail'}
        </button>
      </>}>
      {client && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={standing.variant}>{standing.label}</Badge>
            <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl">
              {COMMUNICATION_CHANNELS.map(c => (
                <button key={c} type="button" onClick={() => setChannel(c)}
                  disabled={c === 'WhatsApp' ? !client.phone : !client.email}
                  className={cn('px-3 h-7 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                    channel === c ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {c === 'WhatsApp' ? <MessageCircle className="w-3.5 h-3.5 inline mr-1" /> : <Mail className="w-3.5 h-3.5 inline mr-1" />}
                  {c === 'Email' ? 'Mail' : c}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{channel === 'WhatsApp' ? (client.phone || 'Sin teléfono') : (client.email || 'Sin email')}</span>
          </div>
          {channel === 'Email' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Asunto</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Mensaje (podés personalizarlo)</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
          </div>
        </div>
      )}
    </Modal>
  );
}

const emptyClientForm = { name: '', company: '', tax_id: '', phone: '', email: '', address: '', type: 'Consumidor', segment: '', notes: '', priority: '', preferred_channel: 'WhatsApp', custom_fields: {} };

export function ClientForm({ open, onClose, onSaved, user, editClient }) {
  const [form, setForm] = useState(emptyClientForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editClient) setForm({ ...emptyClientForm, ...editClient, priority: editClient.priority || '', custom_fields: editClient.custom_fields || {} });
    else setForm(emptyClientForm);
  }, [editClient, open]);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editClient) {
        await base44.entities.Client.update(editClient.id, { ...form, priority: form.priority || null });
      } else {
        await base44.entities.Client.create({ ...form, priority: form.priority || null, status: 'Activo', total_sold: 0, total_collected: 0, balance: 0, owner_id: user?.id, owner_name: user?.full_name });
      }
      onSaved?.();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editClient ? 'Editar cliente' : 'Nuevo cliente'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Nombre / Razón social *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="inp" /></Field></div>
        <Field label="Empresa"><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="inp" /></Field>
        <Field label="DNI / CUIT"><input value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} className="inp" /></Field>
        <Field label="Teléfono"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="inp" /></Field>
        <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="inp" /></Field>
        <Field label="Tipo"><StyledSelect value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="inp">{CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}</StyledSelect></Field>
        <Field label="Segmento"><input value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })} className="inp" /></Field>
        <Field label="Canal preferido"><StyledSelect value={form.preferred_channel} onChange={e => setForm({ ...form, preferred_channel: e.target.value })} className="inp">{COMMUNICATION_CHANNELS.map(c => <option key={c} value={c}>{c === 'Email' ? 'Mail' : c}</option>)}</StyledSelect></Field>
        <div className="col-span-2"><Field label="Dirección"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="inp" /></Field></div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Prioridad</label>
          <div className="flex items-center gap-2 flex-wrap">
            {CLIENT_PRIORITIES.map(p => (
              <button key={p.key} type="button" onClick={() => setForm({ ...form, priority: form.priority === p.key ? '' : p.key })}
                className={cn('inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all',
                  form.priority === p.key ? 'border-transparent' : 'border-border hover:border-primary/40',
                  form.priority === p.key && (p.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : p.variant === 'warning' ? 'bg-warning/15 text-warning' : p.variant === 'blue' ? 'bg-blue-500/10 text-blue-600' : 'bg-secondary text-secondary-foreground'))}>
                <span className={cn('w-2 h-2 rounded-full', p.dot)} /> {p.key}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2"><Field label="Notas"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="inp resize-none" /></Field></div>
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <CustomFieldsSection entity="Client" values={form.custom_fields} onChange={v => setForm({ ...form, custom_fields: v })} />
      </div>
      <style>{`.inp{width:100%;padding:0.625rem 0.875rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}

function Field({ label, children }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>{children}</div>;
}
