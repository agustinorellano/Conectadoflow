// CSV import engine: parsing + column auto-mapping, kept entirely separate
// from React/Supabase. No external CSV library — this file is the entire
// dependency surface for the feature, on purpose: when the system eventually
// splits into separately-billed services, "importación masiva" is meant to
// be lifted out whole (this file + Import.jsx + the two entry-point buttons)
// without untangling it from anything else first.

// Splits on the delimiter actually used in the file: plain "," for most
// exports, ";" for CSVs saved by Excel in an es-AR locale (very common
// here, and silently produces one giant garbage column if assumed away).
export function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

// A small hand-rolled parser instead of a library: handles quoted fields
// (with embedded commas/semicolons/newlines) and "" as an escaped quote,
// which covers what Excel/Sheets/Google Contacts actually export.
export function parseCSV(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!clean.trim()) return { headers: [], rows: [] };
  const delimiter = detectDelimiter(clean.split('\n')[0]);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  const [headers, ...dataRows] = rows;
  const trimmedHeaders = (headers || []).map(h => h.trim());
  // Drop fully-empty trailing rows (a common artifact of trailing newlines).
  const cleanRows = dataRows.filter(r => r.some(cell => (cell || '').trim() !== ''));
  return { headers: trimmedHeaders, rows: cleanRows };
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Synonym dictionary so a real-world export ("Celular", "Correo", "Razón
// social") auto-maps instead of landing on "No importar" for every column.
const FIELD_SYNONYMS = {
  name: ['nombre', 'nombre completo', 'cliente', 'contacto'],
  first_name: ['nombre', 'first name', 'primer nombre'],
  last_name: ['apellido', 'last name'],
  company: ['empresa', 'compania', 'compañia', 'razon social', 'negocio'],
  tax_id: ['cuit', 'dni', 'cuil', 'tax id', 'identificacion'],
  phone: ['telefono', 'celular', 'whatsapp', 'movil', 'phone', 'tel'],
  email: ['email', 'correo', 'mail', 'e-mail'],
  address: ['direccion', 'domicilio', 'address'],
  type: ['tipo'],
  segment: ['segmento', 'categoria'],
  source: ['origen', 'fuente', 'canal'],
  interest: ['interes', 'producto de interes'],
  notes: ['notas', 'observaciones', 'comentarios'],
};

// For each CSV header, picks the best-guess target field key (or null for
// "No importar" if nothing matches) — the user can still override every
// guess before importing, this just saves the common case of remapping
// every single column by hand.
export function autoMapColumns(headers, fields) {
  return headers.map(header => {
    const h = normalize(header);
    for (const field of fields) {
      if (normalize(field.label) === h || normalize(field.key) === h) return field.key;
      const synonyms = FIELD_SYNONYMS[field.key] || [];
      if (synonyms.some(s => h === s || h.includes(s))) return field.key;
    }
    return null;
  });
}

// Turns parsed rows + a header->field mapping into entity payloads, using
// the entity's own `build` function to apply field-specific normalization
// (e.g. clamping `type` to a valid enum) and to flag rows missing a
// required field instead of silently sending bad data to the server.
export function buildImportRows(rows, headers, mapping, entityDef) {
  const colForField = {};
  mapping.forEach((fieldKey, colIdx) => { if (fieldKey) colForField[fieldKey] = colIdx; });

  const valid = [];
  const invalid = [];
  rows.forEach((row, i) => {
    const raw = {};
    Object.entries(colForField).forEach(([fieldKey, colIdx]) => { raw[fieldKey] = (row[colIdx] || '').trim(); });
    const missing = entityDef.requiredFields.filter(f => !raw[f]);
    if (missing.length > 0) { invalid.push({ rowNumber: i + 2, missing }); return; }
    valid.push(entityDef.build(raw));
  });
  return { valid, invalid };
}

export const IMPORT_ENTITIES = {
  Client: {
    entityName: 'Client',
    label: 'Clientes',
    requiredFields: ['name'],
    fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'company', label: 'Empresa' },
      { key: 'tax_id', label: 'DNI / CUIT' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Dirección' },
      { key: 'type', label: 'Tipo (Consumidor/Empresa)' },
      { key: 'segment', label: 'Segmento' },
      { key: 'notes', label: 'Notas' },
    ],
    build: (raw) => ({
      name: raw.name, company: raw.company || '', tax_id: raw.tax_id || '', phone: raw.phone || '',
      email: raw.email || '', address: raw.address || '', segment: raw.segment || '', notes: raw.notes || '',
      type: raw.type && normalize(raw.type).startsWith('emp') ? 'Empresa' : 'Consumidor',
      status: 'Activo', total_sold: 0, total_collected: 0, balance: 0,
    }),
  },
  Lead: {
    entityName: 'Lead',
    label: 'Leads',
    requiredFields: ['first_name'],
    fields: [
      { key: 'first_name', label: 'Nombre', required: true },
      { key: 'last_name', label: 'Apellido' },
      { key: 'company', label: 'Empresa' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'source', label: 'Origen' },
      { key: 'interest', label: 'Interés' },
      { key: 'notes', label: 'Notas' },
    ],
    build: (raw) => ({
      first_name: raw.first_name, last_name: raw.last_name || '', company: raw.company || '',
      phone: raw.phone || '', email: raw.email || '', interest: raw.interest || '', notes: raw.notes || '',
      source: raw.source || 'Otro', status: 'Nuevo',
    }),
  },
};
