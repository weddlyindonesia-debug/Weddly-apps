import { useEffect, useState } from "react";
import { api, idr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, WalletCards, Users, Briefcase, CalendarClock, Plus, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { wedding, user } = useAuth();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get("/dashboard").then(({ data }) => setData(data)).catch(() => {}); }, []);

  const p1 = wedding?.partner1_nickname || wedding?.partner1_name || "Partner 1";
  const p2 = wedding?.partner2_nickname || wedding?.partner2_name || "Partner 2";

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Wedding workspace</div>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight">{p1} <span className="text-primary">&</span> {p2}</h1>
          <p className="mt-2 text-muted-foreground">Hi {user?.name?.split(" ")[0] || "there"} — welcome back to your shared plan.</p>
        </div>
        <div data-testid="dashboard-countdown-badge" className="rounded-2xl border border-primary/30 bg-primary/5 px-6 py-4 text-center">
          <div className="font-serif text-4xl text-primary">{data?.days_to_go ?? "—"}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Days to go</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8 p-6 md:p-8 rounded-2xl">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Wedding progress</div>
              <h3 className="font-serif text-2xl mt-1">Your wedding is <span className="text-primary">{data?.progress?.percent ?? 0}%</span> ready</h3>
            </div>
            <div className="text-sm text-muted-foreground">{data?.progress?.completed || 0}/{data?.progress?.total || 0} tasks</div>
          </div>
          <Progress value={data?.progress?.percent || 0} className="mt-4" data-testid="dashboard-progress-ring" />
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            <Button data-testid="dashboard-add-task-btn" onClick={() => navigate("/checklist")} className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add task</Button>
            <Button data-testid="dashboard-log-expense-btn" variant="secondary" onClick={() => navigate("/budget")} className="rounded-full"><WalletCards className="h-4 w-4 mr-1" /> Log expense</Button>
            <Button variant="outline" onClick={() => navigate("/ai")} className="rounded-full"><Sparkles className="h-4 w-4 mr-1" /> Ask Weddly AI</Button>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4 p-6 rounded-2xl">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Budget · IDR</div>
          <div className="mt-2 font-serif text-3xl">{idr(data?.budget?.actual || 0)}</div>
          <div className="text-sm text-muted-foreground mt-1">spent of {idr(data?.budget?.budget || 0)}</div>
          <Progress className="mt-4" value={data?.budget?.budget ? Math.min(100, Math.round(100 * data.budget.actual / data.budget.budget)) : 0} />
          <div className="mt-3 text-sm">Remaining: <span className="font-medium">{idr(data?.budget?.remaining || 0)}</span></div>
        </Card>

        <Card className="col-span-12 lg:col-span-7 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl">This week</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/checklist")}>View all</Button>
          </div>
          {(!data?.this_week || data.this_week.length === 0) ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-primary" />
              You're all caught up for this week!
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.this_week.map((t) => (
                <li key={t.task_id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.category} · Due {t.due_date}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-border capitalize">{t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="col-span-12 md:col-span-6 lg:col-span-5 p-6 rounded-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3"><Users className="h-3.5 w-3.5" /> Guests</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-muted p-3"><div className="text-2xl font-serif">{data?.guests?.attending || 0}</div><div className="text-xs text-muted-foreground">Attending</div></div>
            <div className="rounded-xl bg-muted p-3"><div className="text-2xl font-serif">{data?.guests?.pending || 0}</div><div className="text-xs text-muted-foreground">Pending</div></div>
            <div className="rounded-xl bg-muted p-3"><div className="text-2xl font-serif">{data?.guests?.declined || 0}</div><div className="text-xs text-muted-foreground">Declined</div></div>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">Total invited: <span className="font-medium text-foreground">{data?.guests?.total || 0}</span></div>
        </Card>

        <Card className="col-span-12 md:col-span-6 lg:col-span-4 p-6 rounded-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3"><Briefcase className="h-3.5 w-3.5" /> Vendors</div>
          <div className="font-serif text-3xl">{data?.vendors?.booked || 0}<span className="text-muted-foreground text-lg">/{data?.vendors?.total || 0}</span></div>
          <div className="text-sm text-muted-foreground">booked so far</div>
        </Card>

        <Card className="col-span-12 lg:col-span-8 p-6 rounded-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3"><CalendarClock className="h-3.5 w-3.5" /> Upcoming events</div>
          {(!data?.upcoming || data.upcoming.length === 0) ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">Nothing scheduled yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {data.upcoming.map((e) => (
                <li key={e.event_id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.date} {e.start_time && `· ${e.start_time}`} {e.location && `· ${e.location}`}</div>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{e.category}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
