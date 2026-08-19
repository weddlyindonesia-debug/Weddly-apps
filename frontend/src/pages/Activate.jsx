import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useT } from "@/context/LanguageContext";
import LanguageToggle from "@/components/app/LanguageToggle";

function extractBody(v) {
  const clean = (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const b = clean.startsWith("WDL") ? clean.slice(3) : clean;
  return b.slice(0, 12);
}

export default function Activate() {
  const { t } = useT();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const { refresh, logout, user } = useAuth();
  const navigate = useNavigate();

  const tokenCode = "WDL-" + [body.slice(0, 4), body.slice(4, 8), body.slice(8, 12)].filter(Boolean).join("-");

  const submit = async () => {
    if (body.length < 12) return;
    setLoading(true);
    try {
      const { data } = await api.post("/wedding/activate", { token_code: tokenCode });
      toast.success(t("activate.success_toast"));
      await refresh();
      if (data?.wedding?.setup_complete) navigate("/dashboard");
      else navigate("/setup");
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("activate.error_toast"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-background relative">
      <div className="absolute top-4 right-4"><LanguageToggle /></div>
      <Card className="w-full max-w-lg p-8 md:p-10 rounded-2xl shadow-sm">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl mb-2">{t("activate.title")}</h1>
        <p className="text-muted-foreground mb-6">
          {t("activate.subtitle")} <span className="font-mono">WDL-XXXX-XXXX-XXXX</span>
        </p>
        {user && (
          <p className="text-xs text-muted-foreground mb-4">
            {t("activate.signed_in_as")} <span className="font-medium">{user.email}</span> ·{" "}
            <button className="underline" onClick={logout}>{t("activate.use_different")}</button>
          </p>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-3 justify-center flex-wrap">
            <span className="font-mono text-lg font-semibold text-muted-foreground select-none">WDL-</span>
            <InputOTP
              data-testid="token-input"
              maxLength={12}
              value={body}
              onChange={(v) => setBody(extractBody(v))}
              pattern="^[A-Za-z0-9]+$"
              pasteTransformer={(raw) => extractBody(raw)}
              inputMode="text"
              containerClassName="gap-2"
            >
              <InputOTPGroup>
                {[0, 1, 2, 3].map((i) => (<InputOTPSlot key={i} index={i} className="h-11 w-9 text-base font-mono uppercase" />))}
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                {[4, 5, 6, 7].map((i) => (<InputOTPSlot key={i} index={i} className="h-11 w-9 text-base font-mono uppercase" />))}
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                {[8, 9, 10, 11].map((i) => (<InputOTPSlot key={i} index={i} className="h-11 w-9 text-base font-mono uppercase" />))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="text-center text-xs text-muted-foreground font-mono" data-testid="token-preview">
            {body.length === 0 ? "WDL-XXXX-XXXX-XXXX" : tokenCode}
          </div>
          <Button data-testid="redeem-token-button" disabled={loading || body.length < 12} onClick={submit} className="w-full h-12 rounded-full text-base">
            {loading ? t("activate.activating") : t("activate.redeem_btn")}
          </Button>
          <button
            data-testid="sandbox-token-btn"
            className="w-full text-sm text-primary hover:underline inline-flex items-center justify-center gap-1"
            onClick={() => setBody("DEMO2026LOVE")}
          >
            <Sparkles className="h-3.5 w-3.5" /> {t("activate.use_sandbox")}
          </button>
        </div>
        <div className="mt-8 text-xs text-muted-foreground">{t("activate.footer_note")}</div>
      </Card>
    </div>
  );
}
