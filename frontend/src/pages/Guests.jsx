import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const GROUPS = ["Groom's Family","Bride's Family","VIP","Friends","Colleagues","Neighbors"];

export default function Guests() {
  const [data, setData] = useState({ guests: [], counts: {} });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState("all");
  const [form, setForm] = useState({ name: "", group: "Friends", phone: "", number_of_guests: 1, rsvp: "pending", table: "" });

  const load = () => api.get("/guests").then(({ data }) => setData(data));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await api.post("/guests", form); setOpen(false);
    setForm({ name: "", group: "Friends", phone: "", number_of_guests: 1, rsvp: "pending", table: "" });
    load(); toast.success("Guest added");
  };
  const update = async (g, patch) => { await api.patch(`/guests/${g.guest_id}`, patch); load(); };
  const remove = async (g) => { await api.delete(`/guests/${g.guest_id}`); load(); };

  const filtered = data.guests.filter((g) => (rsvpFilter === "all" || g.rsvp === rsvpFilter) && g.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Attendance</div>
          <h1 className="font-serif text-4xl">Guest list</h1>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input data-testid="guest-search-input" placeholder="Search guests…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-56" /></div>
          <Select value={rsvpFilter} onValueChange={setRsvpFilter}><SelectTrigger data-testid="guest-filter-rsvp" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{["all","attending","pending","declined"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="guest-add-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add guest</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New guest</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="guest-name-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Group</Label><Select value={form.group} onValueChange={(v) => setForm({ ...form, group: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GROUPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Pax</Label><Input type="number" min="1" value={form.number_of_guests} onChange={(e) => setForm({ ...form, number_of_guests: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Table</Label><Input value={form.table} onChange={(e) => setForm({ ...form, table: e.target.value })} /></div>
                </div>
                <Button onClick={add} className="w-full rounded-full" data-testid="save-guest-btn">Save guest</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        {[["Total", data.counts.total],["Attending", data.counts.attending],["Pending", data.counts.pending],["Declined", data.counts.declined]].map(([k,v]) => (
          <Card key={k} className="p-5 rounded-2xl"><div className="text-xs uppercase tracking-widest text-muted-foreground">{k}</div><div className="font-serif text-2xl mt-2">{v || 0}</div></Card>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">Your guest list is waiting. Add your first guest.</Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider">
                <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Group</th><th className="text-right px-4 py-3">Pax</th><th className="text-left px-4 py-3">RSVP</th><th className="text-left px-4 py-3">Table</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.guest_id} className="border-t border-border" data-testid="guest-row-item">
                    <td className="px-4 py-3 font-medium">{g.name}{g.phone && <div className="text-xs text-muted-foreground">{g.phone}</div>}</td>
                    <td className="px-4 py-3">{g.group}</td>
                    <td className="px-4 py-3 text-right">{g.number_of_guests || 1}</td>
                    <td className="px-4 py-3">
                      <Select value={g.rsvp} onValueChange={(v) => update(g, { rsvp: v })}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{["pending","attending","declined"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">{g.table || "—"}</td>
                    <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => remove(g)}><Trash2 className="h-4 w-4" /></Button></td>
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
