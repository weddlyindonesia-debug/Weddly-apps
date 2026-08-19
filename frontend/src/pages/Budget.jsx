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

export default function Budget() {
  const [data, setData] = useState({ items: [], categories: [], totals: {} });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Venue", planned: 0, actual: 0, paid: 0, status: "quotation", vendor: "" });

  const load = () => api.get("/budget").then(({ data }) => setData(data));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Item name required");
    await api.post("/budget", form); setOpen(false);
    setForm({ name: "", category: "Venue", planned: 0, actual: 0, paid: 0, status: "quotation", vendor: "" });
    load(); toast.success("Expense added");
  };
  const remove = async (i) => { await api.delete(`/budget/${i.item_id}`); load(); };

  const t = data.totals || {};
  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Finance · IDR</div>
          <h1 className="font-serif text-4xl">Budget planner</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="budget-add-expense-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Item name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="budget-name-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(data.categories || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["quotation","dp_paid","paid","pending"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Planned</Label><Input type="number" min="0" value={form.planned} onChange={(e) => setForm({ ...form, planned: Number(e.target.value) })} data-testid="budget-currency-input" /></div>
                <div><Label>Actual</Label><Input type="number" min="0" value={form.actual} onChange={(e) => setForm({ ...form, actual: Number(e.target.value) })} /></div>
                <div><Label>Paid</Label><Input type="number" min="0" value={form.paid} onChange={(e) => setForm({ ...form, paid: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Vendor (optional)</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
              <Button onClick={add} className="w-full rounded-full" data-testid="save-expense-btn">Save expense</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">Total budget</div><div data-testid="budget-total-planned" className="font-serif text-2xl mt-2">{idr(t.budget)}</div></Card>
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">Planned</div><div className="font-serif text-2xl mt-2">{idr(t.planned)}</div></Card>
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">Spent</div><div data-testid="budget-actual-committed" className="font-serif text-2xl mt-2 text-primary">{idr(t.actual)}</div></Card>
        <Card className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">Remaining</div><div className={`font-serif text-2xl mt-2 ${(t.remaining || 0) < 0 ? "text-destructive" : ""}`}>{idr(t.remaining)}</div></Card>
      </div>

      {data.items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">Let's set your wedding budget. Add your first expense.</Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider">
                <tr><th className="text-left px-4 py-3">Item</th><th className="text-left px-4 py-3">Category</th><th className="text-right px-4 py-3">Planned</th><th className="text-right px-4 py-3">Actual</th><th className="text-right px-4 py-3">Paid</th><th className="text-left px-4 py-3">Status</th><th></th></tr>
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
