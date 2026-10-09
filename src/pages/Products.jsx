import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Package, Plus, Search, Pencil, Trash2, Box, Upload, ImageIcon, Layers, AlertTriangle, XCircle, FileDown, FileText, LayoutGrid, Rows3, ChevronLeft, ChevronRight, Power, PowerOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useData } from '@/lib/DataContext';
import { useEntityList } from '@/lib/useEntityQuery';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import KpiCard from '@/components/KpiCard';
import { Image as UIImage } from '@/components/ui/image';
import CustomFieldsSection, { useCustomFieldDefinitions } from '@/components/CustomFieldsSection';
import { StyledSelect } from '@/components/ui/styled-select';
import { formatCurrency } from '@/lib/flowUtils';
import { cn } from '@/lib/utils';

const LOW_STOCK_THRESHOLD = 5;
const CURRENCY_OPTIONS = ['ARS', 'USD', 'EUR'];

const PAGE_SIZE = 24;

export default function Products() {
  const navigate = useNavigate();
  const { config } = useData();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: loading } = useEntityList('Product');
  const { definitions: customDefs } = useCustomFieldDefinitions('Product');
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const currency = config?.currency || 'ARS';

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['Product'] });

  useEffect(() => { setPage(1); }, [search, filterKind]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEdit = (p) => { setEditProduct(p); setShowForm(true); };
  const handleNew = () => { setEditProduct(null); setShowForm(true); };
  const toggleActive = async (p) => {
    await base44.entities.Product.update(p.id, { is_active: !p.is_active });
    invalidate();
  };

  const stockSituation = (p) => {
    if (p.kind !== 'Producto') return '—';
    const s = Number(p.stock) || 0;
    if (s <= 0) return 'Sin stock';
    if (s <= LOW_STOCK_THRESHOLD) return 'Stock bajo';
    return 'En stock';
  };

  const exportExcel = () => {
    const rows = filtered.map(p => ({
      'Nombre': p.name || '',
      'Código': p.code || '',
      'Categoría': p.category || '',
      'Tipo': p.kind || '',
      'Estado': p.is_active ? 'Activo' : 'Inactivo',
      'Stock': p.kind === 'Producto' ? (Number(p.stock) || 0) : '',
      'Situación de stock': stockSituation(p),
      'Precio': Number(p.price) || 0,
      'Costo': Number(p.cost) || 0,
      ...Object.fromEntries(customDefs.map(d => [d.label, p.custom_fields?.[d.id] ?? ''])),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `control_de_stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = config?.company_name || 'Conectado Flow';
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 20, y); y += 8;
    doc.setFontSize(11); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
    doc.text('Control de stock', 20, y); y += 6;
    doc.text(`Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 20, y); y += 10;

    doc.setTextColor(0); doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text('Producto', 20, y); doc.text('Tipo', 95, y); doc.text('Stock', 120, y); doc.text('Situación', 142, y); doc.text('Estado', 172, y); y += 5;
    doc.setFont(undefined, 'normal');
    filtered.forEach(p => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text((p.name || '').substring(0, 38), 20, y);
      doc.text(p.kind || '', 95, y);
      doc.text(p.kind === 'Producto' ? String(Number(p.stock) || 0) : '—', 120, y);
      doc.text(stockSituation(p), 142, y);
      doc.text(p.is_active ? 'Activo' : 'Inactivo', 172, y);
      y += 5.5;
    });

    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Conectado Flow · Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' }); }
    doc.save(`control_de_stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} productos y servicios</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/importar?entity=Product')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-foreground border border-border text-sm font-medium hover:bg-accent">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span>
          </button>
          <button onClick={exportExcel} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success text-white text-sm font-medium hover:opacity-90">
            <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span> Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-foreground border border-border text-sm font-medium hover:bg-accent">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={handleNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        </div>
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
          <EmptyState icon={Package} title="Sin productos" subtitle="Agregá productos o servicios a tu catálogo para usarlos en cotizaciones y ventas."
            action={<button onClick={handleNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><Plus className="w-4 h-4" /> Nuevo producto</button>} />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map(p => (
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
                    <p className="text-lg font-bold">{formatCurrency(p.price, p.currency || currency)}</p>
                  </div>
                  {p.code && <span className="text-xs text-muted-foreground">Cód: {p.code}</span>}
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(p)} title="Editar" className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => toggleActive(p)} title={p.is_active ? 'Desactivar' : 'Activar'} className={cn('w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center', p.is_active ? 'text-success' : 'text-muted-foreground')}>
                      {p.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setDeleteTarget(p)} title="Eliminar definitivamente" className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border card-shadow overflow-hidden">
            {paged.map((p, i) => (
              <motion.div key={p.id} layout
                className={cn('flex items-center gap-3 p-3 sm:p-4 hover:bg-accent/50 transition-colors', i !== paged.length - 1 && 'border-b border-border')}>
                {p.image_url ? (
                  <UIImage src={p.image_url} alt={p.name} className="w-10 h-10 rounded-xl shrink-0 object-cover" />
                ) : (
                  <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', p.kind === 'Servicio' ? 'bg-violet-500/10 text-violet-600' : 'bg-blue-500/10 text-blue-600')}>
                    {p.kind === 'Servicio' ? <Box className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.kind} · {p.category || 'Sin categoría'}{p.code ? ` · Cód: ${p.code}` : ''}</p>
                </div>
                {p.kind === 'Producto' && (
                  <Badge variant={(Number(p.stock) || 0) <= 0 ? 'destructive' : Number(p.stock) <= LOW_STOCK_THRESHOLD ? 'warning' : 'success'} dot className="shrink-0 hidden sm:inline-flex">
                    {(Number(p.stock) || 0) <= 0 ? 'Sin stock' : `${p.stock} en stock`}
                  </Badge>
                )}
                <Badge variant={p.is_active ? 'success' : 'muted'} className="shrink-0 hidden md:inline-flex">{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                <p className="text-sm font-semibold shrink-0 w-24 text-right">{formatCurrency(p.price, p.currency || currency)}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleEdit(p)} title="Editar" className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => toggleActive(p)} title={p.is_active ? 'Desactivar' : 'Activar'} className={cn('w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center', p.is_active ? 'text-success' : 'text-muted-foreground')}>
                    {p.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setDeleteTarget(p)} title="Eliminar definitivamente" className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      }

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {filtered.length} productos</p>
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

      <ProductForm open={showForm} onClose={() => setShowForm(false)} onSaved={invalidate} product={editProduct} />
      <DeleteProductModal product={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={invalidate} />
    </div>
  );
}

// Double confirmation on purpose: deleting a product is permanent (unlike
// the active/inactive toggle, which is reversible) — a checked box plus a
// second click, so it can't be fired by a stray double-click the way a
// single confirm() dialog can.
function DeleteProductModal({ product, onClose, onDeleted }) {
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const open = !!product;

  useEffect(() => { if (open) setConfirmed(false); }, [open]);

  const del = async () => {
    setDeleting(true);
    try {
      await base44.entities.Product.delete(product.id);
      onDeleted(); onClose();
    } finally { setDeleting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Eliminar producto definitivamente"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={del} disabled={!confirmed || deleting} className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">{deleting ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
      </>}>
      {product && (
        <div className="space-y-3">
          <p className="text-sm">
            Vas a eliminar <span className="font-semibold">{product.name}</span> para siempre. Esta acción no se puede deshacer.
          </p>
          <p className="text-sm text-muted-foreground">
            Si solo querés dejar de venderlo pero conservar su historial, cancelá y usá el botón de activar/desactivar en vez de esto.
          </p>
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-destructive/30 bg-destructive/5 cursor-pointer select-none">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="w-4 h-4 accent-destructive" />
            <span className="text-sm font-medium">Entiendo que esto es permanente y quiero eliminarlo</span>
          </label>
        </div>
      )}
    </Modal>
  );
}

function ProductForm({ open, onClose, onSaved, product }) {
  const { config } = useData();
  const [form, setForm] = useState({ name: '', code: '', category: '', kind: 'Producto', price: '', cost: '', currency: config?.currency || 'ARS', description: '', image_url: '', stock: '', is_active: true, custom_fields: {} });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (product) {
      setForm({ ...product, price: String(product.price || ''), cost: String(product.cost || ''), stock: String(product.stock || ''), currency: product.currency || config?.currency || 'ARS', custom_fields: product.custom_fields || {} });
    } else {
      setForm({ name: '', code: '', category: '', kind: 'Producto', price: '', cost: '', currency: config?.currency || 'ARS', description: '', image_url: '', stock: '', is_active: true, custom_fields: {} });
    }
  }, [open, product, config]);

  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
    } catch (err) {
      setError(err?.message || 'No se pudo subir la imagen.');
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name) return;
    setError('');
    setSaving(true);
    try {
      // Only send columns the product table actually has — spreading the
      // raw `product` prop in earlier edits also pulled in read-only
      // fields (created_date, created_by_id, etc.) that don't belong in
      // an update payload.
      const payload = {
        name: form.name, code: form.code, category: form.category, kind: form.kind,
        price: Number(form.price) || 0, cost: Number(form.cost) || 0, currency: form.currency,
        description: form.description, image_url: form.image_url,
        stock: Number(form.stock) || 0, is_active: form.is_active,
        custom_fields: form.custom_fields || {},
      };
      if (product) {
        await base44.entities.Product.update(product.id, payload);
      } else {
        await base44.entities.Product.create(payload);
      }
      onSaved(); onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el producto. Probá de nuevo.');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Editar producto' : 'Nuevo producto'}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      {error && <div className="mb-3 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>}
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
          <label className="text-sm font-medium mb-1.5 block">Moneda</label>
          <StyledSelect value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="inp">
            {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Precio * ({form.currency})</label>
          <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="inp" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Costo ({form.currency})</label>
          <input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="inp" />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Descripción</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="inp resize-none" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <CustomFieldsSection entity="Product" values={form.custom_fields} onChange={v => setForm({ ...form, custom_fields: v })} />
      </div>
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.inp:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/0.3)}`}</style>
    </Modal>
  );
}
