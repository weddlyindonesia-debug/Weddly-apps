import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { api, idr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { THEMES, applyTheme } from "@/lib/themes";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import NumberInput from "@/components/app/NumberInput";
import { useT } from "@/context/LanguageContext";
import LanguageToggle from "@/components/app/LanguageToggle";

const WEDDING_TYPES = ["Akad Nikah", "Resepsi", "Pemberkatan", "Sangjit", "Lamaran", "Engagement", "Tea Pai", "Siraman", "After Party"];
const STYLES = ["Elegant", "Romantic", "Minimalist", "Modern", "Luxury", "Rustic", "Traditional", "Outdoor", "Classic"];
const COLORS = ["Ivory", "Champagne", "Blush", "Sage", "Burgundy", "Navy", "Terracotta", "Dusty Blue", "Lavender", "Not decided"];
const COMPLETED = ["Venue", "Catering", "Wedding Organizer", "Decoration", "Photography", "Videography", "Makeup Artist", "Wedding Dress", "Suit", "Invitation", "Entertainment", "MC", "Souvenir"];
const CHALLENGES = ["Managing budget", "Knowing what to do first", "Finding trusted vendors", "Managing guests", "Staying on schedule", "Coordinating with family", "Choosing wedding concept", "Managing contracts and payments", "Everything feels overwhelming"];
const PRIORITIES = ["Planning", "Budgeting", "Finding vendors", "Guest management", "Timeline", "Invitations", "AI wedding advice", "Staying organized"];
const BUDGET_PRESETS = [
  { label: "< Rp 100.000.000", value: 100_000_000 },
  { label: "Rp 100.000.000 – 250.000.000", value: 250_000_000 },
  { label: "Rp 250.000.000 – 500.000.000", value: 500_000_000 },
  { label: "Rp 500.000.000 – 1.000.000.000", value: 1_000_000_000 },
  { label: "> Rp 1.000.000.000", value: 2_000_000_000 },
];
const GUEST_PRESETS = [
  { label: "< 100 pax", value: 80 },
  { label: "100 – 300 pax", value: 200 },
  { label: "300 – 700 pax", value: 500 },
  { label: "> 700 pax", value: 1000 },
];

const TOTAL_STEPS = 10;

export default function Setup() {
  const { t } = useT();
  const { wedding, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    partner1_name: "", partner1_nickname: "", partner2_name: "", partner2_nickname: "",
    wedding_date: "", date_status: "confirmed",
    country: "Indonesia", city: "", venue_ceremony: "", venue_reception: "", venue_mode: "same",
    budget_amount: 0, budget_currency: "IDR",
    guest_count: 0,
    wedding_types: [], wedding_styles: [], wedding_colors: [],
    completed_items: [], challenges: [], priorities: [],
    theme_id: "ivory_champagne",
  });

  useEffect(() => {
    if (wedding) {
      const merged = { ...form };
      Object.keys(form).forEach((k) => { if (wedding[k] !== undefined && wedding[k] !== null) merged[k] = wedding[k]; });
      setForm(merged);
      if (wedding.setup_step) setStep(Math.max(1, Math.min(TOTAL_STEPS, wedding.setup_step)));
      if (wedding.theme_id) applyTheme(wedding.theme_id);
    }
    // eslint-disable-next-line
  }, [wedding?.wedding_id]);

  const toggle = (field, val, max) => {
    setForm((f) => {
      const cur = new Set(f[field] || []);
      if (cur.has(val)) cur.delete(val); else { if (max && cur.size >= max) return f; cur.add(val); }
      return { ...f, [field]: [...cur] };
    });
  };

  const persist = async (extra = {}) => {
    setSaving(true);
    try {
      const payload = { ...form, ...extra, setup_step: step };
      await api.patch("/wedding", payload);
    } catch { toast.error("Could not save"); } finally { setSaving(false); }
  };

  const next = async () => { if (step < TOTAL_STEPS) { await persist(); setStep(step + 1); } };
  const prev = () => { if (step > 1) setStep(step - 1); };

  const finish = async () => {
    setSaving(true);
    try {
      await api.patch("/wedding", { ...form, setup_step: TOTAL_STEPS, setup_complete: true });
      await refresh();
      toast.success(t("setup.ready_toast"));
      navigate("/dashboard");
    } catch { toast.error("Could not finalize"); } finally { setSaving(false); }
  };

  const pct = Math.round((step / TOTAL_STEPS) * 100);

  const OptionCard = ({ selected, onClick, children, testid }) => (
    <button type="button" data-testid={testid} onClick={onClick}
      className={`text-left rounded-2xl border p-4 transition-shadow duration-200 hover:shadow-md ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"}`}>{children}</button>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-14 relative">
      <div className="absolute top-4 right-4"><LanguageToggle /></div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("setup.step")} {step} {t("setup.of")} {TOTAL_STEPS}</div>
            <div className="text-xs text-muted-foreground">{saving ? t("setup.saving") : t("setup.draft_saved")}</div>
          </div>
          <Progress value={pct} data-testid="wizard-step-indicator" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Card className="p-6 md:p-10 rounded-2xl">
              {step === 1 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step1_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step1_sub")}</p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label>{t("setup.p1_full")}</Label>
                      <Input value={form.partner1_name} onChange={(e) => setForm({ ...form, partner1_name: e.target.value })} />
                      <Label>{t("setup.p1_nick")}</Label>
                      <Input value={form.partner1_nickname} onChange={(e) => setForm({ ...form, partner1_nickname: e.target.value })} />
                    </div>
                    <div className="space-y-3">
                      <Label>{t("setup.p2_full")}</Label>
                      <Input value={form.partner2_name} onChange={(e) => setForm({ ...form, partner2_name: e.target.value })} />
                      <Label>{t("setup.p2_nick")}</Label>
                      <Input value={form.partner2_nickname} onChange={(e) => setForm({ ...form, partner2_nickname: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step2_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step2_sub")}</p>
                  <div className="grid gap-3 md:grid-cols-3 mb-4">
                    {[["confirmed", t("setup.date_confirmed"), t("setup.date_confirmed_hint")],
                      ["target", t("setup.date_target"), t("setup.date_target_hint")],
                      ["undecided", t("setup.date_undecided"), t("setup.date_undecided_hint")]].map(([s, label, hint]) => (
                      <OptionCard key={s} selected={form.date_status === s} onClick={() => setForm({ ...form, date_status: s })} testid={`date-status-${s}`}>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
                      </OptionCard>
                    ))}
                  </div>
                  {form.date_status !== "undecided" && (
                    <div className="max-w-xs">
                      <Label>{t("setup.wedding_date")}</Label>
                      <Input type="date" value={form.wedding_date || ""} onChange={(e) => setForm({ ...form, wedding_date: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step3_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step3_sub")}</p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label>{t("setup.country")}</Label>
                      <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                      <Label>{t("setup.city")}</Label>
                      <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Jakarta, Bali, Bandung…" />
                    </div>
                    <div className="space-y-3">
                      <Label>{t("setup.venue_mode")}</Label>
                      <div className="grid gap-2">
                        {[["same", t("setup.venue_same")],["different", t("setup.venue_diff")],["undecided", t("setup.venue_undecided")]].map(([m, label]) => (
                          <OptionCard key={m} selected={form.venue_mode === m} onClick={() => setForm({ ...form, venue_mode: m })} testid={`venue-mode-${m}`}>
                            <div className="font-medium">{label}</div>
                          </OptionCard>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step4_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step4_sub")}</p>
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {BUDGET_PRESETS.map((b) => (
                      <OptionCard key={b.value} selected={form.budget_amount === b.value} onClick={() => setForm({ ...form, budget_amount: b.value })} testid={`budget-preset-${b.value}`}>
                        <div className="font-medium">{b.label}</div>
                      </OptionCard>
                    ))}
                  </div>
                  <div className="max-w-sm">
                    <Label>{t("setup.custom_amount")}</Label>
                    <NumberInput prefix="Rp" value={form.budget_amount} onChange={(v) => setForm({ ...form, budget_amount: v })} />
                    <div className="text-xs text-muted-foreground mt-1">{idr(form.budget_amount)}</div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step5_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step5_sub")}</p>
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {GUEST_PRESETS.map((g) => (
                      <OptionCard key={g.value} selected={form.guest_count === g.value} onClick={() => setForm({ ...form, guest_count: g.value })} testid={`guest-preset-${g.value}`}>
                        <div className="font-medium">{g.label}</div>
                      </OptionCard>
                    ))}
                  </div>
                  <div className="max-w-sm">
                    <Label>{t("setup.custom_estimate")}</Label>
                    <NumberInput value={form.guest_count} onChange={(v) => setForm({ ...form, guest_count: v })} />
                  </div>
                </div>
              )}

              {step === 6 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step6_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step6_sub")}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {WEDDING_TYPES.map((tp) => (
                      <OptionCard key={tp} selected={form.wedding_types?.includes(tp)} onClick={() => toggle("wedding_types", tp)} testid={`type-${tp}`}>
                        <div className="flex items-center gap-2 font-medium">{form.wedding_types?.includes(tp) && <Check className="h-4 w-4 text-primary" />}{tp}</div>
                      </OptionCard>
                    ))}
                  </div>
                </div>
              )}

              {step === 7 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step7_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step7_sub")}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {STYLES.map((s) => (
                      <OptionCard key={s} selected={form.wedding_styles?.includes(s)} onClick={() => toggle("wedding_styles", s, 3)} testid={`style-${s}`}>
                        <div className="font-medium">{s}</div>
                      </OptionCard>
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-8 mb-4">{t("setup.colors_q")}</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => toggle("wedding_colors", c)} className={`px-3.5 py-1.5 rounded-full text-sm border ${form.wedding_colors?.includes(c) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`} data-testid={`color-${c}`}>{c}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 8 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step8_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step8_sub")}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {COMPLETED.map((c) => (
                      <OptionCard key={c} selected={form.completed_items?.includes(c)} onClick={() => toggle("completed_items", c)} testid={`completed-${c}`}>
                        <div className="flex items-center gap-2 font-medium">{form.completed_items?.includes(c) && <Check className="h-4 w-4 text-primary" />}{c}</div>
                      </OptionCard>
                    ))}
                  </div>
                </div>
              )}

              {step === 9 && (
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step9_title")}</h2>
                  <p className="text-muted-foreground mb-6">{t("setup.step9_sub")}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                    {CHALLENGES.map((c) => (
                      <OptionCard key={c} selected={form.challenges?.includes(c)} onClick={() => toggle("challenges", c, 3)} testid={`challenge-${c}`}>
                        <div className="font-medium">{c}</div>
                      </OptionCard>
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">{t("setup.priorities_q")}</p>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITIES.map((c) => (
                      <button key={c} type="button" onClick={() => toggle("priorities", c)} className={`px-3.5 py-1.5 rounded-full text-sm border ${form.priorities?.includes(c) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`} data-testid={`priority-${c}`}>{c}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 10 && (
                <div>
                  <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> {t("setup.make_yours")}
                  </div>
                  <h2 className="font-serif text-3xl md:text-4xl mb-2">{t("setup.step10_title")}</h2>
                  <p className="text-muted-foreground mb-8">{t("setup.step10_sub")}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {THEMES.map((th) => (
                      <button key={th.id} data-testid={`theme-palette-option-${th.id}`}
                        onClick={() => { setForm({ ...form, theme_id: th.id }); applyTheme(th.id); }}
                        className={`text-left rounded-2xl border p-3 transition-shadow duration-200 hover:shadow-md ${form.theme_id === th.id ? "border-primary ring-2 ring-primary" : "border-border"}`}>
                        <div className="flex gap-1 mb-2">
                          {th.swatches.map((sw) => (<span key={sw} className="h-6 w-6 rounded-full border border-border" style={{ background: sw }} />))}
                        </div>
                        <div className="font-serif text-base">{th.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{th.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={prev} disabled={step === 1} data-testid="wizard-prev-button">
            <ChevronLeft className="h-4 w-4 mr-1" /> {t("setup.back")}
          </Button>
          {step < TOTAL_STEPS ? (
            <Button onClick={next} data-testid="wizard-next-button" className="rounded-full px-6">
              {t("setup.next")} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving} data-testid="wizard-finish-button" className="rounded-full px-8">
              {saving ? t("setup.finishing") : t("setup.finish")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
