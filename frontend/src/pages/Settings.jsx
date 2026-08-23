import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { THEMES, applyTheme } from "@/lib/themes";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import NumberInput from "@/components/app/NumberInput";
import { useT } from "@/context/LanguageContext";
import LanguageToggle from "@/components/app/LanguageToggle";

const WEDDING_TYPES = ["Akad Nikah", "Resepsi", "Pemberkatan", "Sangjit", "Lamaran", "Engagement", "Tea Pai", "Siraman", "After Party"];
const STYLES = ["Elegant", "Romantic", "Minimalist", "Modern", "Luxury", "Rustic", "Traditional", "Outdoor", "Classic"];
const COLORS = ["Ivory", "Champagne", "Blush", "Sage", "Burgundy", "Navy", "Terracotta", "Dusty Blue", "Lavender", "Not decided"];
const COMPLETED = ["Venue", "Catering", "Wedding Organizer", "Decoration", "Photography", "Videography", "Makeup Artist", "Wedding Dress", "Suit", "Invitation", "Entertainment", "MC", "Souvenir"];
const CHALLENGES = ["Managing budget", "Knowing what to do first", "Finding trusted vendors", "Managing guests", "Staying on schedule", "Coordinating with family", "Choosing wedding concept", "Managing contracts and payments", "Everything feels overwhelming"];
const PRIORITIES = ["Planning", "Budgeting", "Finding vendors", "Guest management", "Timeline", "Invitations", "AI wedding advice", "Staying organized"];

const OptionCard = ({ selected, onClick, children, testid }) => (
  <button type="button" data-testid={testid} onClick={onClick}
    className={`text-left rounded-2xl border p-4 transition-shadow duration-200 hover:shadow-md ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"}`}>{children}</button>
);

