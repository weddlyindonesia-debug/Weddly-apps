import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

function formatToken(v) {
  const clean = (v || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const b = clean.startsWith("WDL") ? clean.slice(3) : clean;
  const parts = [b.slice(0, 4), b.slice(4, 8), b.slice(8, 12)].filter(Boolean);
  return "WDL-" + parts.join("-");
}

export default function Activate() {
  const [value, setValue] = useState("WDL-");
  const [loading, setLoading] = useState(false);
  const { refresh, logout, user } = useAuth();
  const navigate = useNavigate();

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/wedding/activate", { token_code: value });
      toast.success("Workspace unlocked! Let's set up your wedding.");
      await refresh();
      if (data?.wedding?.setup_complete) navigate("/dashboard");
      else navigate("/setup");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not activate token");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-background">
      <Card className="w-full max-w-lg p-8 md:p-10 rounded-2xl shadow-sm">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl mb-2">Activate your Weddly workspace</h1>
        <p className="text-muted-foreground mb-6">Enter the access token from your Lynk purchase. Format: <span className="font-mono">WDL-XXXX-XXXX-XXXX</span></p>
        {user && (
          <p className="text-xs text-muted-foreground mb-4">Signed in as <span className="font-medium">{user.email}</span> · <button className="underline" onClick={logout}>use a different account</button></p>
        )}
        <div className="space-y-3">
          <Input
            data-testid="token-input"
            value={value}
            onChange={(e) => setValue(formatToken(e.target.value))}
            className="h-12 text-lg font-mono tracking-widest"
            maxLength={19}
            placeholder="WDL-XXXX-XXXX-XXXX"
          />
          <Button
            data-testid="redeem-token-button"
            disabled={loading || value.length < 19}
            onClick={submit}
            className="w-full h-12 rounded-full text-base"
          >
            {loading ? "Activating…" : "Redeem & unlock workspace"}
          </Button>
          <button
            data-testid="sandbox-token-btn"
            className="w-full text-sm text-primary hover:underline inline-flex items-center justify-center gap-1"
            onClick={() => setValue("WDL-DEMO-2026-LOVE")}
          >
            <Sparkles className="h-3.5 w-3.5" /> Use sandbox demo token
          </button>
        </div>
        <div className="mt-8 text-xs text-muted-foreground">
          Each token activates one workspace shared by two partners. Ask your partner to sign in with Google and enter the same token to join.
        </div>
      </Card>
    </div>
  );
}
