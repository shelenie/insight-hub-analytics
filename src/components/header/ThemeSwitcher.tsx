import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n/I18nProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor, Check } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme, resolved } = useTheme();
  const { t } = useI18n();

  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary/40">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={() => setTheme("light")} className="gap-2 text-xs">
          {theme === "light" ? <Check className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          {t("themeLight")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")} className="gap-2 text-xs">
          {theme === "dark" ? <Check className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {t("themeDark")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")} className="gap-2 text-xs">
          {theme === "system" ? <Check className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
          {t("themeSystem")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
