import { useT } from "@/context/LanguageContext";
import { Globe } from "lucide-react";

export default function LanguageToggle({ className = "" }) {
  const { lang, setLang, t } = useT();
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur px-2 py-1 shadow-sm ${className}`} data-testid="language-toggle">
      <Globe className="h-3.5 w-3.5 text-muted-foreground ml-1" aria-hidden />
      <span className="sr-only">{t("lang.label")}</span>
      <button
        type="button"
        data-testid="lang-en-btn"
        onClick={() => setLang("en")}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150 ${lang === "en" ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}
        aria-pressed={lang === "en"}
      >EN</button>
      <button
        type="button"
        data-testid="lang-id-btn"
        onClick={() => setLang("id")}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150 ${lang === "id" ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}
        aria-pressed={lang === "id"}
      >ID</button>
    </div>
  );
}
