import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, X, Users, Circle, Clock, KeyRound } from "lucide-react";
import { useT } from "@/context/LanguageContext";

export default function Admin() {
  const { t } = useT();
  const [pending, setPending] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [resettingUserId, setResettingUserId] = useState(null);

  // Load Pending Users
  const loadPending = async () => {
    try {
      const { data } = await api.get("/admin/users/pending");
      setPending(data.users || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memuat data pendaftaran");
    }
  };

  // Load User Activity (Online Status)
  const loadActivity = async () => {
    setLoadingActivity(true);
    try {
      const { data } = await api.get("/admin/users/activity");
      setActivities(data.users || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memuat aktivitas user");
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    loadPending();
    loadActivity();
  }, []);

  // Approve
  const approve = async (user) => {
    setLoading(true);
    try {
      await api.post(`/admin/users/${user.user_id}/approve`);
      toast.success(`${user.name} berhasil disetujui ✅`);
      await loadPending();
      await loadActivity();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyetujui user");
    } finally {
      setLoading(false);
    }
  };

  // Reject
  const reject = async (user) => {
    setLoading(true);
    try {
      await api.post(`/admin/users/${user.user_id}/reject`);
      toast.success(`${user.name} berhasil ditolak ❌`);
      await loadPending();
      await loadActivity();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menolak user");
    } finally {
      setLoading(false);
    }
  };

  // Reset Password (Fitur Baru)
  const handleResetPassword = async (user) => {
    // Konfirmasi ke admin
    const isManual = window.confirm(`Reset password untuk ${user.name}?\n\nKlik "OK" untuk Generate Otomatis.`);
    if (!isManual) return;

    setResettingUserId(user.user_id);
    try {
      // Body kosong berarti backend akan generate otomatis
      const { data } = await api.post(`/admin/users/${user.user_id}/reset-password`, {});
      
      if (data.ok) {
        toast.success(`Password untuk ${user.name} berhasil di-reset!`);
        // Tampilkan password baru agar admin bisa menyampaikan ke user
        alert(`Password baru untuk ${user.name} adalah:\n\n${data.new_password}\n\nSegera sampaikan ke user. User harus login ulang dan disarankan segera ganti password di menu Settings -> Keamanan.`);
        await loadActivity(); // Refresh status (akan jadi offline karena sesi dihapus)
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mereset password user");
    } finally {
      setResettingUserId(null);
    }
  };

  // Helper format waktu
  const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Admin Panel
        </div>
        <h1 className="font-serif text-4xl">Manajemen Pengguna</h1>
        <p className="text-muted-foreground mt-1">
          Kelola pendaftaran & pantau aktivitas pasangan.
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="pending" data-testid="admin-tab-pending">
            Pendaftaran ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="admin-tab-activity">
            Aktivitas Akun
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PENDING USERS */}
        <TabsContent value="pending">
          <Card className="rounded-2xl overflow-hidden">
            {pending.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Users className="h-8 w-8 opacity-20" />
                <span>Tidak ada pendaftaran yang menunggu persetujuan.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3">Nama</th>
                      <th className="text-left px-4 py-3">Nomor HP</th>
                      <th className="text-left px-4 py-3">Kode Undangan</th>
                      <th className="text-left px-4 py-3">Tanggal Daftar</th>
                      <th className="text-right px-4 py-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((u) => (
                      <tr key={u.user_id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 font-mono">{u.phone}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {u.pending_wedding_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {(u.created_at || "").slice(0, 10)}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => approve(u)}
                            disabled={loading}
                            className="hover:bg-green-50 hover:text-green-600"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => reject(u)}
                            disabled={loading}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: USER ACTIVITY */}
        <TabsContent value="activity">
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
              <span className="text-sm font-medium">Status Login Terkini</span>
              <Button variant="ghost" size="sm" onClick={loadActivity} disabled={loadingActivity}>
                <Clock className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
            {loadingActivity ? (
              <div className="p-10 text-center text-muted-foreground">Memuat data...</div>
            ) : activities.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">Belum ada user yang terdaftar.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3">Nama</th>
                      <th className="text-left px-4 py-3">Nomor HP</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Login Terakhir</th>
                      <th className="text-left px-4 py-3">Role</th>
                      {/* Kolom Aksi Baru */}
                      <th className="text-right px-4 py-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((u) => (
                      <tr key={u.user_id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 font-mono">{u.phone}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.is_online ? (
                              <>
                                <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                                <span className="text-green-600 font-medium">Online</span>
                              </>
                            ) : (
                              <>
                                <Circle className="h-3 w-3 fill-gray-300 text-gray-300" />
                                <span className="text-gray-400">Offline</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {u.is_online ? formatDate(u.last_login) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {u.is_admin ? (
                            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">Admin</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">User</span>
                          )}
                        </td>
                        {/* Tombol Aksi Reset Password */}
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetPassword(u)}
                            disabled={resettingUserId === u.user_id}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <KeyRound className="h-4 w-4 mr-2" />
                            Reset
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}