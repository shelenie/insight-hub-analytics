import { useI18n } from "@/i18n/I18nProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages, Check } from "lucide-react";

export function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-medium">
          <Languages className="h-4 w-4" />
          <span className="uppercase">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => setLang("uk")} className="gap-2 text-xs">
          {lang === "uk" ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
          {t("langUk")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setLang("en")} className="gap-2 text-xs">
          {lang === "en" ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
          {t("langEn")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
