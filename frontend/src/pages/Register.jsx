import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref"); // wedding_id from a partner's invite link, if any
  const [form, setForm] = useState({ name: "", phone: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Nama wajib diisi");
    if (!form.phone.trim()) return toast.error("Nomor HP wajib diisi");
    if (form.password.length < 6) return toast.error("Password minimal 6 karakter");
    if (form.password !== form.confirm) return toast.error("Konfirmasi password tidak cocok");

    setLoading(true);
    try {
      await api.post("/auth/register", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
        ref: ref || null,
      });
      setDone(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Pendaftaran gagal");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="max-w-sm w-full text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <Heart className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-2xl mb-2">Pendaftaran berhasil</h1>
          <p className="text-muted-foreground mb-6">Akun Anda sedang menunggu persetujuan admin. Silakan coba login setelah disetujui.</p>
          <Link to="/login"><Button className="rounded-full w-full">Kembali ke halaman login</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form onSubmit={submit} className="max-w-sm w-full">
        <div className="mb-8 flex items-center gap-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Heart className="h-5 w-5" />
          </div>
          <span className="font-serif text-2xl">Weddly</span>
        </div>
        <h2 className="font-serif text-3xl mb-2">Daftar akun</h2>
        <p className="text-muted-foreground mb-6">Isi data di bawah untuk membuat akun baru.</p>

        {ref && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Anda mendaftar melalui undangan pasangan. Setelah disetujui admin, akun Anda akan otomatis tergabung ke workspace pernikahan yang sama.</span>
          </div>
        )}

        <div className="space-y-3">
          <div><Label>Nama lengkap</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Nomor HP</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08123456789" /></div>
          <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><Label>Konfirmasi password</Label><Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></div>
        </div>

        <Button type="submit" disabled={loading} className="w-full h-12 rounded-full mt-6">
          {loading ? "Memproses..." : "Daftar"}
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Sudah punya akun? <Link to="/login" className="text-primary font-medium">Masuk</Link>
        </p>
      </form>
    </div>
  );
}
