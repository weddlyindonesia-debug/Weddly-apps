import { useEffect, useState } from "react";
import { api, idr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Phone, Mail, User2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import NumberInput from "@/components/app/NumberInput";
import { useT } from "@/context/LanguageContext";

const CATS = ["Venue","Catering","Decoration","Wedding Organizer","Photography","Videography","Makeup Artist","Dress","Suit","Invitation","Entertainment","MC","Souvenir","Cake","Florist","Transportation"];
const BOOKING_STATUSES = ["researching","contacted","quotation","shortlisted","booked","completed"];
const PAYMENT_STATUSES = ["pending","dp_paid","partially_paid","paid"];

const emptyForm = { name: "", category: "Venue", contact_person: "", phone: "", email: "", price: 0, booking_status: "researching", payment_status: "pending", notes: "" };

export default function Vendors() {
  const { t } = useT();
  const [vendors, setVendors] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [addForm, setAddForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/vendors").then(({ data }) => setVendors(data.vendors ?? [])).catch((e) => {
    toast.error(e?.response?.data?.detail || "Gagal memuat vendor");
  });
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!addForm.name.trim()) return toast.error(t("vendors.name_required"));
    try {
      await api.post("/vendors", addForm);
      setAddOpen(false);
      setAddForm(emptyForm);
      load();
      toast.success(t("vendors.added"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menambah vendor");
    }
  };

  const openDetail = (v) => {
    setSelected(v);
    setEditForm({
      name: v.name || "", category: v.category || "Venue",
      contact_person: v.contact_person || "", phone: v.phone || "", email: v.email || "",
      price: v.price || 0,
      booking_status: v.booking_status || "researching",
      payment_status: v.payment_status || "pending",
      notes: v.notes || "",
    });
    setDetailOpen(true);
  };

  const saveDetail = async () => {
    if (!selected) return;
    if (!editForm.name.trim()) return toast.error(t("vendors.name_required"));
    setSaving(true);
    try {
      await api.patch(`/vendors/${selected.vendor_id}`, editForm);
      toast.success(t("vendors.updated"));
      setDetailOpen(false);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const removeDetail = async () => {
    if (!selected) return;
    if (!window.confirm(t("vendors.confirm_delete"))) return;
    try {
      await api.delete(`/vendors/${selected.vendor_id}`);
      setDetailOpen(false);
      load();
      toast.success(t("vendors.deleted"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus vendor");
    }
  };

  const filtered = filter === "all" ? vendors : vendors.filter((v) => v.category === filter);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("vendors.section")}</div>
          <h1 className="font-serif text-4xl">{t("vendors.title")}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("vendors.click_hint")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filter} onValueChange={setFilter}><SelectTrigger data-testid="vendor-category-filter" className="w-48"><SelectValue placeholder={t("vendors.all_categories")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("vendors.all_categories")}</SelectItem>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button data-testid="vendor-add-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> {t("vendors.add_btn")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("vendors.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("common.name")}</Label><Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} data-testid="vendor-name-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("common.category")}</Label><Select value={addForm.category} onValueChange={(v) => setAddForm({ ...addForm, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>{t("vendors.price_idr")}</Label><NumberInput prefix="Rp" value={addForm.price} onChange={(v) => setAddForm({ ...addForm, price: v })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("vendors.contact_person")}</Label><Input value={addForm.contact_person} onChange={(e) => setAddForm({ ...addForm, contact_person: e.target.value })} /></div>
                  <div><Label>{t("common.phone")}</Label><Input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} /></div>
                </div>
                <Button onClick={add} className="w-full rounded-full" data-testid="save-vendor-btn">{t("vendors.save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground rounded-2xl">{t("vendors.empty")}</Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <button
              key={v.vendor_id}
              type="button"
              onClick={() => openDetail(v)}
              data-testid="vendor-card-item"
              className="text-left"
            >
              <Card className="p-5 rounded-2xl transition-shadow hover:shadow-md cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-serif text-xl truncate">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.category}</div>
                  </div>
                  <span data-testid="vendor-status-pill" className="text-xs px-2 py-0.5 rounded-full border border-border capitalize whitespace-nowrap">{v.booking_status}</span>
                </div>
                {v.contact_person && <div className="mt-3 text-sm text-muted-foreground truncate">{v.contact_person}{v.phone && ` · ${v.phone}`}</div>}
                <div className="mt-3 font-medium">{idr(v.price)}</div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Detail / Edit Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg" data-testid="vendor-detail-modal">
          <DialogHeader><DialogTitle>{t("vendors.details")}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div><Label>{t("common.name")}</Label><Input data-testid="vendor-edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("common.category")}</Label>
                  <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("vendors.price_idr")}</Label><NumberInput prefix="Rp" value={editForm.price} onChange={(v) => setEditForm({ ...editForm, price: v })} data-testid="vendor-edit-price" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("vendors.booking_status")}</Label>
                  <Select value={editForm.booking_status} onValueChange={(v) => setEditForm({ ...editForm, booking_status: v })}>
                    <SelectTrigger data-testid="vendor-edit-booking"><SelectValue /></SelectTrigger>
                    <SelectContent>{BOOKING_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("vendors.payment_status")}</Label>
                  <Select value={editForm.payment_status} onValueChange={(v) => setEditForm({ ...editForm, payment_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="flex items-center gap-1"><User2 className="h-3.5 w-3.5" /> {t("vendors.contact_person")}</Label><Input value={editForm.contact_person} onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {t("common.phone")}</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                <div><Label className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {t("common.email")}</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
              </div>
              <div><Label className="flex items-center gap-1"><StickyNote className="h-3.5 w-3.5" /> {t("common.notes")}</Label><Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter className="flex-row justify-between gap-2">
            <Button variant="ghost" onClick={removeDetail} className="text-destructive" data-testid="vendor-detail-delete"><Trash2 className="h-4 w-4 mr-1" /> {t("common.delete")}</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={saveDetail} disabled={saving} data-testid="vendor-detail-save">{saving ? t("common.saving") : t("vendors.save_changes")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
