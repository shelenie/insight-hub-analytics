import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Mail, Loader2 } from "lucide-react";
import { LangSwitcher } from "@/components/header/LangSwitcher";
import { ThemeSwitcher } from "@/components/header/ThemeSwitcher";

export default function Login() {
  const { session, signInWithMagicLink } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

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
            <div className="text-sm font-semibold">Pulse</div>
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

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