export default function Settings() {
  const { t } = useT();
  const { wedding, user, refresh, logout } = useAuth();
  
  const [form, setForm] = useState({
    partner1_name: wedding?.partner1_name || "",
    partner1_nickname: wedding?.partner1_nickname || "",
    partner2_name: wedding?.partner2_name || "",
    partner2_nickname: wedding?.partner2_nickname || "",
    wedding_date: wedding?.wedding_date || "",
    city: wedding?.city || "",
    budget_amount: wedding?.budget_amount || 0,
    guest_count: wedding?.guest_count || 0,
  });

  const [prefs, setPrefs] = useState({
    wedding_types: wedding?.wedding_types || [],
    wedding_styles: wedding?.wedding_styles || [],
    wedding_colors: wedding?.wedding_colors || [],
    completed_items: wedding?.completed_items || [],
    challenges: wedding?.challenges || [],
    priorities: wedding?.priorities || [],
  });

  // State untuk Ganti Password
  const [passForm, setPassForm] = useState({ current: "", new: "", confirm: "" });
  const [passLoading, setPassLoading] = useState(false);

  const save = async () => {
    try {
      await api.patch("/wedding", form);
      await refresh();
      toast.success(t("settings.saved"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan perubahan.");
    }
  };
  const setTheme = async (id) => {
    try {
      applyTheme(id);
      await api.patch("/wedding/theme", { theme_id: id });
      await refresh();
      toast.success(t("settings.theme_updated"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengubah tema.");
    }
  };
  const tokenMask = wedding?.token_code ? `WDL-••••-••••-${wedding.token_code.slice(-4)}` : "—";
  const copyToken = () => { if (wedding?.token_code) { navigator.clipboard.writeText(wedding.token_code); toast.success(t("settings.token_copied")); } };

  const togglePref = (field, val, max) => {
    setPrefs((p) => {
      const cur = new Set(p[field] || []);
      if (cur.has(val)) cur.delete(val); else { if (max && cur.size >= max) return p; cur.add(val); }
      return { ...p, [field]: [...cur] };
    });
  };

  const savePrefs = async () => {
    try {
      await api.patch("/wedding", prefs);
      await refresh();
      toast.success(t("settings.saved"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan preferensi.");
    }
  };

  // Fungsi Ganti Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassLoading(true);
    
    if (passForm.new !== passForm.confirm) {
      toast.error("Konfirmasi password baru tidak cocok.");
      setPassLoading(false);
      return;
    }

    try {
      // Gunakan instance axios bersama (baseURL dari REACT_APP_BACKEND_URL + withCredentials)
      await api.post("/auth/change-password", {
        current_password: passForm.current,
        new_password: passForm.new,
      });

      toast.success("Password berhasil diubah! Silakan login kembali.");
      setPassForm({ current: "", new: "", confirm: "" });

      // Karena backend sudah menghapus semua sesi, arahkan ke login
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Terjadi kesalahan koneksi ke server.");
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="mb-8"><div className="text-xs uppercase tracking-widest text-muted-foreground">{t("settings.section")}</div><h1 className="font-serif text-4xl">{t("settings.title")}</h1></div>
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" data-testid="settings-tab-profile">{t("settings.tab_profile")}</TabsTrigger>
          <TabsTrigger value="preferences" data-testid="settings-tab-preferences">Preferensi Acara</TabsTrigger>
          <TabsTrigger value="theme" data-testid="settings-tab-theme">{t("settings.tab_theme")}</TabsTrigger>
          <TabsTrigger value="language" data-testid="settings-tab-language">{t("settings.tab_language")}</TabsTrigger>
          <TabsTrigger value="partners" data-testid="settings-tab-partners">{t("settings.tab_partners")}</TabsTrigger>
          <TabsTrigger value="license" data-testid="settings-tab-license">{t("settings.tab_license")}</TabsTrigger>
          {/* Tab Baru: Keamanan */}
          <TabsTrigger value="security" data-testid="settings-tab-security">Keamanan</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card className="p-6 rounded-2xl space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>{t("settings.field_p1_name")}</Label><Input value={form.partner1_name} onChange={(e) => setForm({ ...form, partner1_name: e.target.value })} /></div>
              <div><Label>{t("settings.field_p1_nick")}</Label><Input value={form.partner1_nickname} onChange={(e) => setForm({ ...form, partner1_nickname: e.target.value })} /></div>
              <div><Label>{t("settings.field_p2_name")}</Label><Input value={form.partner2_name} onChange={(e) => setForm({ ...form, partner2_name: e.target.value })} /></div>
              <div><Label>{t("settings.field_p2_nick")}</Label><Input value={form.partner2_nickname} onChange={(e) => setForm({ ...form, partner2_nickname: e.target.value })} /></div>
              <div><Label>{t("settings.field_date")}</Label><Input type="date" value={form.wedding_date || ""} onChange={(e) => setForm({ ...form, wedding_date: e.target.value })} /></div>
              <div><Label>{t("settings.field_city")}</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>{t("settings.field_budget")}</Label><NumberInput prefix="Rp" value={form.budget_amount} onChange={(v) => setForm({ ...form, budget_amount: v })} /></div>
              <div><Label>{t("settings.field_guests")}</Label><NumberInput value={form.guest_count} onChange={(v) => setForm({ ...form, guest_count: v })} /></div>
            </div>
            <Button className="rounded-full" onClick={save} data-testid="save-settings-btn">{t("settings.save_changes")}</Button>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="p-6 rounded-2xl mt-4 space-y-8">
            <div>
              <h3 className="font-serif text-xl mb-1">Jenis Acara</h3>
              <p className="text-sm text-muted-foreground mb-4">Pilih semua acara yang berlaku</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {WEDDING_TYPES.map((tp) => (
                  <OptionCard key={tp} selected={prefs.wedding_types?.includes(tp)} onClick={() => togglePref("wedding_types", tp)} testid={`pref-type-${tp}`}>
                    <div className="flex items-center gap-2 font-medium">{prefs.wedding_types?.includes(tp) && <Check className="h-4 w-4 text-primary" />}{tp}</div>
                  </OptionCard>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-serif text-xl mb-1">Gaya Pernikahan</h3>
              <p className="text-sm text-muted-foreground mb-4">Maksimal 3 pilihan</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STYLES.map((s) => (
                  <OptionCard key={s} selected={prefs.wedding_styles?.includes(s)} onClick={() => togglePref("wedding_styles", s, 3)} testid={`pref-style-${s}`}>
                    <div className="font-medium">{s}</div>
                  </OptionCard>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-serif text-xl mb-1">Warna</h3>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => togglePref("wedding_colors", c)} className={`px-3.5 py-1.5 rounded-full text-sm border ${prefs.wedding_colors?.includes(c) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`} data-testid={`pref-color-${c}`}>{c}</button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-serif text-xl mb-1">Vendor yang Sudah Beres</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {COMPLETED.map((c) => (
                  <OptionCard key={c} selected={prefs.completed_items?.includes(c)} onClick={() => togglePref("completed_items", c)} testid={`pref-completed-${c}`}>
                    <div className="flex items-center gap-2 font-medium">{prefs.completed_items?.includes(c) && <Check className="h-4 w-4 text-primary" />}{c}</div>
                  </OptionCard>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-serif text-xl mb-1">Tantangan</h3>
              <p className="text-sm text-muted-foreground mb-4">Maksimal 3 pilihan</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CHALLENGES.map((c) => (
                  <OptionCard key={c} selected={prefs.challenges?.includes(c)} onClick={() => togglePref("challenges", c, 3)} testid={`pref-challenge-${c}`}>
                    <div className="font-medium">{c}</div>
                  </OptionCard>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-serif text-xl mb-1">Prioritas</h3>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((c) => (
                  <button key={c} type="button" onClick={() => togglePref("priorities", c)} className={`px-3.5 py-1.5 rounded-full text-sm border ${prefs.priorities?.includes(c) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`} data-testid={`pref-priority-${c}`}>{c}</button>
                ))}
              </div>
            </div>

            <Button className="rounded-full" onClick={savePrefs} data-testid="save-preferences-btn">{t("settings.save_changes")}</Button>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <Card className="p-6 rounded-2xl mt-4">
            <p className="text-muted-foreground mb-4">{t("settings.theme_note")}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEMES.map((th) => (
                <button key={th.id} data-testid={`theme-palette-option-${th.id}`} onClick={() => setTheme(th.id)} className={`text-left rounded-2xl border p-3 hover:shadow-md transition-shadow duration-200 ${wedding?.theme_id === th.id ? "border-primary ring-2 ring-primary" : "border-border"}`}>
                  <div className="flex gap-1 mb-2">{th.swatches.map((s) => <span key={s} className="h-5 w-5 rounded-full border border-border" style={{ background: s }} />)}</div>
                  <div className="font-serif">{th.name}</div>
                  <div className="text-xs text-muted-foreground">{th.desc}</div>
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="language">
          <Card className="p-6 rounded-2xl mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">{t("settings.language_note")}</div>
            <LanguageToggle />
          </Card>
        </TabsContent>
        <TabsContent value="partners">
          <Card className="p-6 rounded-2xl mt-4 space-y-3">
            <div className="text-sm">{t("settings.signed_in_as")} <span className="font-medium">{user?.email}</span></div>
            <div className="text-sm text-muted-foreground">{t("settings.invite_hint")}</div>
            <Button onClick={copyToken} variant="outline" className="rounded-full"><Copy className="h-4 w-4 mr-2" /> {t("settings.copy_token")}</Button>
            <div><Button variant="ghost" onClick={logout} className="text-destructive">{t("settings.signout")}</Button></div>
          </Card>
        </TabsContent>
        <TabsContent value="license">
          <Card className="p-6 rounded-2xl mt-4 space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("settings.access_token")}</div>
            <div className="font-mono text-lg">{tokenMask}</div>
            <div className="text-sm text-muted-foreground">{t("settings.status_active")}</div>
          </Card>
        </TabsContent>

        {/* TABS KEAMANAN / GANTI PASSWORD */}
        <TabsContent value="security">
          <Card className="p-6 rounded-2xl mt-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              Masukkan password lama Anda, lalu buat password baru yang kuat (minimal 6 karakter).
            </div>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label>Password Saat Ini</Label>
                <Input 
                  type="password" 
                  value={passForm.current} 
                  onChange={(e) => setPassForm({ ...passForm, current: e.target.value })}
                  required 
                />
              </div>
              <div>
                <Label>Password Baru</Label>
                <Input 
                  type="password" 
                  value={passForm.new} 
                  onChange={(e) => setPassForm({ ...passForm, new: e.target.value })}
                  required 
                />
              </div>
              <div>
                <Label>Konfirmasi Password Baru</Label>
                <Input 
                  type="password" 
                  value={passForm.confirm} 
                  onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })}
                  required 
                />
              </div>
              
              <Button type="submit" className="rounded-full" disabled={passLoading}>
                {passLoading ? "Memproses..." : "Ubah Password"}
              </Button>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}