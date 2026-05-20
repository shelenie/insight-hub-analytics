import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  GitBranch,
  Megaphone,
  DollarSign,
  Database,
  Sparkles,
  Activity,
  Layers3,
  Link2,
  BellRing,
  PlugZap,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

const navSections: { label: string; items: { titleKey: TranslationKey; url: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Аналітика",
    items: [
      { titleKey: "navOverview", url: "/", icon: LayoutDashboard },
      { titleKey: "navFunnel", url: "/funnel", icon: GitBranch },
      { titleKey: "navCampaigns", url: "/campaigns", icon: Megaphone },
      { titleKey: "navSales", url: "/sales", icon: DollarSign },
      { titleKey: "navImports", url: "/imports", icon: Database },
    ],
  },
  {
    label: "Операції",
    items: [
      { titleKey: "navOnboarding", url: "/onboarding", icon: Layers3 },
      { titleKey: "navBindingsMapping", url: "/bindings", icon: Link2 },
      { titleKey: "navTelegramAlerts", url: "/alerts", icon: BellRing },
      { titleKey: "navAdsConnectors", url: "/ads-connectors", icon: PlugZap },
    ],
  },
  {
    label: "AI",
    items: [{ titleKey: "navAssistant", url: "/assistant", icon: Sparkles }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t } = useI18n();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-accent text-primary-foreground shadow-card-md">
            <Activity className="h-4 w-4" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-sidebar-background" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-foreground">Insight Hub</span>
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                {t("appTagline")}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 sidebar-scroll">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
              {t("workspace")}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navSections.map((section) => (
                <div key={section.label} className="space-y-1">
                  {!collapsed && (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                      {section.label}
                    </p>
                  )}
                  {section.items.map((item) => {
                const title = t(item.titleKey);
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={title}
                      className="relative h-9 rounded-md text-[13px] data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold"
                    >
                      <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-2.5">
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r-full bg-primary" />
                        )}
                        <item.icon className="h-[15px] w-[15px] shrink-0" />
                        {!collapsed && <span className="truncate">{title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
                  })}
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && <div className="sidebar-sep my-3 mx-2" />}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed ? (
          <div className="px-2 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-medium text-foreground/80">{t("systemsOk")}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <span className="h-2 w-2 rounded-full bg-success" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
