import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { DataProvider } from '@/lib/DataContext';
import { CommerceProvider } from '@/lib/CommerceContext';
import Layout from '@/components/Layout';

// Pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import Import from '@/pages/Import';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import Pipeline from '@/pages/Pipeline';
import Meetings from '@/pages/Meetings';
import Sales from '@/pages/Sales';
import Payments from '@/pages/Payments';
import Documents from '@/pages/Documents';
import Communication from '@/pages/Communication';
import Analytics from '@/pages/Analytics';
import Team from '@/pages/Team';
import SettingsPage from '@/pages/Settings';
import Profile from '@/pages/Profile';
import Reports from '@/pages/Reports';
import Products from '@/pages/Products';
import SuperAdmin from '@/pages/SuperAdmin';

const AuthenticatedApp = () => {
  // Only the very first auth check (before authChecked is ever set) should
  // block the whole app behind a spinner. A later re-check — e.g. Supabase
  // revalidating the session when the tab regains focus — sets
  // isLoadingAuth again too, and gating on that unmounted every open
  // modal/form in the app each time the user switched tabs and came back.
  const { authChecked } = useAuth();

  if (!authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <DataProvider>
      <CommerceProvider>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/importar" element={<Import />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/clientes/:id" element={<ClientDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/reuniones" element={<Meetings />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/cobros" element={<Payments />} />
          <Route path="/documentos" element={<Documents />} />
          <Route path="/comunicacion" element={<Communication />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/equipo" element={<Team />} />
          <Route path="/configuracion" element={<SettingsPage />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/super-admin" element={<SuperAdmin />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </CommerceProvider>
    </DataProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/*" element={<AuthenticatedApp />} />
            </Route>
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
