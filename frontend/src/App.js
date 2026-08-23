import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Activate from "@/pages/Activate";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";
import Checklist from "@/pages/Checklist";
import Budget from "@/pages/Budget";
import Guests from "@/pages/Guests";
import Vendors from "@/pages/Vendors";
import Timeline from "@/pages/Timeline";
import AI from "@/pages/AI";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import AppShell from "@/components/app/AppShell";
import { Loader2 } from "lucide-react";

function Protected({ children, requireWedding = true, requireSetup = true }) {
  const { loading, user, wedding, membership } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireWedding && !membership) return <Navigate to="/activate" replace />;
  if (requireSetup && wedding && !wedding.setup_complete) return <Navigate to="/setup" replace />;
  return children;
}

function AdminGuard({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function Router() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/activate" element={<Protected requireWedding={false} requireSetup={false}><Activate /></Protected>} />
      <Route path="/setup" element={<Protected requireSetup={false}><Setup /></Protected>} />
      <Route path="/dashboard" element={<Protected><AppShell><Dashboard /></AppShell></Protected>} />
      <Route path="/checklist" element={<Protected><AppShell><Checklist /></AppShell></Protected>} />
      <Route path="/budget" element={<Protected><AppShell><Budget /></AppShell></Protected>} />
      <Route path="/guests" element={<Protected><AppShell><Guests /></AppShell></Protected>} />
      <Route path="/vendors" element={<Protected><AppShell><Vendors /></AppShell></Protected>} />
      <Route path="/timeline" element={<Protected><AppShell><Timeline /></AppShell></Protected>} />
      <Route path="/ai" element={<Protected><AppShell><AI /></AppShell></Protected>} />
      <Route path="/settings" element={<Protected><AppShell><Settings /></AppShell></Protected>} />
      <Route path="/admin" element={<Protected requireWedding={false} requireSetup={false}><AdminGuard><AppShell><Admin /></AppShell></AdminGuard></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <Router />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </div>
  );
}