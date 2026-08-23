import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarDays,
  Users,
  DollarSign,
  Package,
  Clock,
  ArrowRight,
  PlusCircle,
  Loader2,
  TrendingUp,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get("/dashboard");
        setData(res.data);
      } catch (error) {
        toast.error("Gagal memuat dashboard");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-20">
        <p>Data tidak tersedia. Silakan refresh.</p>
      </div>
    );
  }

  const { wedding, progress, this_week, budget, guests, vendors, upcoming, days_to_go } = data;

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount || 0);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="font-serif text-4xl">💍 Dashboard</h1>
          <p className="text-muted-foreground">
            {wedding?.partner1_name || "Partner 1"} &amp; {wedding?.partner2_name || "Partner 2"}
          </p>
        </div>
        <div className="text-right text-sm">
          {days_to_go !== null && days_to_go !== undefined && (
            <span
              className={`px-3 py-1 rounded-full font-medium ${
                days_to_go >= 0 ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-700"
              }`}
            >
              {days_to_go >= 0
                ? `🎯 ${days_to_go} hari menuju Hari H`
                : `📅 ${Math.abs(days_to_go)} hari setelah Hari H`}
            </span>
          )}
        </div>
      </div>

      <Card className="mb-6 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Wedding Progress
              </div>
              <div className="text-3xl font-bold">{progress?.percent || 0}%</div>
              <div className="text-sm text-muted-foreground">
                {progress?.completed || 0} dari {progress?.total || 0} tugas selesai
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => navigate("/checklist")}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add task
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => navigate("/budget")}
              >
                <DollarSign className="mr-2 h-4 w-4" /> Anggaran
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" /> Budget · IDR
            </div>
            <div className="text-2xl font-bold">Rp {formatCurrency(budget?.actual || 0)}</div>
            <div className="text-sm text-muted-foreground">
              spent of Rp {formatCurrency(budget?.budget || 0)}
            </div>
            <div className="text-sm text-muted-foreground">
              Remaining: Rp {formatCurrency(budget?.remaining || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" /> Guests
            </div>
            <div className="text-2xl font-bold">{guests?.total || 0}</div>
            <div className="text-sm text-muted-foreground flex gap-2 flex-wrap">
              <span className="text-green-600">Attending: {guests?.attending || 0}</span>
              <span className="text-amber-600">Pending: {guests?.pending || 0}</span>
              <span className="text-red-600">Declined: {guests?.declined || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" /> Vendors
            </div>
            <div className="text-2xl font-bold">
              {vendors?.booked || 0}/{vendors?.total || 0}
            </div>
            <div className="text-sm text-muted-foreground">booked so far</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> This week
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({this_week?.length || 0} tugas)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {this_week && this_week.length > 0 ? (
            <div className="space-y-3">
              {this_week.slice(0, 5).map((task) => (
                <div
                  key={task.task_id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      <span className="truncate">{task.title}</span>
                      {task.status === "completed" && (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                          ✅ Done
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                      <span>{task.category || "Planning"}</span>
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatShortDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition"
                    onClick={() => navigate("/checklist")}
                  >
                    View
                  </Button>
                </div>
              ))}
              {this_week.length > 5 && (
                <div className="text-center text-sm text-muted-foreground">
                  + {this_week.length - 5} tugas lainnya minggu ini
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-6 text-sm">
              Tidak ada tugas dalam minggu ini. Selamat! 🎉
            </div>
          )}
          <div className="mt-4">
            <Button variant="link" className="px-0" onClick={() => navigate("/checklist")}>
              Lihat semua tugas <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {upcoming && upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((event) => (
                <div
                  key={event.event_id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                      <span>📅 {formatDate(event.date)}</span>
                      {event.location && <span>📍 {event.location}</span>}
                      {event.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {event.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition"
                    onClick={() => navigate("/timeline")}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-6 text-sm">
              Belum ada acara yang dijadwalkan. 📌
            </div>
          )}
          <div className="mt-4">
            <Button variant="link" className="px-0" onClick={() => navigate("/timeline")}>
              Kelola timeline <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}