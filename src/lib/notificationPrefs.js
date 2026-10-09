// Per-browser notification state (descartadas / pospuestas). La mayoría de
// los items de la campanita son sintéticos — se recalculan en cada render a
// partir de pagos/leads/actividades reales, no son filas propias en la
// base — así que "descartar" u "recordar más tarde" es inherentemente un
// estado de esta sesión/navegador, no un dato de negocio para guardar en
// Supabase. localStorage alcanza y evita una tabla + RLS nueva solo para esto.
const KEY = 'cf_notification_prefs_v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { dismissed: {}, snoozedUntil: {} };
  } catch {
    return { dismissed: {}, snoozedUntil: {} };
  }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore quota/private-mode errors */ }
}

export const SNOOZE_OPTIONS = [
  { key: '1h', label: '1 hora', ms: 60 * 60 * 1000 },
  { key: 'tomorrow', label: 'Mañana', ms: 24 * 60 * 60 * 1000 },
  { key: '3d', label: 'En 3 días', ms: 3 * 24 * 60 * 60 * 1000 },
];

export function isHidden(id) {
  const state = read();
  if (state.dismissed[id]) return true;
  const until = state.snoozedUntil[id];
  if (until && until > Date.now()) return true;
  return false;
}

export function dismiss(id) {
  const state = read();
  state.dismissed[id] = true;
  delete state.snoozedUntil[id];
  write(state);
}

export function snooze(id, ms) {
  const state = read();
  state.snoozedUntil[id] = Date.now() + ms;
  write(state);
}
