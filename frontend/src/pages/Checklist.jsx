import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";

export default function Checklist() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    category: "Planning",
    due_date: "",
    priority: "medium",
  });
  // State untuk menyimpan task yang sedang diedit (berisi task_id dan field2 yang diubah)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    category: "",
    due_date: "",
    priority: "",
  });

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/checklist");
      setTasks(data.tasks || []);
    } catch (e) {
      toast.error("Gagal memuat checklist");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Tambah tugas
  const addTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("Judul tugas wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/checklist", newTask);
      toast.success("Tugas berhasil ditambahkan ✅");
      setNewTask({ title: "", category: "Planning", due_date: "", priority: "medium" });
      loadTasks();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menambah tugas");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle status (selesai / belum)
  const toggleStatus = async (task) => {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await api.patch(`/checklist/${task.task_id}`, { status: newStatus });
      loadTasks();
    } catch (e) {
      toast.error("Gagal mengupdate status");
    }
  };

  // Hapus tugas
  const deleteTask = async (taskId) => {
    if (!confirm("Yakin ingin menghapus tugas ini?")) return;
    try {
      await api.delete(`/checklist/${taskId}`);
      toast.success("Tugas dihapus");
      loadTasks();
    } catch (e) {
      toast.error("Gagal menghapus");
    }
  };

  // Mulai mode edit
  const startEdit = (task) => {
    setEditingId(task.task_id);
    setEditForm({
      title: task.title,
      category: task.category || "Planning",
      due_date: task.due_date || "",
      priority: task.priority || "medium",
    });
  };

  // Batalkan edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", category: "", due_date: "", priority: "" });
  };

  // Simpan hasil edit
  const saveEdit = async (taskId) => {
    if (!editForm.title.trim()) {
      toast.error("Judul tidak boleh kosong");
      return;
    }
    try {
      await api.patch(`/checklist/${taskId}`, {
        title: editForm.title,
        category: editForm.category,
        // Kirim string kosong (bukan null) agar backend menghapus deadline;
        // backend PATCH membuang nilai None/null.
        due_date: editForm.due_date || "",
        priority: editForm.priority,
      });
      toast.success("Tugas diperbarui ✅");
      setEditingId(null);
      loadTasks();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan perubahan");
    }
  };

  // Helper render deadline dengan warna
  const renderDeadline = (dueDate) => {
    if (!dueDate) return <span className="text-muted-foreground text-sm">-</span>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    let colorClass = "text-muted-foreground";
    let label = "";

    if (diffDays < 0) {
      colorClass = "text-red-500 font-medium";
      label = "⚠️ Terlewat";
    } else if (diffDays === 0) {
      colorClass = "text-orange-500 font-medium";
      label = "Hari ini!";
    } else if (diffDays <= 3) {
      colorClass = "text-yellow-600 font-medium";
      label = `${diffDays} hari lagi`;
    } else {
      label = `${diffDays} hari lagi`;
    }

    const dateStr = new Date(dueDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <span className={colorClass}>
        {dateStr} {label !== dateStr && `(${label})`}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-serif text-4xl">📋 Checklist</h1>
          <p className="text-muted-foreground">Kelola semua persiapan pernikahan</p>
        </div>
        <div className="text-sm bg-gray-100 px-3 py-1 rounded-full dark:bg-gray-800">
          {tasks.filter((t) => t.status === "completed").length} / {tasks.length} selesai
        </div>
      </div>

      {/* Form tambah tugas */}
      <div className="mb-6 p-4 border border-primary/20 rounded-lg bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Judul</label>
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Misal: Pesan katering"
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Kategori</label>
            <select
              value={newTask.category}
              onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="Planning">Planning</option>
              <option value="Venue">Venue</option>
              <option value="Catering">Catering</option>
              <option value="Photography">Photography</option>
              <option value="Videography">Videography</option>
              <option value="Attire">Attire</option>
              <option value="Decoration">Decoration</option>
              <option value="Makeup">Makeup</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Invitation">Invitation</option>
              <option value="Transportation">Transportation</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Deadline</label>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            />
          </div>
          <button
            onClick={addTask}
            disabled={submitting}
            className="w-full md:w-auto px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Tambah
          </button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Tip: Tentukan deadline agar tugas muncul di dashboard "This week".
        </div>
      </div>

      {/* Daftar tugas */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-lg">Belum ada tugas. Tambahkan sekarang! 🎯</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.task_id}
              className={`border-l-4 p-4 rounded-r-lg shadow-sm bg-card ${
                task.status === "completed"
                  ? "border-green-500 opacity-60"
                  : "border-primary"
              }`}
            >
              {editingId === task.task_id ? (
                // MODE EDIT
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Judul</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Kategori</label>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                      >
                        <option value="Planning">Planning</option>
                        <option value="Venue">Venue</option>
                        <option value="Catering">Catering</option>
                        <option value="Photography">Photography</option>
                        <option value="Videography">Videography</option>
                        <option value="Attire">Attire</option>
                        <option value="Decoration">Decoration</option>
                        <option value="Makeup">Makeup</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Invitation">Invitation</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Deadline</label>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(task.task_id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                      >
                        <Check className="h-4 w-4" /> Simpan
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 flex items-center gap-1"
                      >
                        <X className="h-4 w-4" /> Batal
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // MODE TAMPIL BIASA
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <input
                      type="checkbox"
                      checked={task.status === "completed"}
                      onChange={() => toggleStatus(task)}
                      className="h-4 w-4 mt-1 accent-primary"
                    />
                    <div className="flex-1">
                      <div
                        className={`font-medium ${
                          task.status === "completed" ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="border px-2 py-0.5 rounded-full text-[10px]">
                          {task.category || "Planning"}
                        </span>
                        <span className="bg-secondary px-2 py-0.5 rounded-full text-[10px] capitalize">
                          {task.priority}
                        </span>
                        <span className="flex items-center gap-1">
                          <span>📅</span> {renderDeadline(task.due_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(task)}
                      className="p-1 rounded-md hover:bg-primary/10 text-primary"
                      title="Edit tugas"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteTask(task.task_id)}
                      className="p-1 rounded-md hover:bg-destructive/10 text-destructive"
                      title="Hapus tugas"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}