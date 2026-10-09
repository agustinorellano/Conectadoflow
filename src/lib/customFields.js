// Shared engine for org-defined custom fields (Configuración → Campos
// personalizados), used by Clientes/Leads/Productos. Values live in each
// row's own `custom_fields` jsonb column, keyed by the definition's id —
// renaming a field's label later never touches already-saved data.

export const CUSTOM_FIELD_ENTITIES = [
  { key: 'Client', label: 'Clientes' },
  { key: 'Lead', label: 'Leads' },
  { key: 'Product', label: 'Productos' },
];

export const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Lista (opciones)' },
  { value: 'boolean', label: 'Sí / No' },
];

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Starter suggestions for Productos, matched against the free-text
// "Rubro / industria" the org already set in Configuración → Negocio.
// Deliberately just a few common rubros, not an exhaustive catalog — the
// point is to show the user the IDEA (acá va lo que cambia según tu
// rubro), not to anticipate every business. Manual fields always work
// regardless of whether a rubro match is found.
const PRODUCT_FIELD_SUGGESTIONS = [
  { match: ['indumentaria', 'ropa', 'moda', 'textil'],
    fields: [
      { label: 'Talle', field_type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
      { label: 'Color', field_type: 'text' },
      { label: 'Material', field_type: 'text' },
    ] },
  { match: ['gastronomia', 'comida', 'restaurant', 'bar', 'cafeteria', 'panaderia'],
    fields: [
      { label: 'Ingredientes principales', field_type: 'text' },
      { label: 'Apto celíaco', field_type: 'boolean' },
      { label: 'Apto vegano', field_type: 'boolean' },
      { label: 'Tiempo de preparación (min)', field_type: 'number' },
    ] },
  { match: ['tecnologia', 'electronica', 'informatica', 'computacion'],
    fields: [
      { label: 'Marca', field_type: 'text' },
      { label: 'Modelo', field_type: 'text' },
      { label: 'Garantía (meses)', field_type: 'number' },
    ] },
  { match: ['belleza', 'estetica', 'spa', 'peluqueria', 'salon'],
    fields: [
      { label: 'Duración de la sesión (min)', field_type: 'number' },
      { label: 'Zona a tratar', field_type: 'text' },
    ] },
  { match: ['inmobiliaria', 'inmueble', 'propiedad'],
    fields: [
      { label: 'Metros cuadrados', field_type: 'number' },
      { label: 'Ambientes', field_type: 'number' },
      { label: 'Dirección', field_type: 'text' },
    ] },
  { match: ['automotriz', 'auto', 'vehiculo', 'taller'],
    fields: [
      { label: 'Marca', field_type: 'text' },
      { label: 'Modelo', field_type: 'text' },
      { label: 'Año', field_type: 'number' },
    ] },
];

export function suggestedProductFields(industry) {
  const n = normalize(industry);
  if (!n) return [];
  const hit = PRODUCT_FIELD_SUGGESTIONS.find(s => s.match.some(m => n.includes(m)));
  return hit ? hit.fields : [];
}

// Builds { [definitionId]: initialValue } for a fresh form — booleans
// default false, everything else blank, so controlled inputs never flip
// from uncontrolled to controlled on first keystroke.
export function emptyCustomFieldValues(definitions) {
  return Object.fromEntries(definitions.map(d => [d.id, d.field_type === 'boolean' ? false : '']));
}

// Which active, required definitions have no value yet — same "warn,
// never invent data" rule used by the document generator.
export function missingRequiredFields(definitions, values) {
  return definitions.filter(d => d.is_required && (values?.[d.id] === undefined || values?.[d.id] === '' || values?.[d.id] === null));
}
