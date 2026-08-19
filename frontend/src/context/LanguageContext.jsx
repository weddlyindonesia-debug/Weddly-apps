import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DICT } from "@/lib/translations";

const LangCtx = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem("weddly_lang");
      if (stored === "en" || stored === "id") return stored;
    } catch {}
    // Auto-detect: default to 'id' if browser is Indonesian, else 'en'
    if (typeof navigator !== "undefined" && (navigator.language || "").toLowerCase().startsWith("id")) return "id";
    return "en";
  });

  const setLang = useCallback((l) => {
    if (l !== "en" && l !== "id") return;
    setLangState(l);
    try { localStorage.setItem("weddly_lang", l); } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key) => (DICT[lang]?.[key] ?? DICT.en[key] ?? key), [lang]);

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useT = () => useContext(LangCtx);
