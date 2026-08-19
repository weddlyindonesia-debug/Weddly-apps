import { useEffect, useState } from "react";
import { api, idr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import NumberInput from "@/components/app/NumberInput";
import { useT } from "@/context/LanguageContext";

export default function Budget() {
  const { t } = useT();
  const [data, setData] = useState({ items: [], categories: [], totals: {} });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Venue", planned: 0, actual: 0, paid: 0, status: "quotation", vendor: "" });

  const load = () => api.get("/budget").then(({ data }) => setData(data));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error(t("budget.name_required"));
    await api.post("/budget", form); setOpen(false);
    setForm({ name: "", category: "Venue", planned: 0, actual: 0, paid: 0, status: "quotation", vendor: "" });
    load(); toast.success(t("budget.added"));
  };
  const remove = async (i) => { await api.delete(`/budget/${i.item_id}`); load(); };

  const totals = data.totals || {};
  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("budget.section")}</div>
          <h1 className="font-serif text-4xl">{t("budget.title")}</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="budget-add-expense-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> {t("budget.add_btn")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("budget.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("budget.item_name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="budget-name-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("common.category")}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(data.categories || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("common.status")}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["quotation","dp_paid","paid","pending"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t("budget.planned")}</Label><NumberInput prefix="Rp" value={form.planned} onChange={(v) => setForm({ ...form, planned: v })} data-testid="budget-currency-input" /></div>
                <div><Label>{t("budget.actual")}</Label><NumberInput prefix="Rp" value={form.actual} onChange={(v) => setForm({ ...form, actual: v })} /></div>
                <div><Label>{t("budget.paid")}</Label><NumberInput prefix="Rp" value={form.paid} onChange={(v) => setForm({ ...form, paid: v })} /></div>
              </div>
              <div><Label>{t("budget.vendor_opt")}</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
              <Button onClick={add} className="w-full rounded-full" data-testid="save-expense-btn">{t("budget.save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">{t("budget.total_budget")}</div><div data-testid="budget-total-planned" className="font-serif text-2xl mt-2">{idr(totals.budget)}</div></Card>
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">{t("budget.planned")}</div><div className="font-serif text-2xl mt-2">{idr(totals.planned)}</div></Card>
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">{t("budget.spent")}</div><div data-testid="budget-actual-committed" className="font-serif text-2xl mt-2 text-primary">{idr(totals.actual)}</div></Card>
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">{t("budget.remaining")}</div><div className={`font-serif text-2xl mt-2 ${(totals.remaining || 0) < 0 ? "text-destructive" : ""}`}>{idr(totals.remaining)}</div></Card>
      </div>

      {data.items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">{t("budget.empty")}</Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider">
                <tr><th className="text-left px-4 py-3">{t("budget.col_item")}</th><th className="text-left px-4 py-3">{t("budget.col_category")}</th><th className="text-right px-4 py-3">{t("budget.planned")}</th><th className="text-right px-4 py-3">{t("budget.actual")}</th><th className="text-right px-4 py-3">{t("budget.paid")}</th><th className="text-left px-4 py-3">{t("common.status")}</th><th></th></tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.item_id} className="border-t border-border" data-testid="budget-category-row">
                    <td className="px-4 py-3 font-medium">{i.name}{i.vendor && <div className="text-xs text-muted-foreground">{i.vendor}</div>}</td>
                    <td className="px-4 py-3">{i.category}</td>
                    <td className="px-4 py-3 text-right">{idr(i.planned)}</td>
                    <td className="px-4 py-3 text-right">{idr(i.actual)}</td>
                    <td className="px-4 py-3 text-right">{idr(i.paid)}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full border border-border capitalize">{(i.status || "").replace("_"," ")}</span></td>
                    <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
