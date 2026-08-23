import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
// Hapus "Heart" dari import karena sudah tidak dipakai
import { LayoutDashboard, CheckSquare, WalletCards, Users, Briefcase, CalendarClock, Sparkles, Settings, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/context/LanguageContext";
import LanguageToggle from "@/components/app/LanguageToggle";

export default function AppShell({ children }) {
  const { user, wedding, logout, isAdmin } = useAuth();
  const { t } = useT();
  const p1 = wedding?.partner1_nickname || wedding?.partner1_name || "Partner 1";
  const p2 = wedding?.partner2_nickname || wedding?.partner2_name || "Partner 2";
  const NAV = [
    { name: t("nav.dashboard"), path: "/dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
    { name: t("nav.checklist"), path: "/checklist", icon: CheckSquare, testid: "nav-checklist" },
    { name: t("nav.budget"), path: "/budget", icon: WalletCards, testid: "nav-budget" },
    { name: t("nav.guests"), path: "/guests", icon: Users, testid: "nav-guests" },
    { name: t("nav.vendors"), path: "/vendors", icon: Briefcase, testid: "nav-vendors" },
    { name: t("nav.timeline"), path: "/timeline", icon: CalendarClock, testid: "nav-timeline" },
    { name: t("nav.ai"), path: "/ai", icon: Sparkles, testid: "nav-ai-advisor" },
    { name: t("nav.settings"), path: "/settings", icon: Settings, testid: "nav-settings" },
  ];

  return (
    // Tambahkan h-screen dan overflow-hidden agar tinggi container pas dengan layar
    <div className="h-screen flex bg-background overflow-hidden">
      
      {/* 1. PERUBAHAN SIDEBAR: Tambahkan sticky top-0 h-screen agar terkunci */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-card/60 backdrop-blur-md sticky top-0 h-screen">
        
        {/* 2. PERUBAHAN LOGO: Ganti icon hati dengan gambar logo asli */}
        <div className="p-6">
          {/* Pastikan file logo Anda bernama 'weddly-logo.png' dan ada di folder 'frontend/public' */}
          <img 
            src="/weddly-logo.png" 
            alt="Logo Weddly" 
            className="w-24 h-auto object-contain mx-auto block"
          />
        </div>

        <nav className="px-3 space-y-1 flex-1 mt-0">
          {NAV.map((n) => (
            <NavLink key={n.path} to={n.path} data-testid={n.testid} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}>
              <n.icon className="h-4 w-4" /> {n.name}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" data-testid="nav-admin" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}>
              <ShieldCheck className="h-4 w-4" /> {t("nav.admin")}
            </NavLink>
          )}
        </nav>
        
        <div className="p-3 border-t border-border space-y-2">
          <div className="px-2"><LanguageToggle /></div>
          <div className="flex items-center gap-3 px-2 py-2">
            {user?.picture ? <img src={user.picture} alt="" className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-muted" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.name || user?.email}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-btn" title={t("nav.logout")}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </aside>

      {/* Bagian konten utama bisa di-scroll */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border h-16 flex items-center justify-around px-2">
        {NAV.filter((n) => ["/dashboard", "/checklist", "/budget", "/guests", "/ai"].includes(n.path)).map((n) => (
          <NavLink key={n.path} to={n.path} data-testid={`mobile-${n.testid}`} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 text-[10px] px-2 py-1 rounded-lg ${isActive ? "text-primary" : "text-muted-foreground"}`}>
            <n.icon className="h-5 w-5" />
            {n.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}