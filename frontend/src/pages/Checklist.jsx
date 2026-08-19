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
import { useT } from "@/context/LanguageContext";

const CATS = ["Planning","Venue","Catering","Decoration","Photography","Videography","Attire","Makeup","Invitations","Guests","Ceremony","Reception","Entertainment","Transportation","Documents","Final Week","Wedding Day"];

export default function Checklist() {
  const { t } = useT();
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", category: "Planning", due_date: "", priority: "medium" });

  const load = () => api.get("/checklist").then(({ data }) => setTasks(data.tasks));
  useEffect(() => { load(); }, []);

  const toggle = async (task) => {
    const status = task.status === "completed" ? "todo" : "completed";
    await api.patch(`/checklist/${task.task_id}`, { status }); load();
  };
  const remove = async (task) => { await api.delete(`/checklist/${task.task_id}`); load(); };
  const add = async () => {
    if (!form.title.trim()) return toast.error(t("check.title_required"));
    await api.post("/checklist", form); setOpen(false);
    setForm({ title: "", category: "Planning", due_date: "", priority: "medium" });
    load(); toast.success(t("check.added"));
  };

  const filtered = tasks.filter((task) => filter === "all" ? true : filter === "todo" ? task.status !== "completed" : task.status === "completed");
  const labelFor = { all: t("check.filter_all"), todo: t("check.filter_todo"), completed: t("check.filter_done") };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("check.section")}</div>
          <h1 className="font-serif text-4xl">{t("check.title")}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all","todo","completed"].map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} data-testid={`checklist-filter-tab-${f}`} className="rounded-full">{labelFor[f]}</Button>
          ))}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="add-task-button" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> {t("check.add_btn")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("check.new_task")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("check.task_title")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="task-title-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("common.category")}</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("common.priority")}</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["low","medium","high"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>{t("common.due")}</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <Button onClick={add} className="w-full rounded-full" data-testid="save-task-btn">{t("check.save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">{t("check.empty")}</Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <ul className="divide-y divide-border">
            {filtered.map((task) => (
              <li key={task.task_id} className="flex items-center gap-4 p-4">
                <Checkbox checked={task.status === "completed"} onCheckedChange={() => toggle(task)} data-testid="task-item-checkbox" />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{task.title}</div>
                  <div className="text-xs text-muted-foreground">{task.category}{task.due_date && ` · ${t("common.due")}: ${task.due_date}`}</div>
                </div>
                <span data-testid="task-priority-badge" className="text-xs px-2 py-0.5 rounded-full border border-border capitalize">{task.priority}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(task)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
