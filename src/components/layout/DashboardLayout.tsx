import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LangSwitcher } from "@/components/header/LangSwitcher";
import { ThemeSwitcher } from "@/components/header/ThemeSwitcher";
import { UserMenu } from "@/components/header/UserMenu";
import { useI18n } from "@/i18n/I18nProvider";

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ title, subtitle, actions, children }: DashboardLayoutProps) {
  const { t } = useI18n();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background bg-hero">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar — glass control surface */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 glass px-4">
            <SidebarTrigger className="hover:bg-muted/60" />
            <div className="flex flex-1 items-center gap-3">
              <div className="hidden md:flex items-center gap-1.5 text-[13px]">
                <span className="text-muted-foreground">{t("workspace")}</span>
                <span className="text-muted-foreground/60">/</span>
                <span className="font-semibold tracking-tight">{title}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="relative hidden lg:block">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    className="h-8 w-64 border-border/70 bg-background/60 pl-8 text-[13px] focus-visible:ring-1"
                  />
                </div>
                <div className="mx-1 hidden h-5 w-px bg-border/70 lg:block" />
                <LangSwitcher />
                <ThemeSwitcher />
                <Button variant="ghost" size="icon" className="h-8 w-8 relative hover:bg-muted/60">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-card" />
                </Button>
                <UserMenu />
              </div>
            </div>
          </header>

          {/* Page header */}
          <div className="border-b border-border/60 bg-card/40 backdrop-blur-sm">
            <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-5">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-tight lg:text-[26px]">{title}</h1>
                {subtitle && (
                  <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 overflow-x-auto p-4 lg:p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
