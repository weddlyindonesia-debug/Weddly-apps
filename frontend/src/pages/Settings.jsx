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
import { Copy } from "lucide-react";
import NumberInput from "@/components/app/NumberInput";
import { useT } from "@/context/LanguageContext";
import LanguageToggle from "@/components/app/LanguageToggle";

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

  const save = async () => { await api.patch("/wedding", form); await refresh(); toast.success(t("settings.saved")); };
  const setTheme = async (id) => { applyTheme(id); await api.patch("/wedding/theme", { theme_id: id }); await refresh(); toast.success(t("settings.theme_updated")); };
  const tokenMask = wedding?.token_code ? `WDL-••••-••••-${wedding.token_code.slice(-4)}` : "—";
  const copyToken = () => { if (wedding?.token_code) { navigator.clipboard.writeText(wedding.token_code); toast.success(t("settings.token_copied")); } };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="mb-8"><div className="text-xs uppercase tracking-widest text-muted-foreground">{t("settings.section")}</div><h1 className="font-serif text-4xl">{t("settings.title")}</h1></div>
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" data-testid="settings-tab-profile">{t("settings.tab_profile")}</TabsTrigger>
          <TabsTrigger value="theme" data-testid="settings-tab-theme">{t("settings.tab_theme")}</TabsTrigger>
          <TabsTrigger value="language" data-testid="settings-tab-language">{t("settings.tab_language")}</TabsTrigger>
          <TabsTrigger value="partners" data-testid="settings-tab-partners">{t("settings.tab_partners")}</TabsTrigger>
          <TabsTrigger value="license" data-testid="settings-tab-license">{t("settings.tab_license")}</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
