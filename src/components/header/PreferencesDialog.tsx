import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";

export function PreferencesDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const prefs = usePreferences();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" />
            {t("preferences")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("preferences")}</DialogTitle>
          <DialogDescription className="text-xs">{t("preferencesDesc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Language */}
          <Row label={t("language")}>
            <Select value={lang} onValueChange={(v) => setLang(v as "uk" | "en")}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uk" className="text-xs">{t("langUk")}</SelectItem>
                <SelectItem value="en" className="text-xs">{t("langEn")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* Theme */}
          <Row label={t("theme")}>
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light" className="text-xs">{t("themeLight")}</SelectItem>
                <SelectItem value="dark" className="text-xs">{t("themeDark")}</SelectItem>
                <SelectItem value="system" className="text-xs">{t("themeSystem")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* Default landing */}
          <Row label={t("defaultLanding")}>
            <Select
              value={prefs.defaultLanding}
              onValueChange={(v) => prefs.setPref("defaultLanding", v as typeof prefs.defaultLanding)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/" className="text-xs">{t("navOverview")}</SelectItem>
                <SelectItem value="/conversions" className="text-xs">{t("navFunnel")}</SelectItem>
                <SelectItem value="/campaigns" className="text-xs">{t("navCampaigns")}</SelectItem>
                <SelectItem value="/sales" className="text-xs">{t("navSales")}</SelectItem>
                <SelectItem value="/imports" className="text-xs">{t("navImports")}</SelectItem>
                <SelectItem value="/assistant" className="text-xs">{t("navAssistant")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* Default date mode */}
          <Row label={t("defaultDateMode")}>
            <Select
              value={prefs.defaultDateMode}
              onValueChange={(v) => prefs.setPref("defaultDateMode", v as typeof prefs.defaultDateMode)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset" className="text-xs">{t("quickPresets")}</SelectItem>
                <SelectItem value="exact" className="text-xs">{t("dateExact")}</SelectItem>
                <SelectItem value="range" className="text-xs">{t("dateCustom")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* Default view mode */}
          <Row label={t("defaultViewMode")}>
            <Select
              value={prefs.defaultViewMode}
              onValueChange={(v) => prefs.setPref("defaultViewMode", v as typeof prefs.defaultViewMode)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary" className="text-xs">{t("summaryView")}</SelectItem>
                <SelectItem value="daily" className="text-xs">{t("dailyView")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* Density */}
          <Row label={t("tableDensity")}>
            <Select
              value={prefs.tableDensity}
              onValueChange={(v) => prefs.setPref("tableDensity", v as typeof prefs.tableDensity)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable" className="text-xs">{t("densityComfortable")}</SelectItem>
                <SelectItem value="compact" className="text-xs">{t("densityCompact")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* Currency */}
          <Row label={t("currencyFormat")}>
            <Select
              value={prefs.currency}
              onValueChange={(v) => prefs.setPref("currency", v as typeof prefs.currency)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD" className="text-xs">USD ($)</SelectItem>
                <SelectItem value="EUR" className="text-xs">EUR (€)</SelectItem>
                <SelectItem value="UAH" className="text-xs">UAH (₴)</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* AI summary toggle */}
          <Row label={t("showAiSummary")}>
            <Switch
              checked={prefs.showAiSummary}
              onCheckedChange={(v) => prefs.setPref("showAiSummary", v)}
            />
          </Row>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={prefs.reset}>
            {t("resetDefaults")}
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
