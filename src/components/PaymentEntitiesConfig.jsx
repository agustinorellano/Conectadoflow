import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCommerce } from '@/lib/CommerceContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import { ENTITY_TYPES, DEFAULT_BANKS, DEFAULT_WALLETS, CARD_TYPES } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

export default function PaymentEntitiesConfig() {
  const { currentCommerceId } = useCommerce();
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setEntities(await base44.entities.PaymentEntity.list().catch(() => [])); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleFavorite = async (e) => {
    await base44.entities.PaymentEntity.update(e.id, { is_favorite: !e.is_favorite });
    load();
  };
  const del = async (e) => { await base44.entities.PaymentEntity.delete(e.id); load(); };

  const filtered = entities.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));
  const favorites = filtered.filter(e => e.is_favorite);
  const others = filtered.filter(e => !e.is_favorite);

  const seedDefaults = async () => {
    const defaults = [
      ...DEFAULT_BANKS.map(n => ({ name: n, type: 'Banco', is_favorite: false, is_active: true, commerce_id: currentCommerceId !== 'all' ? currentCommerceId : undefined })),
      ...DEFAULT_WALLETS.map(n => ({ name: n, type: 'Billetera', is_favorite: false, is_active: true, commerce_id: currentCommerceId !== 'all' ? currentCommerceId : undefined })),
      ...CARD_TYPES.map(n => ({ name: n, type: 'Tarjeta', is_favorite: false, is_active: true, commerce_id: currentCommerceId !== 'all' ? currentCommerceId : undefined })),
    ];
    await base44.entities.PaymentEntity.bulkCreate(defaults);
    load();
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="font-semibold">Medios de pago</h2><p className="text-sm text-muted-foreground">Bancos, billeteras y tarjetas</p></div>
        <div className="flex gap-2">
          {entities.length === 0 && (
            <button onClick={seedDefaults} className="px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent">Cargar predefinidos</button>
          )}
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nueva entidad</button>
        </div>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar entidad..."
          className="w-full pl-10 pr-4 h-10 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-4">
          {favorites.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Frecuentes</p>
              <div className="space-y-1.5">{favorites.map(e => <EntityRow key={e.id} entity={e} onFav={toggleFavorite} onDel={del} />)}</div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              {favorites.length > 0 && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Todas</p>}
              <div className="space-y-1.5">{others.map(e => <EntityRow key={e.id} entity={e} onFav={toggleFavorite} onDel={del} />)}</div>
            </div>
          )}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sin entidades configuradas</p>}
        </div>
      )}
      <EntityForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} commerceId={currentCommerceId} />
    </div>
  );
}

function EntityRow({ entity, onFav, onDel }) {
  const colors = { Banco: 'blue', Billetera: 'violet', Tarjeta: 'cyan', Fintech: 'amber', Otros: 'muted' };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <button onClick={() => onFav(entity)} className={cn('w-7 h-7 rounded-lg flex items-center justify-center', entity.is_favorite ? 'text-warning' : 'text-muted-foreground hover:bg-accent')}>
        <Star className="w-4 h-4" fill={entity.is_favorite ? 'currentColor' : 'none'} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entity.name}</p>
        {entity.subtype && <p className="text-xs text-muted-foreground">{entity.subtype}</p>}
      </div>
      <Badge variant={colors[entity.type] || 'muted'}>{entity.type}</Badge>
      <button onClick={() => onDel(entity)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function EntityForm({ open, onClose, onSaved, commerceId }) {
  const [form, setForm] = useState({ name: '', type: 'Banco', subtype: '', is_favorite: false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await base44.entities.PaymentEntity.create({ ...form, is_active: true, commerce_id: commerceId !== 'all' ? commerceId : undefined });
      onSaved(); onClose();
      setForm({ name: '', type: 'Banco', subtype: '', is_favorite: false });
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva entidad"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <div><label className="text-sm font-medium mb-1.5 block">Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="inp" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-medium mb-1.5 block">Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="inp">{ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-sm font-medium mb-1.5 block">Subtipo</label><input value={form.subtype} onChange={e => setForm({ ...form, subtype: e.target.value })} placeholder="ej: Visa" className="inp" /></div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_favorite} onChange={e => setForm({ ...form, is_favorite: e.target.checked })} className="w-4 h-4 rounded" />
          <span className="text-sm">Marcar como frecuente</span>
        </label>
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}
