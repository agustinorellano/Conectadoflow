import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Users, UserPlus, ShoppingCart, FileText, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/flowUtils';

export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ clients: [], leads: [], sales: [], documents: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQ('');
      setResults({ clients: [], leads: [], sales: [], documents: [] });
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setResults({ clients: [], leads: [], sales: [], documents: [] });
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const [clients, leads, sales, documents] = await Promise.all([
          base44.entities.Client.list().catch(() => []),
          base44.entities.Lead.list().catch(() => []),
          base44.entities.Sale.list().catch(() => []),
          base44.entities.Document.list().catch(() => []),
        ]);
        if (cancelled) return;
        const ql = q.toLowerCase();
        const f = (arr, fields) => arr.filter(item => fields.some(f => (item[f] || '').toLowerCase().includes(ql))).slice(0, 5);
        setResults({
          clients: f(clients, ['name', 'company', 'email', 'phone']),
          leads: f(leads, ['first_name', 'last_name', 'company', 'email', 'phone']),
          sales: f(sales, ['number', 'client_name']),
          documents: f(documents, ['name']),
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const hasResults = Object.values(results).some(r => r.length > 0);

  const Row = ({ icon: Icon, title, subtitle, onClick, badge }) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors text-left group">
      <span className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {badge && <span className="text-xs text-muted-foreground shrink-0">{badge}</span>}
      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-xl bg-card rounded-2xl border border-border floating-island overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar clientes, leads, ventas, documentos…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto thin-scrollbar p-2">
              {loading && <p className="text-center text-sm text-muted-foreground py-6">Buscando…</p>}
              {!loading && !hasResults && q.trim().length >= 2 && (
                <p className="text-center text-sm text-muted-foreground py-6">Sin resultados para "{q}"</p>
              )}
              {!loading && !hasResults && q.trim().length < 2 && (
                <p className="text-center text-sm text-muted-foreground py-6">Escribí al menos 2 caracteres…</p>
              )}
              {hasResults && (
                <div className="space-y-4 py-2">
                  {results.clients.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">Clientes</p>
                  {results.clients.map(c => (
                    <Row key={c.id} icon={Users} title={c.name} subtitle={c.company || c.email}
                      onClick={() => { onClose(); navigate(`/clientes/${c.id}`); }} />
                  ))}
                </div>
              )}
              {results.leads.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">Leads</p>
                  {results.leads.map(l => (
                    <Row key={l.id} icon={UserPlus} title={`${l.first_name} ${l.last_name || ''}`.trim()} subtitle={l.company || l.source}
                      onClick={() => { onClose(); navigate('/leads'); }} />
                  ))}
                </div>
              )}
              {results.sales.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">Ventas</p>
                  {results.sales.map(s => (
                    <Row key={s.id} icon={ShoppingCart} title={`${s.number || 'Venta'} · ${s.client_name}`} subtitle={formatCurrency(s.total_amount)}
                      onClick={() => { onClose(); navigate('/ventas'); }} />
                  ))}
                </div>
              )}
              {results.documents.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">Documentos</p>
                  {results.documents.map(d => (
                    <Row key={d.id} icon={FileText} title={d.name} subtitle={d.type}
                      onClick={() => { onClose(); navigate('/documentos'); }} />
                  ))}
                </div>
              )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
