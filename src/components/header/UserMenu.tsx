import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Languages, Sun, Check } from "lucide-react";

function initialsFromEmail(email?: string | null) {
  if (!email) return "··";
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? name[0] ?? "U";
  const b = parts[1]?.[0] ?? name[1] ?? "";
  return (a + b).toUpperCase();
}

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const initials = initialsFromEmail(user?.email);
  const displayName = user?.email?.split("@")[0] ?? "Аналітик";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 gap-2 pl-1 pr-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary-soft text-[11px] font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-xs font-medium md:inline">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          <div className="font-medium">{displayName}</div>
          <div className="text-[11px] font-normal text-muted-foreground">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-xs">
            <Languages className="h-3.5 w-3.5" />
            {t("language")}
            <span className="ml-auto text-muted-foreground uppercase">{lang}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => setLang("uk")} className="gap-2 text-xs">
              {lang === "uk" && <Check className="h-3.5 w-3.5" />} {t("langUk")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLang("en")} className="gap-2 text-xs">
              {lang === "en" && <Check className="h-3.5 w-3.5" />} {t("langEn")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-xs">
            <Sun className="h-3.5 w-3.5" />
            {t("theme")}
            <span className="ml-auto text-muted-foreground capitalize">{theme}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => setTheme("light")} className="gap-2 text-xs">
              {theme === "light" && <Check className="h-3.5 w-3.5" />} {t("themeLight")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")} className="gap-2 text-xs">
              {theme === "dark" && <Check className="h-3.5 w-3.5" />} {t("themeDark")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")} className="gap-2 text-xs">
              {theme === "system" && <Check className="h-3.5 w-3.5" />} {t("themeSystem")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()} className="gap-2 text-xs text-destructive focus:text-destructive">
          <LogOut className="h-3.5 w-3.5" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
