import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  // Same reasoning as AuthenticatedApp in App.jsx: gate only on the first
  // ever check, not on isLoadingAuth — that one flips true again on every
  // background re-check (e.g. tab regaining focus), which would otherwise
  // unmount the whole routed page (and whatever form/modal was open in it)
  // each time.
  const { isAuthenticated, authChecked } = useAuth();

  if (!authChecked) {
    return fallback;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}
