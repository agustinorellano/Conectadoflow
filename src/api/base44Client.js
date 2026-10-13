import { supabase } from '@/lib/supabaseClient';
import { makeEntity } from '@/api/makeEntity';
import { ENTITY_TABLES } from '@/api/entityNames';

// Drop-in replacement for the Base44 SDK client, backed by Supabase.
// Keeps the same `base44.entities.X` / `base44.auth.X` shape so existing
// page code (written against the Base44 SDK) needs no changes beyond this file.

const entities = Object.fromEntries(
  Object.entries(ENTITY_TABLES).map(([name, table]) => [name, makeEntity(table)])
);

async function fetchProfile(authUser) {
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();
  const meta = authUser.user_metadata || {};

  let organizationActive = true;
  if (profile?.organization_id) {
    const { data: org } = await supabase.from('organizations').select('is_active').eq('id', profile.organization_id).maybeSingle();
    if (org && org.is_active === false) organizationActive = false;
  }
  const { data: isPlatformAdmin } = await supabase.rpc('is_platform_admin');

  return {
    id: authUser.id,
    email: authUser.email,
    full_name: profile?.full_name || meta.full_name || authUser.email,
    role: profile?.role || 'user',
    organization_id: profile?.organization_id || null,
    organization_active: organizationActive,
    is_platform_admin: !!isPlatformAdmin,
    phone: meta.phone || '',
    position: meta.position || '',
    bio: meta.bio || '',
    avatar_url: meta.avatar_url || '',
    preferences: meta.preferences || null,
  };
}

const auth = {
  async me() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    return fetchProfile(data.user);
  },

  async loginViaEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async loginWithProvider(provider, returnTo = '/') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + returnTo },
    });
    if (error) throw error;
  },

  async register({ email, password, full_name }) {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
    if (error) throw error;
  },

  // Requires the Supabase project's "Confirm signup" email template to use
  // {{ .Token }} (the 6-digit OTP) instead of the default confirmation link.
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (error) throw error;
    return { access_token: data?.session?.access_token };
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  setToken() {
    // No-op: supabase-js already persists the session from verifyOtp/signIn.
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
  },

  // Called once the user already has an active recovery session
  // (established by Supabase when they follow the emailed reset link).
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) window.location.href = redirectUrl;
  },

  redirectToLogin(returnTo) {
    window.location.href = '/login' + (returnTo && returnTo !== '/' ? '?returnTo=' + encodeURIComponent(returnTo) : '');
  },

  // Multi-tenant signup: creates a new organization and makes the current
  // user its admin. Call once, right after registration, before creating
  // any AppConfig/Commerce rows (those need organization_id to already be set).
  async createOrganization(name) {
    const { data, error } = await supabase.rpc('create_organization', { org_name: name });
    if (error) throw error;
    return data; // new organization id
  },

  // Stores free-form profile fields (phone, position, bio, preferences) in
  // the Supabase auth user's metadata, and mirrors full_name onto `profiles`
  // if given (that column drives name display elsewhere in the app).
  async updateMe(fields) {
    const { full_name, ...rest } = fields;
    const { data: userData } = await supabase.auth.getUser();
    const currentMeta = userData?.user?.user_metadata || {};
    const { error } = await supabase.auth.updateUser({ data: { ...currentMeta, full_name, ...rest } });
    if (error) throw error;
    if (full_name && userData?.user?.id) {
      await supabase.from('profiles').update({ full_name }).eq('id', userData.user.id);
    }
  },
};

async function currentOrgId() {
  const { data: userData } = await supabase.auth.getUser();
  return (await fetchProfile(userData?.user))?.organization_id || 'misc';
}

