import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

// Shallow-compares the plain profile fields fetchProfile() returns, so
// setUser() can skip creating a new object when nothing actually changed —
// every context/effect keyed on `user` (DataContext, CommerceContext,
// NotificationBell, etc.) only re-runs when the profile really changed.
function sameUser(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (key === 'preferences') continue; // nested object, compared loosely below
    if (a[key] !== b[key]) return false;
  }
  return JSON.stringify(a.preferences || null) === JSON.stringify(b.preferences || null);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(prev => (sameUser(prev, currentUser) ? prev : currentUser));
      setIsAuthenticated(true);
      return currentUser;
    } catch (err) {
      console.error('checkUserAuth failed:', err);
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED fires automatically ~hourly (and often on tab focus)
      // purely to rotate the access token — supabase-js already persists
      // the new token itself. The profile row/metadata it fronts hasn't
      // changed, so re-running fetchProfile()'s 3 round trips here just to
      // throw away an identical result was pure overhead, and every
      // context keyed on `user` was re-fetching along with it.
      if (event === 'TOKEN_REFRESHED') return;
      checkUserAuth();
    });
    return () => sub.subscription.unsubscribe();
  }, [checkUserAuth]);

  const logout = (shouldRedirect = true) => {
    base44.auth.logout(shouldRedirect ? '/login' : undefined);
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
