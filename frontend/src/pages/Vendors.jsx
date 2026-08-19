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

const CATS = ["Venue","Catering","Decoration","Wedding Organizer","Photography","Videography","Makeup Artist","Dress","Suit","Invitation","Entertainment","MC","Souvenir","Cake","Florist","Transportation"];
const STATUSES = ["researching","contacted","quotation","shortlisted","booked","completed"];

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ name: "", category: "Venue", contact_person: "", phone: "", email: "", price: 0, booking_status: "researching", payment_status: "pending" });

  const load = () => api.get("/vendors").then(({ data }) => setVendors(data.vendors));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await api.post("/vendors", form); setOpen(false);
    setForm({ name: "", category: "Venue", contact_person: "", phone: "", email: "", price: 0, booking_status: "researching", payment_status: "pending" });
    load(); toast.success("Vendor added");
  };
  const update = async (v, patch) => { await api.patch(`/vendors/${v.vendor_id}`, patch); load(); };
  const remove = async (v) => { await api.delete(`/vendors/${v.vendor_id}`); load(); };

  const filtered = filter === "all" ? vendors : vendors.filter((v) => v.category === filter);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div><div className="text-xs uppercase tracking-widest text-muted-foreground">Partners</div><h1 className="font-serif text-4xl">Vendor hub</h1></div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}><SelectTrigger data-testid="vendor-category-filter" className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="vendor-add-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add vendor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New vendor</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="vendor-name-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Price (IDR)</Label><Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <Button onClick={add} className="w-full rounded-full" data-testid="save-vendor-btn">Save vendor</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">Start building your vendor team. Add your first vendor.</Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <Card key={v.vendor_id} className="p-5 rounded-2xl" data-testid="vendor-card-item">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-serif text-xl truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.category}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(v)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {v.contact_person && <div className="mt-3 text-sm text-muted-foreground">{v.contact_person}{v.phone && ` · ${v.phone}`}</div>}
              <div className="mt-3 font-medium">{idr(v.price)}</div>
              <div className="mt-3">
                <Select value={v.booking_status} onValueChange={(val) => update(v, { booking_status: val })}>
                  <SelectTrigger data-testid="vendor-status-pill" className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
