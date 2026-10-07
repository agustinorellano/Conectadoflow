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
  },
};

// Platform-level admin API — only works for emails listed in
// public.platform_admins (see 0006_platform_admin.sql); every RPC call
// re-checks that server-side and throws for anyone else.
const admin = {
  async listOrganizations() {
    const { data, error } = await supabase.rpc('admin_list_organizations');
    if (error) throw error;
    return data || [];
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
  // orgId null = broadcast to every organization on the platform.
  async sendNotification(orgId, title, message) {
    const { data, error } = await supabase.rpc('admin_send_notification', {
      org_id: orgId, notif_title: title, notif_message: message,
    });
    if (error) throw error;
    return data; // number of notifications created
  },
};

const users = {
  // Sends a real Supabase auth invite + assigns the new profile to the
  // caller's organization/role, via the invite-user Edge Function (needs
  // the service-role key, so it can't run in the browser).
  async inviteUser(email, role) {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, role, redirectTo: window.location.origin + '/reset-password' },
    });
    if (error) {
      const message = data?.error || error.context?.error || error.message || 'No se pudo invitar';
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

export const base44 = { entities, auth, integrations, users, admin };
