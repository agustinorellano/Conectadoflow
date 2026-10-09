// Shared logic for the document generator (Clientes → Comunicación →
// Documentos): doc types, the {{variable}} substitution engine, and the
// default templates seeded for each org the first time they open it.

export const DOC_TYPES = [
  'Constancia de entrega',
  'Comprobante de entrega de mercadería',
  'Constancia de prestación de servicios',
  'Acuerdo comercial de venta',
  'Conformidad de recepción',
  'Documento personalizado',
];

export const OPERATION_TYPES = ['B2B', 'B2C'];

// Doc-level and party-level variables (per-item fields like
// {{producto_servicio}}/{{cantidad}} live in the items table, not in free
// text, so they aren't part of this substitution pass).
export const DOC_VARIABLES = [
  'nombre_cliente', 'apellido_cliente', 'empresa_cliente', 'cuit_cliente',
  'direccion_cliente', 'email_cliente', 'telefono_cliente',
  'nombre_empresa', 'razon_social_empresa', 'cuit_empresa', 'direccion_empresa',
  'telefono_empresa', 'email_empresa',
  'fecha_documento', 'numero_documento', 'numero_venta', 'importe_total', 'moneda',
];

export function fillDocTemplate(text, vars) {
  return (text || '').replace(/\{\{(\w+)\}\}/g, (match, key) => (vars[key] != null && vars[key] !== '' ? vars[key] : match));
}

// Which {{vars}} in a piece of text have no value yet — used to warn the
// user before generating instead of silently shipping a document with
// "{{cuit_cliente}}" printed on it.
export function missingDocVars(text, vars) {
  const found = new Set();
  (text || '').replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (vars[key] == null || vars[key] === '') found.add(key);
    return match;
  });
  return [...found];
}

// Builds the variable map from whatever CRM data is on hand. Any field
// that comes back empty just renders as nothing — the editor step (Etapa
// 4+) is where the user fills gaps before generating, per the "never
// invent data" rule.
export function buildDocVars({ client, config, issuer, documentNumber, saleNumber, totalAmount, currency }) {
  const i = issuer || config || {};
  return {
    nombre_cliente: client?.name || '',
    apellido_cliente: '', // clients are stored as one `name` field, not first/last — kept as its own var in case a template wants it
    empresa_cliente: client?.company || '',
    cuit_cliente: client?.tax_id || '',
    direccion_cliente: client?.address || '',
    email_cliente: client?.email || '',
    telefono_cliente: client?.phone || '',
    nombre_empresa: i.company_name || i.name || '',
    razon_social_empresa: i.billing_name || '',
    cuit_empresa: i.billing_tax_id || '',
    direccion_empresa: i.billing_address || i.address || '',
    telefono_empresa: i.billing_phone || i.phone || '',
    email_empresa: i.billing_email || i.email || '',
    fecha_documento: new Date().toLocaleDateString('es-AR'),
    numero_documento: documentNumber || '',
    numero_venta: saleNumber || '',
    importe_total: totalAmount != null ? String(totalAmount) : '',
    moneda: currency || 'ARS',
  };
}

