import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATS = ["Planning","Venue","Catering","Decoration","Photography","Videography","Attire","Makeup","Invitations","Guests","Ceremony","Reception","Entertainment","Transportation","Documents","Final Week","Wedding Day"];

export default function Checklist() {
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", category: "Planning", due_date: "", priority: "medium" });

  const load = () => api.get("/checklist").then(({ data }) => setTasks(data.tasks));
  useEffect(() => { load(); }, []);

  const toggle = async (t) => {
    const status = t.status === "completed" ? "todo" : "completed";
    await api.patch(`/checklist/${t.task_id}`, { status });
    load();
  };
  const remove = async (t) => { await api.delete(`/checklist/${t.task_id}`); load(); };
  const add = async () => {
    if (!form.title.trim()) return toast.error("Task title is required");
    await api.post("/checklist", form);
    setOpen(false); setForm({ title: "", category: "Planning", due_date: "", priority: "medium" }); load();
    toast.success("Task added");
  };

  const filtered = tasks.filter((t) => filter === "all" ? true : filter === "todo" ? t.status !== "completed" : t.status === "completed");

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Planning</div>
          <h1 className="font-serif text-4xl">Your wedding checklist</h1>
        </div>
        <div className="flex gap-2">
          {["all","todo","completed"].map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} data-testid={`checklist-filter-tab-${f}`} className="rounded-full capitalize">{f}</Button>
          ))}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="add-task-button" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="task-title-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["low","medium","high"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <Button onClick={add} className="w-full rounded-full" data-testid="save-task-btn">Save task</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">Your wedding plan starts here. Add your first task.</Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <ul className="divide-y divide-border">
            {filtered.map((t) => (
              <li key={t.task_id} className="flex items-center gap-4 p-4">
                <Checkbox checked={t.status === "completed"} onCheckedChange={() => toggle(t)} data-testid="task-item-checkbox" />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.category}{t.due_date && ` · Due ${t.due_date}`}</div>
                </div>
                <span data-testid="task-priority-badge" className="text-xs px-2 py-0.5 rounded-full border border-border capitalize">{t.priority}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
