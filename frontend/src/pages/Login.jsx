import { Button } from "@/components/ui/button";
import { Heart, Sparkles, ShieldCheck } from "lucide-react";
import { useT } from "@/context/LanguageContext";
import LanguageToggle from "@/components/app/LanguageToggle";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { t } = useT();
  const handleGoogle = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  const [heroLine1, heroLine2] = t("brand.tagline_hero").split("\n");
  return (
    <div className="min-h-screen w-full grid md:grid-cols-2 relative">
      <div className="absolute top-4 right-4 z-30 md:top-6 md:right-6">
        <LanguageToggle />
      </div>
      <div className="relative hidden md:block">
        <img
          src="https://images.unsplash.com/photo-1617785258979-b50ebd43871e?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85"
          alt="Wedding aesthetic"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/25 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-2 text-lg font-serif tracking-wide">
            <Heart className="h-5 w-5" /> Weddly
          </div>
          <div>
            <h1 className="font-serif text-4xl lg:text-5xl leading-tight mb-3">{heroLine1}<br/>{heroLine2}</h1>
            <p className="text-white/85 max-w-md">{t("brand.tagline_sub")}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 md:p-16 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Heart className="h-5 w-5" />
            </div>
            <span className="font-serif text-2xl">Weddly</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl mb-3">{t("login.welcome")}</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {t("login.intro")}
          </p>
          <Button
            data-testid="google-signin-button"
            onClick={handleGoogle}
            className="w-full h-12 rounded-full text-base font-medium"
          >
            <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.24 1.4-1.7 4.1-5.4 4.1-3.24 0-5.9-2.7-5.9-6s2.66-6 5.9-6c1.85 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.75 2.5 2.5 6.75 2.5 12S6.75 21.5 12 21.5c6.9 0 11.5-4.85 11.5-11.7 0-.8-.1-1.4-.2-2.1H12z"/>
            </svg>
            {t("login.google_btn")}
          </Button>
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /> {t("login.secure_note")}</div>
            <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-primary" /> {t("login.license_note")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
