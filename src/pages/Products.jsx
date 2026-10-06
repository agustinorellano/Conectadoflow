import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Search, Pencil, Trash2, Box, Upload, ImageIcon, Layers, AlertTriangle, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import { Image as UIImage } from '@/components/ui/image';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const LOW_STOCK_THRESHOLD = 5;

export default function Products() {
  const { config } = useData();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const currency = config?.currency || 'ARS';

  const load = async () => {
    setLoading(true);
    try { setProducts(await base44.entities.Product.list().catch(() => [])); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const stockStats = useMemo(() => {
    const physical = products.filter(p => p.kind === 'Producto');
    return {
      total: products.length,
      totalStock: physical.reduce((s, p) => s + (Number(p.stock) || 0), 0),
      lowStock: physical.filter(p => Number(p.stock) > 0 && Number(p.stock) <= LOW_STOCK_THRESHOLD).length,
      outOfStock: physical.filter(p => (Number(p.stock) || 0) <= 0).length,
    };
  }, [products]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || [p.name, p.code, p.category, p.description].some(v => (v || '').toLowerCase().includes(q));
    const matchKind = filterKind === 'all' || p.kind === filterKind;
    return matchSearch && matchKind;
  });

  const handleEdit = (p) => { setEditProduct(p); setShowForm(true); };
  const handleNew = () => { setEditProduct(null); setShowForm(true); };
  const toggleActive = async (p) => {
    await base44.entities.Product.update(p.id, { is_active: !p.is_active });
    load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} productos y servicios</p>
        </div>
        <button onClick={handleNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nuevo producto
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <KpiCard label="Productos y servicios" value={stockStats.total} icon={Package} accent="#465BE8" />
        <KpiCard label="Stock total" value={stockStats.totalStock} icon={Layers} accent="#22c55e" sublabel="Unidades" />
        <KpiCard label="Stock bajo" value={stockStats.lowStock} icon={AlertTriangle} accent="#f59e0b" sublabel={`≤ ${LOW_STOCK_THRESHOLD} unidades`} />
        <KpiCard label="Sin stock" value={stockStats.outOfStock} icon={XCircle} accent="#ef4444" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos…"
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-input bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'Producto', 'Servicio'].map(k => (
            <button key={k} onClick={() => setFilterKind(k)} className={cn('px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap', filterKind === k ? 'bg-primary text-primary-foreground' : 'bg-card border border-border')}>{k === 'all' ? 'Todos' : k}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center py-16 text-muted-foreground">Cargando…</div> :
        filtered.length === 0 ? (
          <EmptyState icon={Package} title="Sin productos" subtitle="Agregá productos o servicios a tu catálogo para usarlos en cotizaciones y ventas."
            action={<button onClick={handleNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nuevo producto</button>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <motion.div key={p.id} layout className="bg-card rounded-2xl border border-border card-shadow p-5 hover:card-shadow-lg transition-shadow group">
                <div className="flex items-start gap-3 mb-3">
                  {p.image_url ? (
                    <UIImage src={p.image_url} alt={p.name} className="w-11 h-11 rounded-xl shrink-0 object-cover" />
                  ) : (
                    <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', p.kind === 'Servicio' ? 'bg-violet-500/10 text-violet-600' : 'bg-blue-500/10 text-blue-600')}>
                      {p.kind === 'Servicio' ? <Box className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.kind} · {p.category || 'Sin categoría'}</p>
                  </div>
                  <Badge variant={p.is_active ? 'success' : 'muted'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
                {p.kind === 'Producto' && (
                  <div className="mb-3">
                    <Badge variant={(Number(p.stock) || 0) <= 0 ? 'destructive' : Number(p.stock) <= LOW_STOCK_THRESHOLD ? 'warning' : 'success'} dot>
                      {(Number(p.stock) || 0) <= 0 ? 'Sin stock' : `${p.stock} en stock`}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Precio unitario</p>
                    <p className="text-lg font-bold">{formatCurrency(p.price, currency)}</p>
                  </div>
                  {p.code && <span className="text-xs text-muted-foreground">Cód: {p.code}</span>}
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(p)} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => toggleActive(p)} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      }

      <ProductForm open={showForm} onClose={() => setShowForm(false)} onSaved={load} product={editProduct} />
    </div>
  );
}

function ProductForm({ open, onClose, onSaved, product }) {
  const [form, setForm] = useState({ name: '', code: '', category: '', kind: 'Producto', price: '', cost: '', description: '', image_url: '', stock: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({ ...product, price: String(product.price || ''), cost: String(product.cost || ''), stock: String(product.stock || '') });
      } else {
        setForm({ name: '', code: '', category: '', kind: 'Producto', price: '', cost: '', description: '', image_url: '', stock: '', is_active: true });
      }
    }
  }, [open, product]);

  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) || 0, cost: Number(form.cost) || 0, stock: Number(form.stock) || 0 };
      if (product) {
        await base44.entities.Product.update(product.id, payload);
      } else {
        await base44.entities.Product.create(payload);
      }
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Editar producto' : 'Nuevo producto'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        {/* Image upload */}
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Imagen del producto</label>
          <div className="flex items-center gap-4">
            {form.image_url ? (
              <img src={form.image_url} alt="Producto" className="w-20 h-20 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 cursor-pointer">
                <Upload className="w-4 h-4" /> {uploading ? 'Subiendo…' : 'Subir imagen'}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
              </label>
              <p className="text-xs text-muted-foreground mt-1.5">PNG o JPG, recomendado 512×512px</p>
            </div>
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Nombre *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="inp" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Código</label>
          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ej: SKU-001" className="inp" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Categoría</label>
          <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="inp" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Tipo</label>
          <StyledSelect value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className="inp"><option>Producto</option><option>Servicio</option></StyledSelect>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Stock</label>
          <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="inp" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Precio *</label>
          <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="inp" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Costo</label>
          <input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="inp" />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Descripción</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="inp resize-none" />
        </div>
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}
