import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search, Bell, ChevronRight, Activity } from "lucide-react";
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
  /** Optional last-sync metadata shown as a freshness pill in the page header */
  sync?: { source?: string; lastSync: string; status?: "fresh" | "stale" | "failed" };
  children: ReactNode;
}

export function DashboardLayout({ title, subtitle, actions, sync, children }: DashboardLayoutProps) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isApplePlatform, setIsApplePlatform] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const shortcutLabel = useMemo(() => (isApplePlatform ? "⌘K" : "Ctrl K"), [isApplePlatform]);

  const searchableRoutes = useMemo(
    () => [
      { labelUk: "Огляд", labelEn: "Overview", path: "/", aliases: ["робочий простір", "workspace"] },
      { labelUk: "Воронка", labelEn: "Funnel", path: "/funnel", aliases: [] },
      { labelUk: "Кампанії", labelEn: "Campaigns", path: "/campaigns", aliases: [] },
      { labelUk: "Продажі", labelEn: "Sales", path: "/sales", aliases: [] },
      { labelUk: "Імпорти", labelEn: "Imports", path: "/imports", aliases: ["якість даних", "data quality"] },
      { labelUk: "Онбординг", labelEn: "Onboarding", path: "/onboarding", aliases: [] },
      { labelUk: "Звʼязки даних", labelEn: "Data bindings", path: "/bindings", aliases: ["bindings"] },
      { labelUk: "Telegram", labelEn: "Alerts", path: "/alerts", aliases: ["сповіщення", "notifications"] },
      { labelUk: "Ads конектори", labelEn: "Ads connectors", path: "/ads-connectors", aliases: [] },
      { labelUk: "AI-асистент", labelEn: "AI assistant", path: "/assistant", aliases: [] },
    ],
    [],
  );

  const normalizedQuery = searchValue.trim().toLowerCase();
  const matchedRoutes = useMemo(() => {
    if (!normalizedQuery) return [];
    return searchableRoutes.filter((route) => {
      const haystack = [route.labelUk, route.labelEn, route.path, ...route.aliases].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, searchableRoutes]);

  const navigateToResult = (path: string) => {
    navigate(path);
    setSearchValue("");
    setShowSearchResults(false);
  };

  useEffect(() => {
    const platform = navigator.platform ?? "";
    const userAgent = navigator.userAgent ?? "";
    const isApple = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad|iPod/i.test(userAgent);
    setIsApplePlatform(isApple);

    const handleKeyDown = (event: KeyboardEvent) => {
      const shouldFocusSearch = isApple ? event.metaKey : event.ctrlKey;
      if (!shouldFocusSearch || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      searchInputRef.current?.focus();
      setShowSearchResults(Boolean(searchValue.trim()));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchValue]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background bg-hero">
        <AppSidebar />
        <div className="flex min-h-screen flex-1 min-w-0 flex-col">
          {/* Top bar — unified premium control strip */}
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 glass px-3 lg:px-4">
            <SidebarTrigger className="h-8 w-8 shrink-0 hover:bg-muted/60" />
            <div className="mx-1 hidden h-5 w-px bg-border/70 md:block" />

            {/* Context group: workspace › page */}
            <div className="hidden min-w-0 items-center gap-1.5 text-[12.5px] md:flex">
              <Link to="/" aria-label={t("goToOverview")} className="text-muted-foreground/80 transition-colors hover:text-foreground/80">
                {t("workspace")}
              </Link>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="truncate font-medium tracking-tight text-foreground/90">{title}</span>
            </div>

            {/* Right side: search + utilities + actions */}
            <div className="ml-auto flex items-center gap-1.5">
              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  ref={searchInputRef}
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setShowSearchResults(Boolean(e.target.value.trim()));
                  }}
                  onFocus={() => setShowSearchResults(Boolean(searchValue.trim()))}
                  onBlur={() => {
                    setTimeout(() => setShowSearchResults(false), 120);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchValue("");
                      setShowSearchResults(false);
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (matchedRoutes.length > 0) {
                        navigateToResult(matchedRoutes[0].path);
                      }
                    }
                  }}
                  placeholder={t("topSearchPlaceholder")}
                  aria-label={`${t("topSearchPlaceholder")} (${shortcutLabel})`}
                  className="h-8 w-[260px] rounded-md border-border/70 bg-background/60 pl-8 pr-12 text-[12.5px] shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border/70 bg-muted/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground xl:inline-flex">
                  {shortcutLabel}
                </kbd>

                {showSearchResults && (
                  <div className="absolute left-0 right-0 mt-1 overflow-hidden rounded-md border border-border/70 bg-popover shadow-lg">
                    {matchedRoutes.length > 0 ? (
                      <ul className="py-1">
                        {matchedRoutes.map((route) => (
                          <li key={route.path}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-muted/60"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => navigateToResult(route.path)}
                            >
                              <span>{lang === "en" ? route.labelEn : route.labelUk}</span>
                              <span className="text-muted-foreground">{route.path}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">{t("topSearchNoResults")}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="mx-1 hidden h-5 w-px bg-border/70 lg:block" />

              {/* Utilities group */}
              <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-card/40 p-0.5">
                <LangSwitcher />
                <ThemeSwitcher />
                <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary/40">
                  <Link to="/alerts" aria-label="Перейти до сповіщень">
                    <Bell className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <div className="mx-1 hidden h-5 w-px bg-border/70 md:block" />
              <UserMenu />
            </div>
          </header>

          {/* Page header — title + sync pill + actions */}
          <div className="border-b border-border/60 bg-card-elevated/40 backdrop-blur-sm">
            <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-end lg:justify-between lg:px-6 lg:py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-[22px] font-semibold leading-none tracking-[-0.02em] lg:text-[28px]">
                    {title}
                  </h1>
                  {sync && <SyncPill sync={sync} />}
                </div>
                {subtitle && (
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {actions && (
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">{actions}</div>
              )}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 overflow-x-hidden p-4 lg:p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SyncPill({ sync }: { sync: { source?: string; lastSync: string; status?: "fresh" | "stale" | "failed" } }) {
  const { t, lang } = useI18n();
  const status = sync.status ?? "fresh";
  const dot =
    status === "fresh"
      ? "bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.18)]"
      : status === "stale"
      ? "bg-warning shadow-[0_0_0_3px_hsl(var(--warning)/0.18)]"
      : "bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.18)]";
  return (
    <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] text-muted-foreground md:inline-flex">
      <span className={"inline-flex h-1.5 w-1.5 rounded-full " + dot} />
      <Activity className="h-3 w-3 text-muted-foreground/70" />
      <span className="text-muted-foreground/90">{t("lastSync")}</span>
      <span className="font-medium text-foreground/85 num">{sync.lastSync}</span>
      {sync.source && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground/80">{sync.source}</span>
        </>
      )}
    </div>
  );
}
