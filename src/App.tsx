
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/contexts/PermissionsContext";
import SecurityEnhancedApp from "@/components/SecurityEnhancedApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppSidebar } from "@/components/AppSidebar";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Contacts from "./pages/Contacts";
import DealsPage from "./pages/DealsPage";
import Campaigns from "./pages/Campaigns";
import ActionItems from "./pages/ActionItems";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Access Denied component
const AccessDenied = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-md">
      <ShieldAlert className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
      <p className="text-muted-foreground">
        You don't have permission to access this page. Contact your administrator if you need access.
      </p>
    </div>
  </div>
);

// PageAccessGuard — pure in-memory check, zero network requests
const PageAccessGuard = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const { hasPageAccess, loading } = usePermissions();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPageAccess(pathname)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

// Layout Component for all pages with fixed sidebar
const FixedSidebarLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('sidebar-open') === 'true'; } catch { return false; }
  });
  const handleSidebarToggle = (open: boolean) => {
    setSidebarOpen(open);
    try { localStorage.setItem('sidebar-open', String(open)); } catch {}
  };
  const location = useLocation();
  
  const controlledScrollRoutes = ['/action-items', '/contacts', '/deals', '/campaigns', '/settings', '/notifications', '/', '/accounts'];
  const needsControlledScroll = controlledScrollRoutes.includes(location.pathname);
  
  return (
    <div className="h-screen flex w-full overflow-hidden">
      <div className="fixed top-0 left-0 z-50 h-full">
        <AppSidebar isFixed={true} isOpen={sidebarOpen} onToggle={handleSidebarToggle} />
      </div>
      <main 
        className="flex-1 bg-background h-screen overflow-hidden"
        style={{ 
          marginLeft: sidebarOpen ? '200px' : '64px',
          transition: 'margin-left 300ms ease-in-out',
          width: `calc(100vw - ${sidebarOpen ? '200px' : '64px'})`
        }}
      >
        <div className={`w-full h-full min-h-0 ${needsControlledScroll ? 'overflow-hidden' : 'overflow-auto'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <FixedSidebarLayout>
      <PageAccessGuard>
        {children}
      </PageAccessGuard>
    </FixedSidebarLayout>
  );
};

// Auth Route Component
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// App Router Component
const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/auth" element={
        <AuthRoute>
          <Auth />
        </AuthRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute>
          <Accounts />
        </ProtectedRoute>
      } />
      <Route path="/contacts" element={
        <ProtectedRoute>
          <Contacts />
        </ProtectedRoute>
      } />
      <Route path="/deals" element={
        <ProtectedRoute>
          <DealsPage />
        </ProtectedRoute>
      } />
      <Route path="/campaigns" element={
        <ProtectedRoute>
          <Campaigns />
        </ProtectedRoute>
      } />
      <Route path="/action-items" element={
        <ProtectedRoute>
          <ActionItems />
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="*" element={
        <ProtectedRoute>
          <NotFound />
        </ProtectedRoute>
      } />
    </Routes>
  </BrowserRouter>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SecurityEnhancedApp>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRouter />
        </TooltipProvider>
      </SecurityEnhancedApp>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
