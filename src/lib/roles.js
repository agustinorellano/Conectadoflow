// Central role/permission matrix for the 4-role model. Mirrors what
// supabase/migrations/0013_role_permissions.sql actually enforces at the
// database level for data access — this file additionally gates which
// PAGES each role can open, for routes (Analytics, Reportes, Equipo,
// Configuración) that have no dedicated table of their own to lock down
// at the RLS layer (they read data other pages legitimately need too).

export const ROLE_LABELS = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Vendedor',
  viewer: 'Consulta',
};

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador', desc: 'Acceso total: usuarios, configuración, todo el equipo.' },
  { value: 'manager', label: 'Gerente', desc: 'Ve el equipo, asigna leads, consulta analytics.' },
  { value: 'user', label: 'Vendedor', desc: 'Gestiona su cartera: leads, clientes, ventas, pagos.' },
  { value: 'viewer', label: 'Consulta', desc: 'Visualiza información autorizada, sin modificar.' },
];

// Paths with no entry here are open to every role. Keep in sync with the
// matrix shared with the user: Cobros/Analytics/Reportes closed to
// Vendedor+Consulta, Equipo closed to Vendedor+Consulta, Configuración
// admin-only.
const PAGE_ROLES = {
  '/cobros': ['admin', 'manager'],
  '/analytics': ['admin', 'manager'],
  '/reportes': ['admin', 'manager'],
  '/equipo': ['admin', 'manager'],
  '/configuracion': ['admin'],
};

export function canAccessPath(role, path) {
  const allowed = PAGE_ROLES[path];
  if (!allowed) return true;
  return allowed.includes(role || 'user');
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Vendedor';
}
