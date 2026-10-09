import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, KanbanSquare, Package, MessageCircle, Coins, Plus, Trash2, GripVertical, Check, Save, Receipt, Upload, Store, CreditCard, Compass, Zap, Edit3, SlidersHorizontal, Sparkles, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import DeleteOrganizationModal from '@/components/DeleteOrganizationModal';
import { LEAD_SOURCES, PAYMENT_METHODS, SALE_STATUS } from '@/lib/flowUtils';
import { NAV_ITEMS, DEFAULT_HIDDEN_NAV } from '@/lib/navItems';
import { CUSTOM_FIELD_ENTITIES, FIELD_TYPES, suggestedProductFields } from '@/lib/customFields';
import CommerceConfig from '@/components/CommerceConfig';
import PaymentEntitiesConfig from '@/components/PaymentEntitiesConfig';
import { Switch } from '@/components/ui/switch';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'business', label: 'Negocio', icon: Building2 },
  { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { key: 'products', label: 'Productos', icon: Package },
  { key: 'messages', label: 'Mensajes', icon: MessageCircle },
  { key: 'automations', label: 'Automatizaciones', icon: Zap },
  { key: 'custom-fields', label: 'Campos personalizados', icon: SlidersHorizontal },
  { key: 'currency', label: 'Moneda', icon: Coins },
  { key: 'billing', label: 'Facturación', icon: Receipt },
  { key: 'commerces', label: 'Comercios', icon: Store },
  { key: 'payment-entities', label: 'Medios de pago', icon: CreditCard },
  { key: 'navigation', label: 'Navegación', icon: Compass },
];

