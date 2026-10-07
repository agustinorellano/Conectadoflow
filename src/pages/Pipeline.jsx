import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanSquare, Plus, X, TrendingUp, Trophy, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useEntityList } from '@/lib/useEntityQuery';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { formatCurrency, formatDate, stageColor } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

const DEFAULT_STAGES = [
  { name: 'Nuevo lead', order: 0, color: '#94a3b8' },
  { name: 'Contactado', order: 1, color: '#6366f1' },
  { name: 'Calificado', order: 2, color: '#8b5cf6' },
  { name: 'Reunión', order: 3, color: '#0ea5e9' },
  { name: 'Propuesta', order: 4, color: '#f59e0b' },
  { name: 'Negociación', order: 5, color: '#f97316' },
  { name: 'Ganado', order: 6, color: '#22c55e', is_won: true },
  { name: 'Perdido', order: 7, color: '#ef4444', is_lost: true },
];

const OPP_KEY = ['Opportunity', 'list', { filter: undefined, sort: undefined, limit: undefined }];
const STAGE_KEY = ['PipelineStage', 'list', { filter: undefined, sort: undefined, limit: undefined }];

export default function Pipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: opps = [], isLoading: loadingOpps } = useEntityList('Opportunity');
  const { data: stageList = [], isLoading: loadingStages } = useEntityList('PipelineStage');
  const { data: clients = [], isLoading: loadingClients } = useEntityList('Client');
  const loading = loadingOpps || loadingStages || loadingClients;
  const [showForm, setShowForm] = useState(false);
  const [winOpp, setWinOpp] = useState(null);
  const [loseOpp, setLoseOpp] = useState(null);
  const [searchParams] = useSearchParams();

  const stages = stageList.length > 0 ? [...stageList].sort((a, b) => a.order - b.order) : DEFAULT_STAGES;

  // First-ever load of this org: no stages exist yet, seed the defaults
  // once so the board has columns to render.
  useEffect(() => {
    if (!loadingStages && stageList.length === 0) {
      base44.entities.PipelineStage.bulkCreate(DEFAULT_STAGES).then(() => {
        queryClient.invalidateQueries({ queryKey: ['PipelineStage'] });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingStages, stageList.length]);

  useEffect(() => { if (searchParams.get('new')) setShowForm(true); }, [searchParams]);

  const invalidateOpps = () => queryClient.invalidateQueries({ queryKey: ['Opportunity'] });

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const stage = stages.find(s => s.name === destination.droppableId);
    if (!stage) return;
    queryClient.setQueryData(OPP_KEY, (prev) => (prev || []).map(o => o.id === draggableId ? { ...o, stage: stage.name, stage_order: stage.order } : o));
    await base44.entities.Opportunity.update(draggableId, { stage: stage.name, stage_order: stage.order });
    if (stage.is_won) {
      const opp = opps.find(o => o.id === draggableId);
      if (opp && !opp.is_won) setWinOpp(opp);
    } else if (stage.is_lost) {
      const opp = opps.find(o => o.id === draggableId);
      if (opp && !opp.is_lost) setLoseOpp(opp);
    }
  };

  const oppsByStage = (stageName) => opps.filter(o => o.stage === stageName);
  const totalByStage = (stageName) => oppsByStage(stageName).reduce((s, o) => s + (Number(o.amount) || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {opps.filter(o => !o.is_won && !o.is_lost).length} oportunidades · {formatCurrency(opps.filter(o => !o.is_won && !o.is_lost).reduce((s, o) => s + (Number(o.amount) || 0), 0))}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva oportunidad
        </button>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto thin-scrollbar pb-4 min-w-0" style={{ minWidth: 'min-content' }}>
            {stages.map(stage => {
              const items = oppsByStage(stage.name);
              return (
                <div key={stage.name} className="w-[280px] shrink-0 flex flex-col">
                  <Droppable droppableId={stage.name}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={cn('rounded-2xl p-3 flex-1 min-h-[200px] transition-colors',
                          snapshot.isDraggingOver ? 'bg-primary/5' : 'bg-secondary/30')}>
                        <div className="flex items-center justify-between mb-3 px-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                            <span className="text-sm font-semibold">{stage.name}</span>
                            <span className="text-xs text-muted-foreground bg-card px-1.5 py-0.5 rounded-md">{items.length}</span>
                          </div>
                          {items.length > 0 && <span className="text-xs text-muted-foreground">{formatCurrency(totalByStage(stage.name))}</span>}
                        </div>
                        <div className="space-y-2 min-h-[40px]">
                          {items.map((o, idx) => (
                            <Draggable key={o.id} draggableId={o.id} index={idx}>
                              {(p, s) => (
                                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                  className={cn('bg-card rounded-xl border border-border p-3 cursor-grab active:cursor-grabbing transition-shadow',
                                    s.isDragging && 'shadow-lg ring-2 ring-primary/30')}>
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <p className="text-sm font-medium leading-tight">{o.title}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2 truncate">{o.client_name}</p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold">{formatCurrency(o.amount)}</span>
                                    <Badge variant="muted">{o.probability}%</Badge>
                                  </div>
                                  {o.expected_close_date && (
                                    <p className="text-[11px] text-muted-foreground mt-1.5">Cierra {formatDate(o.expected_close_date)}</p>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      }

      <OppForm open={showForm} onClose={() => setShowForm(false)} onSaved={invalidateOpps} clients={clients} user={user} stages={stages} />
      <WinModal opp={winOpp} onClose={() => setWinOpp(null)} onDone={() => { invalidateOpps(); queryClient.invalidateQueries({ queryKey: ['Sale'] }); }} user={user} />
      <LoseModal opp={loseOpp} onClose={() => setLoseOpp(null)} onDone={invalidateOpps} />
    </div>
  );
}

function OppForm({ open, onClose, onSaved, clients, user, stages }) {
  const [form, setForm] = useState({ client_id: '', title: '', product: '', amount: '', probability: 20, expected_close_date: '', stage: 'Nuevo lead', notes: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(f => ({ ...f, client_id: clients[0]?.id || '' })); }, [open, clients]);
  const save = async () => {
    const client = clients.find(c => c.id === form.client_id);
    if (!client || !form.title) return;
    setSaving(true);
    try {
      const stage = stages.find(s => s.name === form.stage) || stages[0];
      await base44.entities.Opportunity.create({
        ...form, amount: Number(form.amount) || 0, client_name: client.name, client_company: client.company,
        stage_order: stage.order, source: client.lead_source || '', owner_id: client.owner_id || user?.id, owner_name: client.owner_name || user?.full_name,
      });
      onSaved(); onClose();
      setForm({ client_id: '', title: '', product: '', amount: '', probability: 20, expected_close_date: '', stage: 'Nuevo lead', notes: '' });
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nueva oportunidad"
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.title || !form.client_id} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Crear'}</button></>}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Cliente *</label>
          <StyledSelect value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
            <option value="">Seleccionar…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </StyledSelect>
        </div>
        <Inp label="Título *" value={form.title} onChange={v => setForm({ ...form, title: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Producto/servicio" value={form.product} onChange={v => setForm({ ...form, product: v })} />
          <Inp label="Monto" type="number" value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
          <Inp label="Probabilidad (%)" type="number" value={form.probability} onChange={v => setForm({ ...form, probability: v })} />
          <Inp label="Cierre estimado" type="date" value={form.expected_close_date} onChange={v => setForm({ ...form, expected_close_date: v })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Estado inicial</label>
          <StyledSelect value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
            {stages.filter(s => !s.is_won && !s.is_lost).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </StyledSelect>
        </div>
      </div>
    </Modal>
  );
}

function WinModal({ opp, onClose, onDone, user }) {
  const [createSale, setCreateSale] = useState(true);
  const [saving, setSaving] = useState(false);
  const confirm = async () => {
    setSaving(true);
    try {
      await base44.entities.Opportunity.update(opp.id, { is_won: true, is_lost: false });
      if (createSale) {
        const num = `V-${Date.now().toString().slice(-6)}`;
        const sale = await base44.entities.Sale.create({
          number: num, client_id: opp.client_id, client_name: opp.client_name, opportunity_id: opp.id,
          items: [{ description: opp.product || opp.title, quantity: 1, unit_price: opp.amount, subtotal: opp.amount }],
          gross_amount: opp.amount, discount: 0, tax: 0, total_amount: opp.amount,
          date: new Date().toISOString().slice(0, 10), status: 'Confirmada',
          collected_amount: 0, balance: opp.amount, payment_status: 'Pendiente',
          owner_id: opp.owner_id || user?.id, owner_name: opp.owner_name || user?.full_name,
        });
        await base44.entities.Opportunity.update(opp.id, { sale_id: sale.id });
      }
      onDone(); onClose();
    } finally { setSaving(false); }
  };
  return (
    <Modal open={!!opp} onClose={onClose} title="🎉 ¡Oportunidad ganada!" subtitle={opp?.title}
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Ahora no</button>
        <button onClick={confirm} disabled={saving} className="px-4 py-2 rounded-xl bg-success text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Procesando…' : 'Confirmar'}</button></>}>
      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-accent/30 cursor-pointer">
        <input type="checkbox" checked={createSale} onChange={e => setCreateSale(e.target.checked)} className="w-4 h-4 accent-primary" />
        <div>
          <p className="text-sm font-medium">Crear venta automáticamente</p>
          <p className="text-xs text-muted-foreground">Se generará la venta {formatCurrency(opp?.amount)} lista para registrar pagos.</p>
        </div>
      </label>
    </Modal>
  );
}

function LoseModal({ opp, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const confirm = async () => {
    setSaving(true);
    try {
      await base44.entities.Opportunity.update(opp.id, { is_lost: true, is_won: false, loss_reason: reason });
      onDone(); onClose();
    } finally { setSaving(false); }
  };
  return (
    <Modal open={!!opp} onClose={onClose} title="Oportunidad perdida" subtitle={opp?.title}
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={confirm} disabled={saving} className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Confirmar'}</button></>}>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Motivo de pérdida (opcional)</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ej: eligió la competencia, presupuesto, timing…"
          className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
    </Modal>
  );
}

function Inp({ label, value, onChange, type = 'text' }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" /></div>;
}
