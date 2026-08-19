import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, User } from "lucide-react";
import { API_BASE } from "@/lib/api";

const STARTERS = [
  "Bantu susun rundown detail untuk prosesi Akad Nikah dan Resepsi malam (500 tamu).",
  "Hitung proporsi alokasi budget Rp 300 juta untuk pernikahan di Jakarta.",
  "Buatkan draf teks sambutan keluarga untuk prosesi Sangjit.",
  "Ide souvenir pernikahan ramah lingkungan di bawah Rp 25.000 per pcs.",
];

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg, model }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Please try again." };
        return copy;
      });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 flex flex-col h-[calc(100vh-2rem)]">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Advisor</div>
          <h1 className="font-serif text-4xl flex items-center gap-2"><Sparkles className="h-7 w-7 text-primary" /> Weddly AI</h1>
        </div>
        <div className="inline-flex rounded-full border border-border p-1 bg-card">
          <button data-testid="ai-model-selector-claude" onClick={() => setModel("claude-sonnet-4-6")} className={`px-4 py-1.5 rounded-full text-sm ${model === "claude-sonnet-4-6" ? "bg-primary text-primary-foreground" : ""}`}>Claude Sonnet 4.6</button>
          <button data-testid="ai-model-selector-gemini" onClick={() => setModel("gemini-3-flash")} className={`px-4 py-1.5 rounded-full text-sm ${model === "gemini-3-flash" ? "bg-primary text-primary-foreground" : ""}`}>Gemini 3 Flash</button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden rounded-2xl flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="mb-6">Ask Weddly AI anything about your wedding — budget, rundowns, speeches, vendors.</p>
              <div className="grid sm:grid-cols-2 gap-2 max-w-2xl mx-auto text-left">
                {STARTERS.map((s) => (
                  <button data-testid="ai-prompt-chip" key={s} onClick={() => send(s)} className="rounded-xl border border-border bg-card p-3 text-sm hover:shadow-md transition-shadow duration-200">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-primary" /></div>}
              <div className={`rounded-2xl px-4 py-3 max-w-[80%] whitespace-pre-wrap text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.content || (busy ? "…" : "")}
              </div>
              {m.role === "user" && <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4" /></div>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border p-3 flex items-end gap-2">
          <Textarea
            data-testid="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask Weddly AI…"
            className="min-h-[48px] max-h-40 resize-none"
          />
          <Button data-testid="ai-send-message-btn" onClick={() => send()} disabled={busy || !input.trim()} className="rounded-full h-12 w-12 p-0"><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
}
