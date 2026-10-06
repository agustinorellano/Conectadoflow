import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, KanbanSquare, Package, MessageCircle, Coins, Plus, Trash2, GripVertical, Check, Save, Receipt, Upload, Store, CreditCard, Compass } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import { LEAD_SOURCES, PAYMENT_METHODS } from '@/lib/flowUtils';
import { NAV_ITEMS, DEFAULT_HIDDEN_NAV } from '@/lib/navItems';
import CommerceConfig from '@/components/CommerceConfig';
import PaymentEntitiesConfig from '@/components/PaymentEntitiesConfig';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'business', label: 'Negocio', icon: Building2 },
  { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { key: 'products', label: 'Productos', icon: Package },
  { key: 'messages', label: 'Mensajes', icon: MessageCircle },
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
                  <select value={form.sale_type || ''} onChange={e => setForm({ ...form, sale_type: e.target.value })} className="inp">
                    <option>Productos</option><option>Servicios</option><option>Productos y servicios</option>
                  </select>
                </Field>
                <Field label="A quién vendés">
                  <select value={form.sell_to || ''} onChange={e => setForm({ ...form, sell_to: e.target.value })} className="inp">
                    <option>Consumidores</option><option>Empresas</option><option>Ambos</option>
                  </select>
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
            </div>
          )}

          {tab === 'pipeline' && <PipelineConfig />}
          {tab === 'navigation' && <NavigationConfig form={form} setForm={setForm} saving={saving} saved={saved} onSave={save} />}
          {tab === 'commerces' && <CommerceConfig />}
          {tab === 'payment-entities' && <PaymentEntitiesConfig />}
          {tab === 'products' && <ProductsConfig />}
          {tab === 'messages' && <MessagesConfig />}
          {tab === 'currency' && (
            <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 space-y-4">
              <h2 className="font-semibold">Moneda e impuestos</h2>
              <Field label="Moneda principal">
                <select value={form.currency || 'ARS'} onChange={e => setForm({ ...form, currency: e.target.value, currency_symbol: { ARS: '$', USD: 'US$', EUR: '€' }[e.target.value] })} className="inp">
                  <option value="ARS">ARS — Peso argentino</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </Field>
              <Field label="Símbolo"><input value={form.currency_symbol || '$'} onChange={e => setForm({ ...form, currency_symbol: e.target.value })} className="inp" /></Field>
              <Field label="Tasa de impuesto (%)"><input type="number" value={form.tax_rate || 0} onChange={e => setForm({ ...form, tax_rate: e.target.value })} className="inp" /></Field>
              <p className="text-sm text-muted-foreground">Las conversiones entre monedas no se calculan automáticamente en esta versión.</p>
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
                  <select value={form.billing_type || ''} onChange={e => setForm({ ...form, billing_type: e.target.value })} className="inp">
                    <option>Responsable Inscripto</option><option>Monotributista</option><option>Exento</option><option>Consumidor Final</option><option>Otro</option>
                  </select>
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
        <Field label="Tipo"><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className="inp"><option>Producto</option><option>Servicio</option></select></Field>
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
              <button onClick={() => toggle(item.to)} className={cn('shrink-0 relative w-11 h-6 rounded-full transition-colors', isVisible ? 'bg-primary' : 'bg-muted')}>
                <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform', isVisible ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          );
        })}
      </div>
      <SaveBar saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}
