import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATS = ["general","meeting","fitting","payment","rehearsal","setup","ceremony","reception"];

export default function Timeline() {
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", start_time: "", end_time: "", location: "", category: "general", notes: "" });

  const load = () => api.get("/timeline").then(({ data }) => setEvents(data.events));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim() || !form.date) return toast.error("Title and date required");
    await api.post("/timeline", form); setOpen(false);
    setForm({ title: "", date: "", start_time: "", end_time: "", location: "", category: "general", notes: "" });
    load(); toast.success("Event added");
  };
  const remove = async (e) => { await api.delete(`/timeline/${e.event_id}`); load(); };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div><div className="text-xs uppercase tracking-widest text-muted-foreground">Schedule</div><h1 className="font-serif text-4xl">Timeline & rundown</h1></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="rundown-add-row-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> New event</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="event-title-input" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Category</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Button onClick={add} className="w-full rounded-full" data-testid="save-event-btn">Save event</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {events.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">Your rundown starts here. Add your first event.</Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.event_id} className="p-4 flex items-center gap-4" data-testid="rundown-table-row">
                <div className="w-32 shrink-0">
                  <div className="font-serif text-lg">{e.date}</div>
                  <div className="text-xs text-muted-foreground">{e.start_time}{e.end_time && ` – ${e.end_time}`}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.location}{e.category && ` · ${e.category}`}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
