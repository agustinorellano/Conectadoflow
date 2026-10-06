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
  return {
    id: authUser.id,
    email: authUser.email,
    full_name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
    role: profile?.role || 'user',
    organization_id: profile?.organization_id || null,
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

  async register({ email, password }) {
    const { error } = await supabase.auth.signUp({ email, password });
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
};

export const base44 = { entities, auth };
