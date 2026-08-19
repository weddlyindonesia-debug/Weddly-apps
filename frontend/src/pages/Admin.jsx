import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export default function Admin() {
  const [tokens, setTokens] = useState([]);
  const [count, setCount] = useState(1);
  const load = () => api.get("/admin/tokens").then(({ data }) => setTokens(data.tokens));
  useEffect(() => { load(); }, []);

  const generate = async () => {
    try {
      await api.post("/admin/tokens/generate", { count });
      toast.success(`Generated ${count} token(s)`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success("Copied"); };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <div className="mb-8"><div className="text-xs uppercase tracking-widest text-muted-foreground">Admin</div><h1 className="font-serif text-4xl">Access tokens</h1></div>
      <Card className="p-5 rounded-2xl mb-6 flex items-end gap-3">
        <div><label className="text-xs text-muted-foreground">Quantity</label><Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-32" /></div>
        <Button onClick={generate} className="rounded-full" data-testid="admin-generate-tokens-btn">Generate tokens</Button>
      </Card>
      <Card className="rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Code</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Members</th><th className="text-left px-4 py-3">Created</th><th></th></tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.token_id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{t.token_code}</td>
                <td className="px-4 py-3 capitalize">{t.status}</td>
                <td className="px-4 py-3">{t.current_member_count}/{t.max_members}</td>
                <td className="px-4 py-3 text-muted-foreground">{(t.created_at || "").slice(0,10)}</td>
                <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => copy(t.token_code)}><Copy className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
