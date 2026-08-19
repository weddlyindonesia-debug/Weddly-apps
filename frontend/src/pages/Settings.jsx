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

export default function Settings() {
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

  const save = async () => { await api.patch("/wedding", form); await refresh(); toast.success("Saved"); };
  const setTheme = async (id) => { applyTheme(id); await api.patch("/wedding/theme", { theme_id: id }); await refresh(); toast.success("Theme updated"); };
  const tokenMask = wedding?.token_code ? `WDL-••••-••••-${wedding.token_code.slice(-4)}` : "—";
  const copyToken = () => { if (wedding?.token_code) { navigator.clipboard.writeText(wedding.token_code); toast.success("Access token copied"); } };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="mb-8"><div className="text-xs uppercase tracking-widest text-muted-foreground">Preferences</div><h1 className="font-serif text-4xl">Settings</h1></div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" data-testid="settings-tab-profile">Wedding profile</TabsTrigger>
          <TabsTrigger value="theme" data-testid="settings-tab-theme">Theme</TabsTrigger>
          <TabsTrigger value="partners" data-testid="settings-tab-partners">Partners</TabsTrigger>
          <TabsTrigger value="license" data-testid="settings-tab-license">License</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card className="p-6 rounded-2xl space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Partner 1 name</Label><Input value={form.partner1_name} onChange={(e) => setForm({ ...form, partner1_name: e.target.value })} /></div>
              <div><Label>Partner 1 nickname</Label><Input value={form.partner1_nickname} onChange={(e) => setForm({ ...form, partner1_nickname: e.target.value })} /></div>
              <div><Label>Partner 2 name</Label><Input value={form.partner2_name} onChange={(e) => setForm({ ...form, partner2_name: e.target.value })} /></div>
              <div><Label>Partner 2 nickname</Label><Input value={form.partner2_nickname} onChange={(e) => setForm({ ...form, partner2_nickname: e.target.value })} /></div>
              <div><Label>Wedding date</Label><Input type="date" value={form.wedding_date || ""} onChange={(e) => setForm({ ...form, wedding_date: e.target.value })} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Budget (IDR)</Label><Input type="number" min="0" value={form.budget_amount} onChange={(e) => setForm({ ...form, budget_amount: Number(e.target.value) })} /></div>
              <div><Label>Guest estimate</Label><Input type="number" min="0" value={form.guest_count} onChange={(e) => setForm({ ...form, guest_count: Number(e.target.value) })} /></div>
            </div>
            <Button className="rounded-full" onClick={save} data-testid="save-settings-btn">Save changes</Button>
          </Card>
        </TabsContent>
        <TabsContent value="theme">
          <Card className="p-6 rounded-2xl mt-4">
            <p className="text-muted-foreground mb-4">Your dashboard theme is shared with your partner.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEMES.map((t) => (
                <button key={t.id} data-testid={`theme-palette-option-${t.id}`} onClick={() => setTheme(t.id)} className={`text-left rounded-2xl border p-3 hover:shadow-md transition-shadow duration-200 ${wedding?.theme_id === t.id ? "border-primary ring-2 ring-primary" : "border-border"}`}>
                  <div className="flex gap-1 mb-2">{t.swatches.map((s) => <span key={s} className="h-5 w-5 rounded-full border border-border" style={{ background: s }} />)}</div>
                  <div className="font-serif">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="partners">
          <Card className="p-6 rounded-2xl mt-4 space-y-3">
            <div className="text-sm">Signed in as <span className="font-medium">{user?.email}</span></div>
            <div className="text-sm text-muted-foreground">Ask your partner to sign in with Google and enter the same access token to join this wedding workspace.</div>
            <Button onClick={copyToken} variant="outline" className="rounded-full"><Copy className="h-4 w-4 mr-2" /> Copy access token</Button>
            <div><Button variant="ghost" onClick={logout} className="text-destructive">Sign out</Button></div>
          </Card>
        </TabsContent>
        <TabsContent value="license">
          <Card className="p-6 rounded-2xl mt-4 space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Access token</div>
            <div className="font-mono text-lg">{tokenMask}</div>
            <div className="text-sm text-muted-foreground">Status: active · One workspace, up to two partners.</div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
