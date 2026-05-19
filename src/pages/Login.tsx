import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Mail, Loader2 } from "lucide-react";
import { LangSwitcher } from "@/components/header/LangSwitcher";
import { ThemeSwitcher } from "@/components/header/ThemeSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences } from "@/preferences/PreferencesProvider";

export default function Login() {
  const { session, loading, signInWithMagicLink } = useAuth();
  const { t } = useI18n();
  const { defaultLanding } = usePreferences();
  const loc = useLocation();
  const fromPath = (loc.state as { from?: string } | null)?.from ?? defaultLanding ?? "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setStatus("idle");
    setErrorMsg(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setGoogleLoading(false);
      setStatus("error");
      setErrorMsg(t("googleSignInError"));
      return;
    }
    if (data?.url) return;
    // Inline-completed OAuth: state listener will set session; redirect happens below.
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (session) return <Navigate to={fromPath} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    const { error } = await signInWithMagicLink(email.trim());
    if (error) {
      setStatus("error");
      setErrorMsg(error);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Insight Hub</div>
            <div className="text-[11px] text-muted-foreground">{t("appTagline")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-xl border bg-card p-6 shadow-card md:p-8">
            <h1 className="text-xl font-semibold tracking-tight">{t("loginTitle")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("loginSubtitle")}</p>

            <div className="mt-6 space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="h-10 w-full gap-2"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                )}
                {t("signInWithGoogle")}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t("orDivider")}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  {t("email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="h-10"
                  disabled={status === "sending" || status === "sent"}
                />
              </div>

              <Button
                type="submit"
                className="h-10 w-full gap-2"
                disabled={status === "sending" || status === "sent" || !email}
              >
                {status === "sending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {t("sendMagicLink")}
              </Button>

              {status === "sent" && (
                <div className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
                  {t("magicLinkSent")}
                </div>
              )}
              {status === "error" && (
                <div className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
                  {errorMsg ?? t("magicLinkError")}
                </div>
              )}
            </form>

            <p className="mt-6 text-[11px] text-muted-foreground">{t("inviteOnlyNote")}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
