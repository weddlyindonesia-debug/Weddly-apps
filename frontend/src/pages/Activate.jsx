import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Clock, RefreshCw, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Activate() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  const navigating = useRef(false);

  const goToWorkspace = (data) => {
    if (navigating.current) return;
    navigating.current = true;
    navigate(data.wedding?.setup_complete ? "/dashboard" : "/setup", { replace: true });
  };

  // Cek status; hanya pindah halaman jika akun sudah disetujui.
  const checkStatus = async () => {
    setChecking(true);
    try {
      const data = await refresh(); // tidak pernah throw; null = gagal cek
      if (!data?.user) {
        toast.error("Sesi berakhir. Silakan login kembali.");
        navigate("/login", { replace: true });
      } else if (data.membership) {
        goToWorkspace(data);
      } else {
        toast.info("Akun Anda masih menunggu persetujuan admin.");
      }
    } finally {
      setChecking(false);
    }
  };

  // Halaman otomatis membuka dashboard begitu admin menyetujui akun.
  useEffect(() => {
    const id = setInterval(async () => {
      const data = await refresh();
      if (data?.user && data.membership) goToWorkspace(data);
    }, 15000);
    return () => clearInterval(id);
  }, [refresh, navigate]);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="max-w-sm w-full text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-5">
          <Heart className="h-7 w-7" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-medium mb-4">
          <Clock className="h-3.5 w-3.5" /> Menunggu persetujuan
        </div>
        <h1 className="font-serif text-2xl mb-2">Akun Anda sedang diperiksa</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Pendaftaran Anda sudah kami terima dan sedang menunggu persetujuan admin.
          Halaman ini akan otomatis membuka dashboard begitu akun Anda disetujui.
        </p>
        <div className="space-y-3">
          <Button onClick={checkStatus} disabled={checking} variant="outline" className="w-full h-12 rounded-full">
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Memeriksa..." : "Periksa status"}
          </Button>
          <Button onClick={logout} variant="ghost" className="w-full h-12 rounded-full text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
        </div>
      </div>
    </div>
  );
}
