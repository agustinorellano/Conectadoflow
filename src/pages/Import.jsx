import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, ArrowLeft, Users, UserPlus, Package, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { StyledSelect } from '@/components/ui/styled-select';
import { parseCSV, autoMapColumns, buildImportRows, IMPORT_ENTITIES } from '@/lib/csvImport';
import { cn } from '@/lib/utils';

// Standalone bulk-import module: its own route, its own file, its own
// parsing engine (csvImport.js) — deliberately not woven into Clients.jsx
// or Leads.jsx beyond a single "Importar" entry button in each, so this
// whole feature can be lifted out later without surgery.

const CHUNK_SIZE = 200; // keeps each bulkCreate insert comfortably sized
const PREVIEW_ROWS = 5;
const BACK_ROUTES = { Client: '/clientes', Lead: '/leads', Product: '/productos' };

export default function Import() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialEntity = searchParams.get('entity');

  const [entityKey, setEntityKey] = useState(IMPORT_ENTITIES[initialEntity] ? initialEntity : null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState([]); // array parallel to headers, each a field key or null
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { created, invalid }
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const entityDef = entityKey ? IMPORT_ENTITIES[entityKey] : null;

  const onFile = async (file) => {
    setError('');
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    if (headers.length === 0 || rows.length === 0) {
      setError('No se pudo leer el archivo — revisá que sea un CSV con encabezados en la primera fila.');
      return;
    }
    setFileName(file.name);
    setParsed({ headers, rows });
    setMapping(autoMapColumns(headers, entityDef.fields));
  };

  const setColumnMapping = (colIdx, fieldKey) => {
    setMapping(m => m.map((v, i) => (i === colIdx ? (fieldKey || null) : v)));
  };

  const mappedRequiredOk = entityDef?.requiredFields.every(f => mapping.includes(f));

  const runImport = async () => {
    if (!parsed || !entityDef) return;
    setImporting(true);
    setError('');
    try {
      const { valid, invalid } = buildImportRows(parsed.rows, parsed.headers, mapping, entityDef);
      const payload = entityDef.hasOwner ? valid.map(row => ({ ...row, owner_id: user?.id, owner_name: user?.full_name })) : valid;
      let created = 0;
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        if (chunk.length === 0) continue;
        await base44.entities[entityDef.entityName].bulkCreate(chunk);
        created += chunk.length;
      }
      queryClient.invalidateQueries({ queryKey: [entityDef.entityName] });
      setResult({ created, invalid });
    } catch (err) {
      setError(err?.message || 'No se pudo completar la importación. Probá de nuevo.');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => { setParsed(null); setMapping([]); setResult(null); setFileName(''); setError(''); };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[800px] mx-auto">
      <button onClick={() => navigate(BACK_ROUTES[entityKey] || '/clientes')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> {entityKey ? IMPORT_ENTITIES[entityKey].label : 'Clientes'}
      </button>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Importar desde CSV</h1>
      <p className="text-sm text-muted-foreground mb-6">Subí un archivo exportado de Excel, Google Sheets o tu sistema anterior y cargá varios registros de una sola vez.</p>

      {!entityKey ? (
        <div className="bg-card rounded-2xl border border-border card-shadow p-5">
          <p className="text-sm font-medium mb-3">¿Qué querés importar?</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={() => setEntityKey('Client')} className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border hover:border-primary hover:-translate-y-0.5 hover:card-shadow transition-all text-primary">
              <span className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5" /></span>
              <span className="text-sm font-semibold text-foreground">Clientes</span>
            </button>
            <button onClick={() => setEntityKey('Lead')} className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border hover:border-primary hover:-translate-y-0.5 hover:card-shadow transition-all text-primary">
              <span className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center"><UserPlus className="w-5 h-5" /></span>
              <span className="text-sm font-semibold text-foreground">Leads</span>
            </button>
            <button onClick={() => setEntityKey('Product')} className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border hover:border-primary hover:-translate-y-0.5 hover:card-shadow transition-all text-primary">
              <span className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center"><Package className="w-5 h-5" /></span>
              <span className="text-sm font-semibold text-foreground">Productos</span>
            </button>
          </div>
        </div>
      ) : result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-success/10 border border-success/20">
            <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
            <p className="text-sm">Se importaron <span className="font-semibold">{result.created}</span> {entityDef.label.toLowerCase()} correctamente.</p>
          </div>
          {result.invalid.length > 0 && (
            <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                <p className="text-sm font-medium">{result.invalid.length} fila{result.invalid.length === 1 ? '' : 's'} se omitieron por faltar datos obligatorios</p>
              </div>
              <div className="max-h-40 overflow-y-auto thin-scrollbar text-xs text-muted-foreground space-y-0.5">
                {result.invalid.map((inv, i) => (
                  <p key={i}>Fila {inv.rowNumber}: falta {inv.missing.join(', ')}</p>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent">Importar otro archivo</button>
            <button onClick={() => navigate(entityKey === 'Lead' ? '/leads' : '/clientes')} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Ver {entityDef.label.toLowerCase()}
            </button>
          </div>
        </div>
      ) : !parsed ? (
        <div className="bg-card rounded-2xl border border-border card-shadow p-8">
          <div onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
            className="flex flex-col items-center gap-3 p-10 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-center">
            <span className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center"><Upload className="w-6 h-6 text-muted-foreground" /></span>
            <p className="text-sm font-medium">Arrastrá tu archivo CSV acá, o hacé clic para elegirlo</p>
            <p className="text-xs text-muted-foreground">Soporta separador por coma (,) o punto y coma (;), igual que exporta Excel</p>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          </div>
          {error && <p className="text-sm text-destructive mt-4 text-center">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 text-sm">
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{fileName}</span>
            <span className="text-muted-foreground">· {parsed.rows.length} fila{parsed.rows.length === 1 ? '' : 's'} detectada{parsed.rows.length === 1 ? '' : 's'}</span>
          </div>

          <div className="bg-card rounded-2xl border border-border card-shadow p-5">
            <p className="text-sm font-medium mb-1">Relacioná las columnas de tu archivo</p>
            <p className="text-xs text-muted-foreground mb-4">Adivinamos algunas automáticamente — revisalas y ajustá las que falten. {entityDef.fields.filter(f => f.required).map(f => f.label).join(', ')} {entityDef.requiredFields.length === 1 ? 'es obligatorio' : 'son obligatorios'}.</p>
            <div className="space-y-2">
              {parsed.headers.map((header, colIdx) => (
                <div key={colIdx} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{header}</p>
                    <p className="text-xs text-muted-foreground truncate">Ej: {parsed.rows[0]?.[colIdx] || '—'}</p>
                  </div>
                  <StyledSelect value={mapping[colIdx] || ''} onChange={e => setColumnMapping(colIdx, e.target.value)} className="w-56 shrink-0">
                    <option value="">No importar</option>
                    {entityDef.fields.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                  </StyledSelect>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border card-shadow p-5 overflow-x-auto">
            <p className="text-sm font-medium mb-3">Vista previa</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                  {entityDef.fields.filter(f => mapping.includes(f.key)).map(f => <th key={f.key} className="pb-2 pr-4 font-medium">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {entityDef.fields.filter(f => mapping.includes(f.key)).map(f => {
                      const colIdx = mapping.indexOf(f.key);
                      return <td key={f.key} className="py-2 pr-4 truncate max-w-[160px]">{row[colIdx] || '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.rows.length > PREVIEW_ROWS && <p className="text-xs text-muted-foreground mt-2">…y {parsed.rows.length - PREVIEW_ROWS} más.</p>}
          </div>

          {!mappedRequiredOk && (
            <p className="text-sm text-warning flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> Falta relacionar una columna con el campo obligatorio.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent">Cancelar</button>
            <button onClick={runImport} disabled={!mappedRequiredOk || importing}
              className={cn('inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50')}>
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando…</> : `Importar ${parsed.rows.length} fila${parsed.rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
