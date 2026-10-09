import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Store, Edit3, ChevronDown, ChevronRight, MapPin, Users2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import { cn } from '@/lib/utils';

export default function CommerceConfig() {
  const { user } = useAuth();
  const [commerces, setCommerces] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchManagers, setBranchManagers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCommerce, setEditCommerce] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [c, b, bm, u] = await Promise.all([
        base44.entities.Commerce.list().catch(() => []),
        base44.entities.Branch.list().catch(() => []),
        base44.entities.BranchManager.list().catch(() => []),
        base44.entities.User.list().catch(() => []),
      ]);
      setCommerces(c);
      setBranches(b);
      setBranchManagers(bm);
      setManagers(u.filter(x => x.role === 'manager' && x.organization_id === user?.organization_id));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const del = async (c) => { await base44.entities.Commerce.delete(c.id); load(); };

  const toggleExpanded = (id) => {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="font-semibold">Comercios</h2><p className="text-sm text-muted-foreground">Gestioná tus comercios y sus sucursales</p></div>
        <button onClick={() => { setEditCommerce(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> Nuevo comercio</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="space-y-2">
          {commerces.map(c => {
            const open = expanded.has(c.id);
            const commerceBranches = branches.filter(b => b.commerce_id === c.id);
            return (
            <div key={c.id} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <button onClick={() => toggleExpanded(c.id)} className="w-6 h-6 flex items-center justify-center text-muted-foreground shrink-0">
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Store className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.industry || 'Sin rubro'}{c.address ? ` · ${c.address}` : ''}{commerceBranches.length > 0 ? ` · ${commerceBranches.length} sucursal${commerceBranches.length === 1 ? '' : 'es'}` : ''}</p>
                </div>
                <Badge variant={c.is_active ? 'success' : 'muted'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge>
                <button onClick={() => { setEditCommerce(c); setShowForm(true); }} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                {commerces.length > 1 && <button onClick={() => del(c)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
              {open && (
                <BranchesSection commerce={c} branches={commerceBranches} branchManagers={branchManagers} managers={managers} onChange={load} />
              )}
            </div>
            );
          })}
          {commerces.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sin comercios. Creá tu primer comercio.</p>}
        </div>
      )}
      <CommerceForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} commerce={editCommerce} user={user} />
    </div>
  );
}

function BranchesSection({ commerce, branches, branchManagers, managers, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [assignBranch, setAssignBranch] = useState(null);

  const del = async (b) => { await base44.entities.Branch.delete(b.id); onChange(); };
  const managersOf = (branchId) => branchManagers.filter(bm => bm.branch_id === branchId)
    .map(bm => managers.find(m => m.id === bm.manager_id)).filter(Boolean);

  return (
    <div className="border-t border-border bg-secondary/30 p-3 pl-14">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sucursales</p>
        <button onClick={() => { setEditBranch(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10">
          <Plus className="w-3.5 h-3.5" /> Nueva sucursal
        </button>
      </div>
      {branches.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sin sucursales cargadas. Si este comercio opera en un solo lugar no hace falta crear ninguna.</p>
      ) : (
        <div className="space-y-1.5">
          {branches.map(b => {
            const bMgrs = managersOf(b.id);
            return (
              <div key={b.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card border border-border">
                <span className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0"><MapPin className="w-3.5 h-3.5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.address || 'Sin dirección'} · {bMgrs.length > 0 ? bMgrs.map(m => m.full_name).join(', ') : 'Sin gerente asignado'}
                  </p>
                </div>
                <button onClick={() => setAssignBranch(b)} title="Asignar gerentes" className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground shrink-0"><Users2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setEditBranch(b); setShowForm(true); }} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground shrink-0"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(b)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
      )}
      <BranchForm open={showForm} onClose={() => setShowForm(false)} onSaved={onChange} branch={editBranch} commerce={commerce} />
      <AssignManagersModal branch={assignBranch} managers={managers} branchManagers={branchManagers} onClose={() => setAssignBranch(null)} onSaved={onChange} />
    </div>
  );
}

function BranchForm({ open, onClose, onSaved, branch, commerce }) {
  const [form, setForm] = useState({ name: '', address: '', phone: '', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(branch ? { ...branch } : { name: '', address: '', phone: '', is_active: true });
  }, [open, branch]);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (branch) await base44.entities.Branch.update(branch.id, { name: form.name, address: form.address, phone: form.phone, is_active: form.is_active });
      else await base44.entities.Branch.create({ ...form, commerce_id: commerce.id });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={branch ? 'Editar sucursal' : `Nueva sucursal de ${commerce?.name || ''}`}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="space-y-3">
        <div><label className="text-sm font-medium mb-1.5 block">Nombre *</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Sucursal Centro" className="inp" /></div>
        <div><label className="text-sm font-medium mb-1.5 block">Dirección</label><input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className="inp" /></div>
        <div><label className="text-sm font-medium mb-1.5 block">Teléfono</label><input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="inp" /></div>
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}

function AssignManagersModal({ branch, managers, branchManagers, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  if (!branch) return null;

  const assignedIds = new Set(branchManagers.filter(bm => bm.branch_id === branch.id).map(bm => bm.manager_id));

  const toggle = async (managerId) => {
    setSaving(true);
    try {
      if (assignedIds.has(managerId)) {
        const row = branchManagers.find(bm => bm.branch_id === branch.id && bm.manager_id === managerId);
        if (row) await base44.entities.BranchManager.delete(row.id);
      } else {
        await base44.entities.BranchManager.create({ branch_id: branch.id, manager_id: managerId });
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={!!branch} onClose={onClose} title={`Gerentes de ${branch.name}`} subtitle="Un gerente solo ve en su Dashboard las sucursales que le asignes acá."
      footer={<button onClick={onClose} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Listo</button>}>
      {managers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Todavía no hay usuarios con rol Gerente en el equipo.</p>
      ) : (
        <div className="space-y-1.5">
          {managers.map(m => {
            const checked = assignedIds.has(m.id);
            return (
              <button key={m.id} type="button" disabled={saving} onClick={() => toggle(m.id)}
                className={cn('w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors', checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}>
                <span className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0', checked ? 'bg-primary border-primary text-white' : 'border-input')}>
                  {checked && <Check className="w-3 h-3" />}
                </span>
                <span className="text-sm font-medium truncate">{m.full_name}</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
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
