import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard, Building2, Smartphone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import { ENTITY_TYPES, CARD_TYPES, CARD_BRANDS } from '@/lib/flowUtils';
import { StyledSelect } from '@/components/ui/styled-select';

export default function ClientPaymentMethods({ client }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setMethods(await base44.entities.ClientPaymentMethod.filter({ client_id: client.id }).catch(() => [])); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [client.id]);

  const del = async (m) => { await base44.entities.ClientPaymentMethod.delete(m.id); load(); };

  const iconFor = (type) => type === 'Banco' ? Building2 : (type === 'Billetera' || type === 'Fintech') ? Smartphone : CreditCard;

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Medios de pago utilizados</h2>
        <button onClick={() => setShowForm(true)} className="text-sm text-primary font-medium inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> :
        methods.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">Sin medios de pago registrados</p> : (
          <div className="space-y-2">
            {methods.map(m => {
              const Icon = iconFor(m.entity_type);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <span className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center"><Icon className="w-4 h-4 text-muted-foreground" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.entity_name || 'Sin nombre'}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.entity_type}{m.card_type ? ` · ${m.card_type}` : ''}{m.card_brand ? ` · ${m.card_brand}` : ''}{m.last_digits ? ` · ****${m.last_digits}` : ''}
                    </p>
                  </div>
                  <Badge variant="muted">{m.entity_type}</Badge>
                  <button onClick={() => del(m)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
        )
      }
      <MethodForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} client={client} />
    </div>
  );
}

function MethodForm({ open, onClose, onSaved, client }) {
  const [form, setForm] = useState({ entity_type: 'Banco', entity_name: '', card_type: '', card_brand: '', last_digits: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.ClientPaymentMethod.create({ ...form, client_id: client.id, client_name: client.name });
      onSaved(); onClose();
      setForm({ entity_type: 'Banco', entity_name: '', card_type: '', card_brand: '', last_digits: '', notes: '' });
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Medio de pago del cliente" subtitle={client.name}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-medium mb-1.5 block">Tipo</label><StyledSelect value={form.entity_type} onChange={e => setForm({ ...form, entity_type: e.target.value })} className="inp">{ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}</StyledSelect></div>
          <div><label className="text-sm font-medium mb-1.5 block">Nombre</label><input value={form.entity_name} onChange={e => setForm({ ...form, entity_name: e.target.value })} placeholder="ej: Santander" className="inp" /></div>
        </div>
        {form.entity_type === 'Tarjeta' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1.5 block">Tipo de tarjeta</label><StyledSelect value={form.card_type} onChange={e => setForm({ ...form, card_type: e.target.value })} className="inp"><option value="">—</option>{CARD_TYPES.map(t => <option key={t}>{t}</option>)}</StyledSelect></div>
            <div><label className="text-sm font-medium mb-1.5 block">Marca</label><StyledSelect value={form.card_brand} onChange={e => setForm({ ...form, card_brand: e.target.value })} className="inp"><option value="">—</option>{CARD_BRANDS.map(t => <option key={t}>{t}</option>)}</StyledSelect></div>
          </div>
        )}
        <div><label className="text-sm font-medium mb-1.5 block">Últimos dígitos</label><input value={form.last_digits} onChange={e => setForm({ ...form, last_digits: e.target.value })} placeholder="1234" className="inp" /></div>
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}