// One B2B + one B2C default per doc type (except "Documento personalizado",
// which starts blank — it's meant to be written from scratch). Seeded once
// per org, same pattern as DEFAULT_TEMPLATES in Communication.jsx.
export const DEFAULT_DOCUMENT_TEMPLATES = [
  {
    name: 'Constancia de entrega (empresas)', doc_type: 'Constancia de entrega', operation_type: 'B2B',
    intro_text: 'Por medio del presente, {{nombre_empresa}} ({{razon_social_empresa}}, CUIT {{cuit_empresa}}) deja constancia de la entrega de los productos y/o servicios detallados a continuación a {{empresa_cliente}} (CUIT {{cuit_cliente}}), con domicilio en {{direccion_cliente}}.',
    conditions_text: 'La presente constancia acredita la entrega descripta, sin que ello implique por sí sola la cancelación de saldos pendientes de pago, salvo indicación expresa.',
    show_prices: true, show_signature: true, show_banner: true,
  },
  {
    name: 'Constancia de entrega (consumidor final)', doc_type: 'Constancia de entrega', operation_type: 'B2C',
    intro_text: 'Se deja constancia de la entrega de los productos y/o servicios detallados a continuación a {{nombre_cliente}}, en la fecha indicada.',
    conditions_text: 'Esta constancia certifica que el cliente recibió lo detallado. Ante cualquier consulta, contactarse a {{email_empresa}} o {{telefono_empresa}}.',
    show_prices: true, show_signature: true, show_banner: true,
  },
  {
    name: 'Comprobante de entrega de mercadería (empresas)', doc_type: 'Comprobante de entrega de mercadería', operation_type: 'B2B',
    intro_text: '{{nombre_empresa}} informa la entrega de mercadería a {{empresa_cliente}} (CUIT {{cuit_cliente}}) correspondiente a la operación N° {{numero_venta}}, según el detalle de ítems incluido en este documento.',
    conditions_text: 'La recepción de la mercadería en conformidad queda sujeta a la verificación de cantidades por parte del receptor al momento de la entrega.',
    show_prices: false, show_signature: true, show_banner: true,
  },
  {
    name: 'Comprobante de entrega de mercadería (consumidor final)', doc_type: 'Comprobante de entrega de mercadería', operation_type: 'B2C',
    intro_text: 'Comprobante de entrega de mercadería a {{nombre_cliente}}, correspondiente a la compra realizada.',
    conditions_text: 'Por favor verificar la mercadería recibida al momento de la entrega.',
    show_prices: false, show_signature: true, show_banner: true,
  },
  {
    name: 'Constancia de prestación de servicios (empresas)', doc_type: 'Constancia de prestación de servicios', operation_type: 'B2B',
    intro_text: '{{nombre_empresa}} deja constancia de la prestación de los servicios detallados a {{empresa_cliente}} (CUIT {{cuit_cliente}}), en el marco de la relación comercial vigente entre las partes.',
    conditions_text: 'La presente constancia no reemplaza la facturación correspondiente ni implica la cancelación de obligaciones de pago pendientes.',
    show_prices: true, show_signature: true, show_banner: true,
  },
  {
    name: 'Constancia de prestación de servicios (consumidor final)', doc_type: 'Constancia de prestación de servicios', operation_type: 'B2C',
    intro_text: 'Se deja constancia de la prestación de los servicios detallados a continuación a {{nombre_cliente}}.',
    conditions_text: 'Ante cualquier consulta sobre el servicio prestado, contactarse a {{email_empresa}} o {{telefono_empresa}}.',
    show_prices: true, show_signature: false, show_banner: true,
  },
  {
    name: 'Acuerdo comercial de venta (empresas)', doc_type: 'Acuerdo comercial de venta', operation_type: 'B2B',
    intro_text: 'Entre {{nombre_empresa}} ({{razon_social_empresa}}, CUIT {{cuit_empresa}}), en adelante "el Proveedor", y {{empresa_cliente}} (CUIT {{cuit_cliente}}), en adelante "el Cliente", se acuerda la venta de los productos y/o servicios detallados a continuación, en los términos y condiciones aquí establecidos.',
    conditions_text: 'El presente acuerdo se rige por las condiciones comerciales pactadas entre las partes. Cualquier modificación deberá constar por escrito y ser aceptada por ambas partes.',
    show_prices: true, show_signature: true, show_banner: true,
  },
  {
    name: 'Acuerdo comercial de venta (consumidor final)', doc_type: 'Acuerdo comercial de venta', operation_type: 'B2C',
    intro_text: 'El presente documento detalla los términos de la venta realizada a {{nombre_cliente}} por parte de {{nombre_empresa}}.',
    conditions_text: 'Condiciones de entrega, cambios y garantía según política comercial vigente de {{nombre_empresa}}.',
    show_prices: true, show_signature: true, show_banner: true,
  },
  {
    name: 'Conformidad de recepción (empresas)', doc_type: 'Conformidad de recepción', operation_type: 'B2B',
    intro_text: '{{empresa_cliente}} (CUIT {{cuit_cliente}}) deja constancia de haber recibido de {{nombre_empresa}} los productos y/o servicios detallados a continuación, manifestando su conformidad con lo entregado.',
    conditions_text: 'La firma del presente documento implica la aceptación de los ítems detallados en el estado en que fueron recibidos.',
    show_prices: false, show_signature: true, show_banner: true,
  },
  {
    name: 'Conformidad de recepción (consumidor final)', doc_type: 'Conformidad de recepción', operation_type: 'B2C',
    intro_text: '{{nombre_cliente}} deja constancia de haber recibido de {{nombre_empresa}} lo detallado a continuación, manifestando su conformidad.',
    conditions_text: 'La firma de este documento implica la conformidad con la recepción de lo detallado.',
    show_prices: false, show_signature: true, show_banner: true,
  },
];
