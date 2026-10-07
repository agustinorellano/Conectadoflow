// Shared helpers for Conectado Flow

export const CURRENCY_SYMBOLS = {
  ARS: '$',
  USD: 'US$',
  EUR: '€',
};

export function formatCurrency(amount, currency = 'ARS') {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  const n = Number(amount) || 0;
  return `${symbol}${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export function formatNumber(n) {
  return (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return formatDateShort(dateStr);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  return d.getTime() < Date.now();
}

// Period filter helpers. `period` is either a preset key ('month', '7d', …)
// or a custom { start, end } range (Date instances or date strings) picked
// from DateRangePicker — both go through the same inPeriod()/variation()
// call sites unchanged.
export function getPeriodRange(period) {
  if (period && typeof period === 'object' && period.start && period.end) {
    const start = new Date(period.start); start.setHours(0, 0, 0, 0);
    const end = new Date(period.end); end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      break;
    case '7d':
      start.setDate(start.getDate() - 6);
      break;
    case '30d':
      start.setDate(start.getDate() - 29);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '3m':
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

export function inPeriod(dateStr, period) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  const { start, end } = getPeriodRange(period);
  return d >= start && d <= end;
}

export function previousPeriodAmount(items, dateField, valueField, period) {
  const now = new Date();
  let pStart, pEnd;
  if (period && typeof period === 'object' && period.start && period.end) {
    const { start, end } = getPeriodRange(period);
    const durationMs = end.getTime() - start.getTime();
    pEnd = new Date(start.getTime() - 1);
    pStart = new Date(pEnd.getTime() - durationMs);
    return items
      .filter(i => { const d = new Date(i[dateField]); return d >= pStart && d <= pEnd; })
      .reduce((s, i) => s + (Number(i[valueField]) || 0), 0);
  }
  switch (period) {
    case 'today':
      pStart = new Date(now); pStart.setDate(pStart.getDate() - 1); pStart.setHours(0,0,0,0);
      pEnd = new Date(now); pEnd.setDate(pEnd.getDate() - 1); pEnd.setHours(23,59,59,999);
      break;
    case '7d':
      pStart = new Date(now); pStart.setDate(pStart.getDate() - 13); pStart.setHours(0,0,0,0);
      pEnd = new Date(now); pEnd.setDate(pEnd.getDate() - 7); pEnd.setHours(23,59,59,999);
      break;
    case '30d':
      pStart = new Date(now); pStart.setDate(pStart.getDate() - 59); pStart.setHours(0,0,0,0);
      pEnd = new Date(now); pEnd.setDate(pEnd.getDate() - 30); pEnd.setHours(23,59,59,999);
      break;
    case 'month':
      pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case '3m':
      pStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      pEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59, 999);
      break;
    case 'year':
      pStart = new Date(now.getFullYear() - 1, 0, 1);
      pEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    default:
      pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }
  return items
    .filter(i => { const d = new Date(i[dateField]); return d >= pStart && d <= pEnd; })
    .reduce((s, i) => s + (Number(i[valueField]) || 0), 0);
}

export function variation(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

// WhatsApp
export function buildWhatsAppUrl(phone, message) {
  let clean = (phone || '').replace(/[^\d]/g, '');
  if (clean && !clean.startsWith('54') && clean.length < 12) {
    clean = '54' + clean;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function fillTemplate(body, vars) {
  return (body || '')
    .replace(/\{nombre\}/g, vars.nombre || '')
    .replace(/\{empresa\}/g, vars.empresa || '')
    .replace(/\{producto\}/g, vars.producto || '')
    .replace(/\{monto\}/g, vars.monto || '')
    .replace(/\{fecha\}/g, vars.fecha || '')
    .replace(/\{hora\}/g, vars.hora || '')
    .replace(/\{vendedor\}/g, vars.vendedor || '');
}

export const LEAD_SOURCES = ['WhatsApp','Instagram','Facebook','Web','Referido','Evento','Local','LinkedIn','Publicidad','Otro'];
export const MEETING_TYPES = ['Presencial','Videollamada','Teléfono','WhatsApp','Otro'];
export const PAYMENT_METHODS = ['Efectivo','Transferencia','Tarjeta','Billetera virtual','Débito','Crédito','Mercado Pago','Cuotas','Otro'];
export const PAYMENT_TYPES = ['Efectivo','Transferencia','Tarjeta','Billetera virtual','Débito','Crédito','Otro'];
export const CARD_TYPES = ['Visa','Mastercard','American Express','Cabal','Naranja','Otra'];
export const CARD_BRANDS = ['Crédito','Débito'];
export const INSTALLMENT_OPTIONS = [1,2,3,6,9,12,18,24];
export const ENTITY_TYPES = ['Banco','Billetera','Tarjeta','Fintech','Otros'];
export const DEFAULT_BANKS = ['Santander','BBVA','Galicia','ICBC','HSBC','Macro','Nación','Provincia','Otros'];
export const DEFAULT_WALLETS = ['Mercado Pago','Naranja X','Personal Pay','MODO','Ualá','Cuenta DNI','Otros'];
export const SALE_STATUS = ['Pendiente','Confirmada','Cancelada'];
export const PAYMENT_STATUS = ['Pendiente','Parcial','Pagado','Vencido','Cancelado'];
export const CLIENT_TYPES = ['Consumidor','Empresa'];

export const STAGE_COLORS = {
  'Nuevo lead': '#94a3b8',
  'Contactado': '#6366f1',
  'Calificado': '#8b5cf6',
  'Reunión': '#0ea5e9',
  'Propuesta': '#f59e0b',
  'Negociación': '#f97316',
  'Ganado': '#22c55e',
  'Perdido': '#ef4444',
};

export function stageColor(name) {
  return STAGE_COLORS[name] || '#64748b';
}
