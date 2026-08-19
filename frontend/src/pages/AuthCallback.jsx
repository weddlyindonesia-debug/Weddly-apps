import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/login", { replace: true }); return; }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        await api.post("/auth/session", { session_id });
        // Clear hash
        window.history.replaceState(null, "", window.location.pathname);
        const data = await refresh();
        if (!data?.membership) navigate("/activate", { replace: true });
        else if (!data?.wedding?.setup_complete) navigate("/setup", { replace: true });
        else navigate("/dashboard", { replace: true });
      } catch (e) {
        navigate("/login?error=session", { replace: true });
      }
    })();
  }, [location.hash, navigate, refresh]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Signing you in…
      </div>
    </div>
  );
}
