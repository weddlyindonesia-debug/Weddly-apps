import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { applyTheme } from "@/lib/themes";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, membership: null, wedding: null, isAdmin: false });

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setState({ loading: false, user: data.user, membership: data.membership, wedding: data.wedding, isAdmin: !!data.is_admin });
      if (data.wedding?.theme_id) applyTheme(data.wedding.theme_id);
      return data;
    } catch (e) {
      setState({ loading: false, user: null, membership: null, wedding: null, isAdmin: false });
      return null;
    }
  }, []);

  useEffect(() => {
    // If returning from OAuth, let AuthCallback handle it
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    refresh();
  }, [refresh]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setState({ loading: false, user: null, membership: null, wedding: null, isAdmin: false });
    window.location.href = "/login";
  };

  return (
    <AuthCtx.Provider value={{ ...state, refresh, logout, setState }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
