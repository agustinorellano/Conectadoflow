import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Store, Edit3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';

export default function CommerceConfig() {
  const { user } = useAuth();
  const [commerces, setCommerces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCommerce, setEditCommerce] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setCommerces(await base44.entities.Commerce.list().catch(() => [])); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const del = async (c) => { await base44.entities.Commerce.delete(c.id); load(); };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="font-semibold">Comercios</h2><p className="text-sm text-muted-foreground">Gestioná tus comercios</p></div>
        <button onClick={() => { setEditCommerce(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nuevo comercio</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-2">
          {commerces.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Store className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.industry || 'Sin rubro'}{c.address ? ` · ${c.address}` : ''}</p>
              </div>
              <Badge variant={c.is_active ? 'success' : 'muted'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge>
              <button onClick={() => { setEditCommerce(c); setShowForm(true); }} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
              {commerces.length > 1 && <button onClick={() => del(c)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          {commerces.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sin comercios. Creá tu primer comercio.</p>}
        </div>
      )}
      <CommerceForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} commerce={editCommerce} user={user} />
    </div>
  );
}

function CommerceForm({ open, onClose, onSaved, commerce, user }) {
  const [form, setForm] = useState({ name: '', industry: '', address: '', phone: '', email: '', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (commerce) setForm({ ...commerce });
      else setForm({ name: '', industry: '', address: '', phone: '', email: '', is_active: true });
    }
  }, [open, commerce]);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (commerce) await base44.entities.Commerce.update(commerce.id, { ...form, owner_id: user?.id });
      else await base44.entities.Commerce.create({ ...form, owner_id: user?.id });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={commerce ? 'Editar comercio' : 'Nuevo comercio'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <div><label className="text-sm font-medium mb-1.5 block">Nombre *</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="inp" /></div>
        <div><label className="text-sm font-medium mb-1.5 block">Rubro</label><input value={form.industry || ''} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Ej: Gastronomía, Retail…" className="inp" /></div>
        <div><label className="text-sm font-medium mb-1.5 block">Dirección</label><input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className="inp" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-medium mb-1.5 block">Teléfono</label><input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="inp" /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Email</label><input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="inp" /></div>
        </div>
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}