const integrations = {
  Core: {
    // Uploads to the public-files Storage bucket (created by 0001_init.sql)
    // and returns a permanent public URL, matching Base44's UploadPublicFile shape.
    async UploadPublicFile({ file }) {
      const orgId = await currentOrgId();
      const ext = file.name.split('.').pop();
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('public-files').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('public-files').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },

    // Uploads to the private-files bucket (0003_private_storage.sql). Only
    // org members can read it, and only via a short-lived signed URL.
    async UploadPrivateFile({ file }) {
      const orgId = await currentOrgId();
      const ext = file.name.split('.').pop();
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('private-files').upload(path, file);
      if (error) throw error;
      return { file_uri: path };
    },

    async CreateFileSignedUrl({ file_uri }) {
      const { data, error } = await supabase.storage.from('private-files').createSignedUrl(file_uri, 300);
      if (error) throw error;
      return { signed_url: data.signedUrl };
    },

    // Same bucket/RLS as UploadPrivateFile, but takes a Blob (what jsPDF's
    // doc.output('blob') gives us) instead of a File, since a Blob has no
    // .name to derive a path/extension from.
    async UploadPrivateBlob({ blob, filename = 'documento.pdf' }) {
      const orgId = await currentOrgId();
      const ext = filename.split('.').pop() || 'pdf';
      const path = `${orgId}/documents/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('private-files').upload(path, blob, { contentType: blob.type || 'application/pdf' });
      if (error) throw error;
      return { file_uri: path };
    },

    // Longer-lived signed URL for sharing a generated document by WhatsApp
    // or email (a link, since neither can attach a file from the browser
    // without a backend) — 3 days by default instead of the 5-minute one
    // used for inline "download this" links elsewhere.
    async CreateDocumentSignedUrl({ file_uri, expiresIn = 259200 }) {
      const { data, error } = await supabase.storage.from('private-files').createSignedUrl(file_uri, expiresIn);
      if (error) throw error;
      return { signed_url: data.signedUrl };
    },
  },
};

// Atomic per-org, per-type document numbering (public.next_document_number,
// 0018_document_generator.sql) — never computed client-side, to avoid two
// sellers generating documents at the same moment landing on the same number.
const documents = {
  async nextNumber(docType) {
    const { data, error } = await supabase.rpc('next_document_number', { p_doc_type: docType });
    if (error) throw error;
    return data;
  },
};

// Platform-level admin API — only works for emails listed in
// public.platform_admins (see 0006_platform_admin.sql); every RPC call
// re-checks that server-side and throws for anyone else.
const admin = {
  // search/industry/mode/minUsers combinables; sort en {name, member_count,
  // sales_count, total_revenue, created_date}. Devuelve también
  // total_count (misma cifra en cada fila, vía count(*) over()) para
  // poder paginar sin una segunda consulta.
  async listOrganizations({ search, industry, mode, minUsers, sort = 'created_date', sortDir = 'desc', page = 1, pageSize = 20 } = {}) {
    const { data, error } = await supabase.rpc('admin_list_organizations', {
      p_search: search || null, p_industry: industry || null, p_mode: mode || null,
      p_min_users: minUsers || null, p_sort: sort, p_sort_dir: sortDir,
      p_page: page, p_page_size: pageSize,
    });
    if (error) throw error;
    return { rows: data || [], total: data?.[0]?.total_count ?? 0 };
  },
  async listUsers() {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) throw error;
    return data || [];
  },
  async setOrganizationActive(orgId, active) {
    const { error } = await supabase.rpc('admin_set_organization_active', { org_id: orgId, active });
    if (error) throw error;
  },

  // Ficha detallada de una organización (Panel de Administración Global,
  // Etapa 3 — ver 0037_admin_organization_detail.sql). Cada pestaña de la
  // ficha es una de estas llamadas, para no traer todo de una.
  async getOrganization(orgId) {
    const { data, error } = await supabase.rpc('admin_get_organization', { p_org_id: orgId });
    if (error) throw error;
    return data?.[0] || null;
  },
  async listOrganizationMembers(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_members', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  async listOrganizationCommerces(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_commerces', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  async listOrganizationBranches(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_branches', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  async listOrganizationProducts(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_products', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  async listOrganizationSales(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_sales', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  async listOrganizationLeads(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_leads', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  async listOrganizationClients(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_clients', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },

  // Reportes e incidencias (Panel de Administración Global, Etapa 5 — ver
  // 0038_support_reports.sql). Crear/ver un reporte es una entidad normal
  // (base44.entities.SupportReport, scoped por RLS a la propia
  // organización); cambiar el estado es admin-only y queda auditado.
  async listReports({ status } = {}) {
    const { data, error } = await supabase.rpc('admin_list_reports', { p_status: status || null });
    if (error) throw error;
    return data || [];
  },
  async listOrganizationReports(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_reports', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  async updateReportStatus(reportId, status, resolutionNotes) {
    const { error } = await supabase.rpc('admin_update_report_status', {
      p_report_id: reportId, p_status: status, p_resolution_notes: resolutionNotes || null,
    });
    if (error) throw error;
  },
  async listOrganizationAuditLog(orgId) {
    const { data, error } = await supabase.rpc('admin_list_organization_audit_log', { p_org_id: orgId });
    if (error) throw error;
    return data || [];
  },
  // orgIds null/undefined = broadcast a toda la plataforma; un array = esas
  // organizaciones puntuales (una sola, o un grupo armado con los filtros
  // del listado — Etapa 6).
  async countNotificationTargets(orgIds) {
    const { data, error } = await supabase.rpc('admin_count_notification_targets', { org_ids: orgIds || null });
    if (error) throw error;
    return data?.[0] || { org_count: 0, user_count: 0 };
  },
  async sendNotification(orgIds, title, message) {
    const { data, error } = await supabase.rpc('admin_send_notification', {
      org_ids: orgIds || null, notif_title: title, notif_message: message,
    });
    if (error) throw error;
    return data; // number of notifications created
  },
  // Borra TODO lo de una organización: datos, miembros y sus cuentas de
  // login. El propio backend (delete_organization) valida que quien llama
  // sea admin de plataforma o admin de esa misma organización — se usa
  // tanto desde el Panel de administración como desde "Eliminar mi
  // organización" en Configuración.
  async deleteOrganization(orgId) {
    const { error } = await supabase.rpc('delete_organization', { org_id: orgId });
    if (error) throw error;
  },

  // Panel de Administración Global — gestión de quién tiene acceso de
  // superadministrador (ver 0035_platform_admin_hardening.sql). Reemplaza
  // el INSERT manual por SQL que se usaba para dar de alta el primer admin.
  async listPlatformAdmins() {
    const { data, error } = await supabase.rpc('admin_list_platform_admins');
    if (error) throw error;
    return data || [];
  },
  async grantPlatformAdmin(email) {
    const { error } = await supabase.rpc('admin_grant_platform_admin', { target_email: email });
    if (error) throw error;
  },
  async revokePlatformAdmin(email) {
    const { error } = await supabase.rpc('admin_revoke_platform_admin', { target_email: email });
    if (error) throw error;
  },
  async listAuditLog(limit = 100) {
    const { data, error } = await supabase.rpc('admin_list_audit_log', { limit_count: limit });
    if (error) throw error;
    return data || [];
  },
};

// supabase-js's FunctionsHttpError puts the Edge Function's JSON body (the
// {error: "..."} we actually want to show) inside error.context, which is
// the raw fetch Response — not already parsed. Reading error.context?.error
// directly (like this used to) silently grabs nothing, so every failure
// surfaced as the generic "Edge Function returned a non-2xx status code"
// instead of the real reason. This reads the body properly.
async function extractEdgeFunctionError(error, data, fallback) {
  if (data?.error) return data.error;
  if (error?.context?.json) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch { /* body wasn't JSON — fall through */ }
  }
  return error?.message || fallback;
}

const users = {
  // Creates the account directly with a password the admin chose, then
  // assigns the new profile to the caller's organization/role, via the
  // invite-user Edge Function (needs the service-role key, so it can't
  // run in the browser).
  async inviteUser(email, role, password, fullName) {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, role, password, full_name: fullName },
    });
    if (error) throw new Error(await extractEdgeFunctionError(error, data, 'No se pudo invitar'));
    if (data?.error) throw new Error(data.error);
    return data;
  },

  // Nadie puede leer la contraseña actual de un miembro — Supabase no la
  // guarda de forma reversible. Lo que sí puede hacer un admin es ponerle
  // una nueva, para dársela de nuevo si la perdió.
  async resetMemberPassword(userId, password) {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { action: 'reset_password', user_id: userId, password },
    });
    if (error) throw new Error(await extractEdgeFunctionError(error, data, 'No se pudo restablecer la contraseña'));
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// Facturación electrónica con ARCA (ex AFIP) — ver supabase/migrations/0031.
const fiscal = {
  // Guarda (o reemplaza) el certificado digital de la organización. Viaja
  // una sola vez a una función de Postgres que lo encripta antes de
  // tocar disco; nunca se vuelve a leer en texto plano desde el cliente.
  async saveArcaCredentials({ cuit, puntoVenta, environment, certificate, privateKey }) {
    const { error } = await supabase.rpc('arca_store_credentials', {
      cuit_in: cuit, punto_venta_in: puntoVenta, environment_in: environment,
      certificate_in: certificate, private_key_in: privateKey,
    });
    if (error) throw error;
  },
  // Dispara la generación de la factura real contra ARCA para una venta.
  async generateInvoice(saleId) {
    const { data, error } = await supabase.functions.invoke('arca-invoice', {
      body: { sale_id: saleId },
    });
    if (error) {
      const message = await extractEdgeFunctionError(error, data, 'No se pudo generar la factura');
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

export const base44 = { entities, auth, integrations, users, admin, documents, fiscal };
