import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Sparkles, ShieldCheck } from "lucide-react";
import { useT } from "@/context/LanguageContext";
import LanguageToggle from "@/components/app/LanguageToggle";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { t } = useT();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [heroLine1, heroLine2] = t("brand.tagline_hero").split("\n");

  const submit = async (e) => {
    e.preventDefault();
    if (!form.phone.trim() || !form.password) return toast.error("Nomor HP dan password wajib diisi");
    setLoading(true);
    try {
      await api.post("/auth/login", form);
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid md:grid-cols-2 relative">
      <div className="absolute top-4 right-4 z-30 md:top-6 md:right-6">
        <LanguageToggle />
      </div>
      <div className="relative hidden md:block">
        <img
          src="https://images.unsplash.com/photo-1617785258979-b50ebd43871e?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85"
          alt="Wedding aesthetic"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/25 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-2 text-lg font-serif tracking-wide">
            <Heart className="h-5 w-5" /> Weddly
          </div>
          <div>
            <h1 className="font-serif text-4xl lg:text-5xl leading-tight mb-3">{heroLine1}<br/>{heroLine2}</h1>
            <p className="text-white/85 max-w-md">{t("brand.tagline_sub")}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 md:p-16 bg-background">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Heart className="h-5 w-5" />
            </div>
            <span className="font-serif text-2xl">Weddly</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl mb-3">{t("login.welcome")}</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Masuk dengan nomor HP dan password Anda.
          </p>

          <div className="space-y-3 mb-6">
            <div><Label>Nomor HP</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08123456789" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-12 rounded-full text-base font-medium">
            {loading ? "Memproses..." : "Masuk"}
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Belum punya akun? <Link to="/register" className="text-primary font-medium">Daftar</Link>
          </p>

          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /> {t("login.secure_note")}</div>
            <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-primary" /> {t("login.license_note")}</div>
          </div>
        </form>
      </div>
    </div>
  );
}