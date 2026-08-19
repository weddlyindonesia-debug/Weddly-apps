import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { useT } from "@/context/LanguageContext";

export default function Admin() {
  const { t } = useT();
  const [tokens, setTokens] = useState([]);
  const [count, setCount] = useState(1);
  const load = () => api.get("/admin/tokens").then(({ data }) => setTokens(data.tokens));
  useEffect(() => { load(); }, []);

  const generate = async () => {
    try {
      await api.post("/admin/tokens/generate", { count });
      toast.success(t("admin.generated").replace("{n}", count));
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success(t("admin.copied")); };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <div className="mb-8"><div className="text-xs uppercase tracking-widest text-muted-foreground">{t("admin.section")}</div><h1 className="font-serif text-4xl">{t("admin.title")}</h1><p className="text-sm text-muted-foreground mt-2 max-w-xl">{t("admin.note")}</p></div>
      <Card className="p-5 rounded-2xl mb-6 flex items-end gap-3 flex-wrap">
        <div><label className="text-xs text-muted-foreground">{t("admin.quantity")}</label><Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-32" /></div>
        <Button onClick={generate} className="rounded-full" data-testid="admin-generate-tokens-btn">{t("admin.generate_btn")}</Button>
      </Card>
      <Card className="rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">{t("admin.col_code")}</th><th className="text-left px-4 py-3">{t("admin.col_status")}</th><th className="text-left px-4 py-3">{t("admin.col_members")}</th><th className="text-left px-4 py-3">{t("admin.col_created")}</th><th></th></tr>
          </thead>
          <tbody>
            {tokens.map((tk) => (
              <tr key={tk.token_id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{tk.token_code}</td>
                <td className="px-4 py-3 capitalize">{tk.status}</td>
                <td className="px-4 py-3">{tk.current_member_count}/{tk.max_members}</td>
                <td className="px-4 py-3 text-muted-foreground">{(tk.created_at || "").slice(0,10)}</td>
                <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => copy(tk.token_code)}><Copy className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