export default function SettingsPage() {
  const { config, updateConfig, loadConfig } = useData();
  const [tab, setTab] = useState('business');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (config) setForm({ ...config }); }, [config]);

  const save = async () => {
    setSaving(true);
    try {
      await updateConfig(config.id, {
        company_name: form.company_name, industry: form.industry, sale_type: form.sale_type,
        sell_to: form.sell_to, channels: form.channels, tax_rate: Number(form.tax_rate) || 0,
        primary_color: form.primary_color, logo_url: form.logo_url,
        billing_name: form.billing_name, billing_tax_id: form.billing_tax_id,
        billing_address: form.billing_address, billing_phone: form.billing_phone,
        billing_email: form.billing_email, billing_type: form.billing_type,
        hidden_nav: form.hidden_nav || [],
        monthly_goal: form.monthly_goal === '' || form.monthly_goal === undefined ? null : Number(form.monthly_goal),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  if (!config) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Configuración</h1>
      <p className="text-sm text-muted-foreground mb-6">Personalizá Conectado Flow para tu negocio</p>

      <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-accent')}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'business' && (
            <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 space-y-4">
              <h2 className="font-semibold">Logo de la empresa</h2>
              <div className="flex items-center gap-4">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-contain border border-border" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 cursor-pointer">
                    <Upload className="w-4 h-4" /> Subir logo
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
                      setForm(f => ({ ...f, logo_url: file_url }));
                    }} />
                  </label>
                  <p className="text-xs text-muted-foreground mt-1.5">PNG o JPG, recomendado 512×512px</p>
                </div>
              </div>
              <div className="border-t border-border pt-4" />
              <h2 className="font-semibold">Datos del negocio</h2>
              <Field label="Nombre de empresa"><input value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} className="inp" /></Field>
              <Field label="Rubro / industria"><input value={form.industry || ''} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Ej: Gastronomía, Indumentaria, Automotriz…" className="inp" /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tipo de venta">
                  <StyledSelect value={form.sale_type || ''} onChange={e => setForm({ ...form, sale_type: e.target.value })} className="inp">
                    <option>Productos</option><option>Servicios</option><option>Productos y servicios</option>
                  </StyledSelect>
                </Field>
                <Field label="A quién vendés">
                  <StyledSelect value={form.sell_to || ''} onChange={e => setForm({ ...form, sell_to: e.target.value })} className="inp">
                    <option>Consumidores</option><option>Empresas</option><option>Ambos</option>
                  </StyledSelect>
                </Field>
              </div>
              <Field label="Canales de venta">
                <div className="flex flex-wrap gap-2">
                  {['Local','Online','WhatsApp','Instagram','Redes sociales','Web','Vendedores','Referidos','Otro'].map(c => {
                    const sel = (form.channels || []).includes(c);
                    return (
                      <button key={c} onClick={() => setForm(f => ({ ...f, channels: sel ? f.channels.filter(x => x !== c) : [...(f.channels || []), c] }))}
                        className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', sel ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border')}>{c}</button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Tasa de impuesto (%)"><input type="number" value={form.tax_rate || 0} onChange={e => setForm({ ...form, tax_rate: e.target.value })} className="inp" /></Field>
              <SaveBar saving={saving} saved={saved} onSave={save} />
              <DangerZone />
            </div>
          )}

          {tab === 'pipeline' && <PipelineConfig />}
          {tab === 'navigation' && <NavigationConfig form={form} setForm={setForm} saving={saving} saved={saved} onSave={save} />}
          {tab === 'commerces' && <CommerceConfig />}
          {tab === 'payment-entities' && <PaymentEntitiesConfig />}
          {tab === 'products' && <ProductsConfig />}
          {tab === 'messages' && <MessagesConfig />}
          {tab === 'automations' && <AutomationsConfig />}
          {tab === 'custom-fields' && <CustomFieldsConfig />}
          {tab === 'currency' && (
            <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 space-y-4">
              <h2 className="font-semibold">Moneda e impuestos</h2>
              <Field label="Moneda principal">
                <StyledSelect value={form.currency || 'ARS'} onChange={e => setForm({ ...form, currency: e.target.value, currency_symbol: { ARS: '$', USD: 'US$', EUR: '€' }[e.target.value] })} className="inp">
                  <option value="ARS">ARS — Peso argentino</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </StyledSelect>
              </Field>
              <Field label="Símbolo"><input value={form.currency_symbol || '$'} onChange={e => setForm({ ...form, currency_symbol: e.target.value })} className="inp" /></Field>
              <Field label="Tasa de impuesto (%)"><input type="number" value={form.tax_rate || 0} onChange={e => setForm({ ...form, tax_rate: e.target.value })} className="inp" /></Field>
              <div className="border-t border-border pt-4" />
              <Field label="Meta mensual de ventas">
                <input type="number" value={form.monthly_goal ?? ''} onChange={e => setForm({ ...form, monthly_goal: e.target.value })} placeholder="Ej: 10000000" className="inp" />
              </Field>
              <p className="text-xs text-muted-foreground">Se usa en el widget de Meta Mensual del Dashboard. Dejalo vacío para que se estime automáticamente.</p>
              <SaveBar saving={saving} saved={saved} onSave={save} />
            </div>
          )}

          {tab === 'billing' && (
            <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 space-y-4">
              <h2 className="font-semibold">Datos de facturación</h2>
              <Field label="Razón social"><input value={form.billing_name || ''} onChange={e => setForm({ ...form, billing_name: e.target.value })} className="inp" /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="CUIT / CUIL"><input value={form.billing_tax_id || ''} onChange={e => setForm({ ...form, billing_tax_id: e.target.value })} className="inp" /></Field>
                <Field label="Condición fiscal">
                  <StyledSelect value={form.billing_type || ''} onChange={e => setForm({ ...form, billing_type: e.target.value })} className="inp">
                    <option>Responsable Inscripto</option><option>Monotributista</option><option>Exento</option><option>Consumidor Final</option><option>Otro</option>
                  </StyledSelect>
                </Field>
              </div>
              <Field label="Dirección fiscal"><input value={form.billing_address || ''} onChange={e => setForm({ ...form, billing_address: e.target.value })} className="inp" /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Teléfono"><input value={form.billing_phone || ''} onChange={e => setForm({ ...form, billing_phone: e.target.value })} className="inp" /></Field>
                <Field label="Email de facturación"><input type="email" value={form.billing_email || ''} onChange={e => setForm({ ...form, billing_email: e.target.value })} className="inp" /></Field>
              </div>
              <SaveBar saving={saving} saved={saved} onSave={save} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <style>{`.inp{width:100%;padding:0.625rem 0.875rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="text-sm font-medium mb-1.5 block">{label}</label>{children}</div>;
}

// Eliminar la organización entera — no borra una fila de config, borra
// toda la cuenta (misma función que usa el Panel de administración, el
// backend valida que quien llama sea admin de ESTA organización). Se
// busca el nombre real de organizations acá en vez de usar
// app_config.company_name porque son dos campos distintos que pueden
// haberse desincronizado, y el modal pide escribir el nombre exacto.
function DangerZone() {
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!user?.organization_id) return;
    base44.entities.Organization.get(user.organization_id).then(setOrg).catch(() => {});
  }, [user?.organization_id]);

  if (user?.role !== 'admin' || !org) return null;

  return (
    <>
      <div className="border-t border-border pt-4 mt-2">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/5 border border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">Eliminar organización</p>
            <p className="text-sm text-muted-foreground mt-0.5">Borra toda la cuenta — clientes, ventas, documentos y el acceso de todo el equipo. No se puede deshacer.</p>
          </div>
          <button onClick={() => setConfirmOpen(true)} className="px-3.5 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 shrink-0">Eliminar</button>
        </div>
      </div>
      <DeleteOrganizationModal org={confirmOpen ? org : null} onClose={() => setConfirmOpen(false)}
        onDeleted={() => { base44.auth.logout('/login'); }} />
    </>
  );
}

function SaveBar({ saving, saved, onSave }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
        {saving ? 'Guardando…' : <><Save className="w-4 h-4" /> Guardar cambios</>}
      </button>
      {saved && <span className="inline-flex items-center gap-1 text-sm text-success"><Check className="w-4 h-4" /> Guardado</span>}
    </div>
  );
}

function PipelineConfig() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = async () => {
    setLoading(true);
    try { setStages(await base44.entities.PipelineStage.list().catch(() => [])); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName) return;
    await base44.entities.PipelineStage.create({ name: newName, order: stages.length, color: '#64748b' });
    setNewName(''); load();
  };
  const del = async (s) => { await base44.entities.PipelineStage.delete(s.id); load(); };
  const updateColor = async (s, color) => { await base44.entities.PipelineStage.update(s.id, { color }); load(); };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <h2 className="font-semibold mb-1">Estados del pipeline</h2>
      <p className="text-sm text-muted-foreground mb-4">Personalizá las etapas según tu proceso comercial.</p>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-2">
          {stages.sort((a, b) => a.order - b.order).map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <input type="color" value={s.color || '#64748b'} onChange={e => updateColor(s, e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer" />
              <span className="flex-1 text-sm font-medium">{s.name}</span>
              {(s.is_won || s.is_lost) && <Badge variant={s.is_won ? 'success' : 'destructive'}>{s.is_won ? 'Ganado' : 'Perdido'}</Badge>}
              {!s.is_won && !s.is_lost && <button onClick={() => del(s)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nuevo estado…" className="inp flex-1" />
            <button onClick={add} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Agregar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductsConfig() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const load = async () => { setLoading(true); try { setProducts(await base44.entities.Product.list().catch(() => [])); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const del = async (p) => { await base44.entities.Product.update(p.id, { is_active: !p.is_active }); load(); };
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="font-semibold">Catálogo</h2><p className="text-sm text-muted-foreground">Productos y servicios</p></div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nuevo</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : products.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin productos. Agregá tu catálogo.</p>
      ) : (
        <div className="space-y-1.5">
          {products.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <span className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.kind} · {p.category || 'Sin categoría'}</p>
              </div>
              <span className="text-sm font-semibold">${(p.price || 0).toLocaleString('es-AR')}</span>
              <Badge variant={p.is_active ? 'success' : 'muted'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
              <button onClick={() => del(p)} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground text-xs">{p.is_active ? 'Desactivar' : 'Activar'}</button>
            </div>
          ))}
        </div>
      )}
      <ProductForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} />
    </div>
  );
}

function ProductForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', code: '', category: '', kind: 'Producto', price: '', cost: '', description: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Product.create({ ...form, price: Number(form.price) || 0, cost: Number(form.cost) || 0, is_active: true });
      onSaved(); onClose();
      setForm({ name: '', code: '', category: '', kind: 'Producto', price: '', cost: '', description: '' });
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nuevo producto / servicio"
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Nombre *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="inp" /></Field></div>
        <Field label="Código"><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="inp" /></Field>
        <Field label="Categoría"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="inp" /></Field>
        <Field label="Tipo"><StyledSelect value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className="inp"><option>Producto</option><option>Servicio</option></StyledSelect></Field>
        <Field label="Precio"><input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="inp" /></Field>
        <div className="col-span-2"><Field label="Descripción"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="inp resize-none" /></Field></div>
      </div>
    </Modal>
  );
}

function MessagesConfig() {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <h2 className="font-semibold mb-1">Plantillas de mensajes</h2>
      <p className="text-sm text-muted-foreground mb-4">Gestioná tus plantillas desde el módulo de Comunicación.</p>
      <a href="#/comunicacion" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
        <MessageCircle className="w-4 h-4" /> Ir a Comunicación
      </a>
    </div>
  );
}

// Static value sets for triggers whose options aren't a user-editable table
// (unlike pipeline stages, which the org can rename/add — fetched live
// instead). Mirrors the CHECK constraints on clients.status/situation_status
// and sales.status/payment_status.
const CLIENT_STATUS_VALUES = ['Activo', 'Inactivo', 'Potencial'];
const CLIENT_SITUATION_VALUES = ['Primer contacto', 'Seguimiento', 'Propuesta enviada', 'Cliente activo', 'Saldo pendiente', 'Inactivo'];
const SALE_PAYMENT_STATUS_VALUES = ['Pendiente', 'Parcial', 'Pagado', 'Vencido', 'Cancelado'];

const TRIGGER_OPTIONS = [
  { key: 'opportunity_stage', entity: 'Opportunity', field: 'stage', label: 'Oportunidad → cambia de etapa', dynamicStages: true },
  { key: 'client_status', entity: 'Client', field: 'status', label: 'Cliente → cambia de estado', values: CLIENT_STATUS_VALUES },
  { key: 'client_situation', entity: 'Client', field: 'situation_status', label: 'Cliente → cambia de situación', values: CLIENT_SITUATION_VALUES },
  { key: 'sale_status', entity: 'Sale', field: 'status', label: 'Venta → cambia de estado', values: SALE_STATUS },
  { key: 'sale_payment_status', entity: 'Sale', field: 'payment_status', label: 'Venta → cambia de estado de cobro', values: SALE_PAYMENT_STATUS_VALUES },
];

function triggerOptionFor(rule) {
  return TRIGGER_OPTIONS.find(t => t.entity === rule.trigger_entity && t.field === rule.trigger_field);
}

function AutomationsConfig() {
  const [rules, setRules] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        base44.entities.AutomationRule.list().catch(() => []),
        base44.entities.PipelineStage.list().catch(() => []),
      ]);
      setRules(r); setStages(s);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (rule) => { await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active }); load(); };
  const del = async (rule) => {
    if (!confirm(`¿Eliminar la regla "${rule.name}"? Las tareas que ya creó no se borran, pero dejará de crear nuevas.`)) return;
    await base44.entities.AutomationRule.delete(rule.id); load();
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold">Automatizaciones</h2>
        <button onClick={() => { setEditRule(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva regla
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Definí tus propias reglas: cuando algo cambia a un valor específico, se crea automáticamente una tarea de seguimiento
        (aparece en el historial del cliente y en las notificaciones el día que vence). Las alertas de "cliente sin seguimiento"
        y "oportunidad estancada" del Dashboard son fijas y siguen funcionando aparte de esto.
      </p>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Todavía no creaste ninguna regla.</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const trigger = triggerOptionFor(rule);
            return (
              <div key={rule.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Zap className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rule.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {trigger?.label || `${rule.trigger_entity} → ${rule.trigger_field}`} a "{rule.trigger_value}" → crear tarea "{rule.action_task_title}"
                    {rule.action_days_offset > 0 ? ` en ${rule.action_days_offset} día${rule.action_days_offset === 1 ? '' : 's'}` : ' el mismo día'}
                  </p>
                </div>
                <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                <button onClick={() => { setEditRule(rule); setShowForm(true); }} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground shrink-0"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(rule)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
      )}
      <AutomationRuleForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} editRule={editRule} stages={stages} />
    </div>
  );
}

function AutomationRuleForm({ open, onClose, onSaved, editRule, stages }) {
  const [form, setForm] = useState({ name: '', triggerKey: TRIGGER_OPTIONS[0].key, trigger_value: '', action_task_title: '', action_task_description: '', action_days_offset: 3 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editRule) {
      const trigger = triggerOptionFor(editRule);
      setForm({
        name: editRule.name, triggerKey: trigger?.key || TRIGGER_OPTIONS[0].key, trigger_value: editRule.trigger_value,
        action_task_title: editRule.action_task_title, action_task_description: editRule.action_task_description || '',
        action_days_offset: editRule.action_days_offset,
      });
    } else {
      setForm({ name: '', triggerKey: TRIGGER_OPTIONS[0].key, trigger_value: '', action_task_title: '', action_task_description: '', action_days_offset: 3 });
    }
  }, [editRule, open]);

  const selectedTrigger = TRIGGER_OPTIONS.find(t => t.key === form.triggerKey);
  const valueOptions = selectedTrigger?.dynamicStages ? stages.map(s => s.name) : (selectedTrigger?.values || []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name, is_active: editRule ? editRule.is_active : true,
        trigger_entity: selectedTrigger.entity, trigger_field: selectedTrigger.field, trigger_value: form.trigger_value,
        action_task_title: form.action_task_title, action_task_description: form.action_task_description || null,
        action_days_offset: Number(form.action_days_offset) || 0,
      };
      if (editRule) await base44.entities.AutomationRule.update(editRule.id, payload);
      else await base44.entities.AutomationRule.create(payload);
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  const canSave = form.name && form.trigger_value && form.action_task_title;

  return (
    <Modal open={open} onClose={onClose} title={editRule ? 'Editar regla' : 'Nueva regla de automatización'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !canSave} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <Field label="Nombre de la regla">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Seguimiento tras enviar propuesta" className="inp" />
        </Field>
        <Field label="Cuándo">
          <StyledSelect value={form.triggerKey} onChange={e => setForm({ ...form, triggerKey: e.target.value, trigger_value: '' })} className="inp">
            {TRIGGER_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </StyledSelect>
        </Field>
        <Field label="Valor">
          <StyledSelect value={form.trigger_value} onChange={e => setForm({ ...form, trigger_value: e.target.value })} className="inp">
            <option value="">Elegí un valor…</option>
            {valueOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </StyledSelect>
        </Field>
        <div className="pt-2 border-t border-border" />
        <Field label="Entonces: crear tarea de seguimiento con el título">
          <input value={form.action_task_title} onChange={e => setForm({ ...form, action_task_title: e.target.value })} placeholder="Ej: Llamar para confirmar la propuesta" className="inp" />
        </Field>
        <Field label="Descripción de la tarea (opcional)">
          <textarea value={form.action_task_description} onChange={e => setForm({ ...form, action_task_description: e.target.value })} rows={2} className="inp resize-none" />
        </Field>
        <Field label="Días después del cambio (0 = el mismo día)">
          <input type="number" min="0" value={form.action_days_offset} onChange={e => setForm({ ...form, action_days_offset: e.target.value })} className="inp w-28" />
        </Field>
        <p className="text-xs text-muted-foreground">La tarea queda vinculada al cliente (y a la oportunidad, si corresponde) y le aparece al vendedor dueño del registro en sus notificaciones el día que vence.</p>
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}

function CustomFieldsConfig() {
  const { config } = useData();
  const [entity, setEntity] = useState('Client');
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDef, setEditDef] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setDefs(await base44.entities.CustomFieldDefinition.list().catch(() => [])); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const forEntity = defs.filter(d => d.entity === entity).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const toggleActive = async (d) => { await base44.entities.CustomFieldDefinition.update(d.id, { is_active: !d.is_active }); load(); };
  const del = async (d) => {
    if (!confirm(`¿Eliminar el campo "${d.label}"? Los valores ya cargados en registros existentes no se borran, pero el campo deja de poder editarse.`)) return;
    await base44.entities.CustomFieldDefinition.delete(d.id); load();
  };

  const quickAdd = async (suggestion) => {
    await base44.entities.CustomFieldDefinition.create({
      entity: 'Product', label: suggestion.label, field_type: suggestion.field_type, options: suggestion.options || [],
      is_required: false, is_active: true, sort_order: forEntity.length,
    });
    load();
  };

  const suggestions = entity === 'Product'
    ? suggestedProductFields(config?.industry).filter(s => !forEntity.some(d => d.label.toLowerCase() === s.label.toLowerCase()))
    : [];

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold">Campos personalizados</h2>
        <button onClick={() => { setEditDef(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nuevo campo
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Cada negocio necesita guardar datos distintos. En indumentaria quizás quieras el talle y el color de cada producto;
        en gastronomía, los ingredientes. Acá definís tus propios campos — aparecen en el formulario y en la ficha
        correspondiente, sin que haga falta tocar el sistema para cada caso.
      </p>

      <div className="flex gap-1.5 mb-4">
        {CUSTOM_FIELD_ENTITIES.map(e => (
          <button key={e.key} onClick={() => setEntity(e.key)}
            className={cn('px-3.5 py-2 rounded-xl text-sm font-medium transition-colors', entity === e.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}>
            {e.label}
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="mb-4 p-3.5 rounded-xl bg-primary/5 border border-primary/15">
          <p className="text-xs font-medium flex items-center gap-1.5 mb-2"><Sparkles className="w-3.5 h-3.5 text-primary" /> Sugerencias para tu rubro ({config?.industry})</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button key={s.label} onClick={() => quickAdd(s)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium hover:border-primary hover:text-primary transition-colors">
                <Plus className="w-3 h-3" /> {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : forEntity.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Todavía no hay campos personalizados para {CUSTOM_FIELD_ENTITIES.find(e => e.key === entity).label.toLowerCase()}.</p>
      ) : (
        <div className="space-y-2">
          {forEntity.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.label}{d.is_required && <span className="text-destructive"> *</span>}</p>
                <p className="text-xs text-muted-foreground">{FIELD_TYPES.find(t => t.value === d.field_type)?.label}{d.field_type === 'select' && d.options?.length ? `: ${d.options.join(', ')}` : ''}</p>
              </div>
              <Switch checked={d.is_active} onCheckedChange={() => toggleActive(d)} />
              <button onClick={() => { setEditDef(d); setShowForm(true); }} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground shrink-0"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => del(d)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      <CustomFieldForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} editDef={editDef} defaultEntity={entity} nextOrder={forEntity.length} />
    </div>
  );
}

function CustomFieldForm({ open, onClose, onSaved, editDef, defaultEntity, nextOrder }) {
  const [form, setForm] = useState({ entity: 'Client', label: '', field_type: 'text', optionsText: '', is_required: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editDef) setForm({ entity: editDef.entity, label: editDef.label, field_type: editDef.field_type, optionsText: (editDef.options || []).join(', '), is_required: !!editDef.is_required });
    else setForm({ entity: defaultEntity, label: '', field_type: 'text', optionsText: '', is_required: false });
  }, [editDef, open, defaultEntity]);

  const save = async () => {
    setSaving(true);
    try {
      const options = form.field_type === 'select' ? form.optionsText.split(',').map(s => s.trim()).filter(Boolean) : [];
      const payload = { entity: form.entity, label: form.label, field_type: form.field_type, options, is_required: form.is_required };
      if (editDef) await base44.entities.CustomFieldDefinition.update(editDef.id, payload);
      else await base44.entities.CustomFieldDefinition.create({ ...payload, is_active: true, sort_order: nextOrder });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  const canSave = form.label && (form.field_type !== 'select' || form.optionsText.trim());

  return (
    <Modal open={open} onClose={onClose} title={editDef ? 'Editar campo' : 'Nuevo campo personalizado'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !canSave} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <Field label="Para">
          <StyledSelect value={form.entity} onChange={e => setForm({ ...form, entity: e.target.value })} className="inp" disabled={!!editDef}>
            {CUSTOM_FIELD_ENTITIES.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
          </StyledSelect>
        </Field>
        <Field label="Nombre del campo">
          <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ej: Talle preferido" className="inp" />
        </Field>
        <Field label="Tipo">
          <StyledSelect value={form.field_type} onChange={e => setForm({ ...form, field_type: e.target.value })} className="inp">
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </StyledSelect>
        </Field>
        {form.field_type === 'select' && (
          <Field label="Opciones (separadas por coma)">
            <input value={form.optionsText} onChange={e => setForm({ ...form, optionsText: e.target.value })} placeholder="Ej: S, M, L, XL" className="inp" />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })} className="w-4 h-4 accent-primary" /> Obligatorio</label>
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}

function NavigationConfig({ form, setForm, saving, saved, onSave }) {
  const hidden = form.hidden_nav || DEFAULT_HIDDEN_NAV;
  const toggle = (path) => {
    const isHidden = hidden.includes(path);
    setForm(f => ({ ...f, hidden_nav: isHidden ? hidden.filter(p => p !== path) : [...hidden, path] }));
  };
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <h2 className="font-semibold mb-1">Secciones de la barra lateral</h2>
      <p className="text-sm text-muted-foreground mb-4">Activá o desactivá las secciones que aparecen en la barra de navegación.</p>
      <div className="space-y-2">
        {NAV_ITEMS.filter(item => !item.to.startsWith('/configuracion') && !item.to.startsWith('/perfil')).map(item => {
          const isVisible = !hidden.includes(item.to);
          return (
            <div key={item.to} className={cn('flex items-start gap-3 p-3.5 rounded-xl border transition-colors', isVisible ? 'border-border bg-background' : 'border-border/50 bg-secondary/30')}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', isVisible ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                <item.icon className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', !isVisible && 'text-muted-foreground')}>{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch checked={isVisible} onCheckedChange={() => toggle(item.to)} />
            </div>
          );
        })}
      </div>
      <SaveBar saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}
