// Mock data for the internal analytics dashboard.
// Replace these with Supabase queries against fact_* tables when wiring up.

export const projects = [
  { id: "all", name: "All projects" },
  { id: "pulse-edu", name: "Pulse Education" },
  { id: "atlas-fin", name: "Atlas Finance" },
  { id: "nova-health", name: "Nova Health" },
  { id: "loop-saas", name: "Loop SaaS" },
];

export const reportGroups = [
  { id: "all", name: "All groups" },
  { id: "webinar-q4", name: "Webinar Q4" },
  { id: "evergreen-fb", name: "Evergreen FB" },
  { id: "launch-may", name: "Spring Launch" },
  { id: "retention", name: "Retention" },
];

export const dateRanges = [
  { id: "today", name: "Today" },
  { id: "7d", name: "Last 7 days" },
  { id: "30d", name: "Last 30 days" },
  { id: "mtd", name: "Month to date" },
  { id: "qtd", name: "Quarter to date" },
  { id: "custom", name: "Custom" },
];

export type Kpi = {
  key: string;
  label: string;
  value: number;
  unit?: "currency" | "number" | "percent";
  delta?: number; // percent vs previous period
  hint?: string;
};

export const overviewKpis: Kpi[] = [
  { key: "spend", label: "Spend", value: 184320, unit: "currency", delta: 8.4 },
  { key: "reach", label: "Reach", value: 2840000, unit: "number", delta: 12.1 },
  { key: "clicks", label: "Clicks", value: 96420, unit: "number", delta: 4.6 },
  { key: "regs", label: "Registrations", value: 14820, unit: "number", delta: -2.3 },
  { key: "apps", label: "Applications", value: 3210, unit: "number", delta: 5.7 },
  { key: "bookings", label: "Bookings", value: 1840, unit: "number", delta: 1.2 },
  { key: "viewers", label: "Viewers", value: 7820, unit: "number", delta: -0.8 },
  { key: "sales", label: "Sales", value: 612, unit: "number", delta: 9.4 },
  { key: "revPlan", label: "Revenue Plan", value: 480000, unit: "currency" },
  { key: "revFact", label: "Revenue Fact", value: 512840, unit: "currency", delta: 6.8 },
  { key: "roas", label: "ROAS", value: 2.78, unit: "number", delta: 3.1, hint: "x" },
];

export const revenueVsSpend = [
  { day: "Apr 01", revenue: 14200, spend: 5200 },
  { day: "Apr 03", revenue: 16800, spend: 5800 },
  { day: "Apr 05", revenue: 15200, spend: 6100 },
  { day: "Apr 07", revenue: 19400, spend: 6400 },
  { day: "Apr 09", revenue: 22100, spend: 6900 },
  { day: "Apr 11", revenue: 18900, spend: 6500 },
  { day: "Apr 13", revenue: 24800, spend: 7200 },
  { day: "Apr 15", revenue: 26200, spend: 7600 },
  { day: "Apr 17", revenue: 23100, spend: 7100 },
  { day: "Apr 19", revenue: 28400, spend: 7800 },
  { day: "Apr 21", revenue: 31200, spend: 8200 },
  { day: "Apr 23", revenue: 29800, spend: 8000 },
  { day: "Apr 25", revenue: 33400, spend: 8600 },
  { day: "Apr 27", revenue: 35100, spend: 8900 },
];

export const topCampaigns = [
  { campaign: "WBN-Q4-LAL3-Video", project: "Pulse Education", spend: 18420, regs: 1820, sales: 84, revenue: 92400, roas: 5.02 },
  { campaign: "EVG-FB-Interest-A", project: "Atlas Finance", spend: 14200, regs: 1310, sales: 62, revenue: 71800, roas: 5.06 },
  { campaign: "Launch-May-IG-Reels", project: "Nova Health", spend: 22100, regs: 1140, sales: 58, revenue: 68400, roas: 3.09 },
  { campaign: "Retention-Email-Push", project: "Loop SaaS", spend: 6800, regs: 420, sales: 41, revenue: 49200, roas: 7.24 },
  { campaign: "WBN-Q4-Cold-Static", project: "Pulse Education", spend: 16800, regs: 980, sales: 38, revenue: 41600, roas: 2.48 },
  { campaign: "Atlas-Search-Brand", project: "Atlas Finance", spend: 4200, regs: 360, sales: 34, revenue: 39800, roas: 9.48 },
];

export const topReportGroups = [
  { group: "Webinar Q4", project: "Pulse Education", spend: 48400, sales: 184, revenue: 218400, roas: 4.51, status: "healthy" as const },
  { group: "Evergreen FB", project: "Atlas Finance", spend: 32800, sales: 142, revenue: 168200, roas: 5.13, status: "healthy" as const },
  { group: "Spring Launch", project: "Nova Health", spend: 41200, sales: 96, revenue: 102400, roas: 2.49, status: "warning" as const },
  { group: "Retention", project: "Loop SaaS", spend: 12400, sales: 88, revenue: 94800, roas: 7.65, status: "healthy" as const },
];

export const anomalies = [
  { id: 1, severity: "critical" as const, title: "CPL spike on WBN-Q4-Cold-Static", detail: "CPL jumped 78% vs 7-day avg", time: "12 min ago" },
  { id: 2, severity: "warning" as const, title: "Registrations dropped — Nova Health", detail: "−24% vs yesterday across Spring Launch", time: "1 h ago" },
  { id: 3, severity: "info" as const, title: "ROAS improved — Atlas Search Brand", detail: "+31% over last 3 days", time: "3 h ago" },
  { id: 4, severity: "warning" as const, title: "Missing pixel events", detail: "Lead events not received from LP-may-3", time: "5 h ago" },
];

export const dataFreshness = [
  { source: "Facebook Ads", lastSync: "2 min ago", status: "fresh" as const },
  { source: "Google Ads", lastSync: "8 min ago", status: "fresh" as const },
  { source: "TikTok Ads", lastSync: "4 h ago", status: "stale" as const },
  { source: "CRM Sales", lastSync: "12 min ago", status: "fresh" as const },
  { source: "Webinar Platform", lastSync: "Failed", status: "failed" as const },
];

export const aiInsights = [
  "ROAS for Atlas Finance grew +18% this week, driven by Search Brand campaign — consider scaling budget by 20-30%.",
  "Registrations on Nova Health dropped 24% in 24h. Likely cause: creative fatigue on Spring Launch — refresh top 3 ads.",
  "Retention email-push delivers 7.24x ROAS at low spend. Worth a dedicated test budget next week.",
];

// Funnel page
export const funnelSteps = [
  { step: "Reach", value: 840000, conv: 100 },
  { step: "Clicks", value: 28400, conv: 3.4 },
  { step: "Registrations", value: 4820, conv: 17.0 },
  { step: "Applications", value: 1240, conv: 25.7 },
  { step: "Bookings", value: 720, conv: 58.1 },
  { step: "Viewers", value: 510, conv: 70.8 },
  { step: "Sales", value: 184, conv: 36.1 },
];

export const dailyTrend = revenueVsSpend.map((d) => ({
  day: d.day,
  registrations: Math.round(d.revenue / 28),
  sales: Math.round(d.revenue / 320),
}));

export const salesPlanFact = [
  { week: "W14", plan: 80000, fact: 72400 },
  { week: "W15", plan: 90000, fact: 96200 },
  { week: "W16", plan: 100000, fact: 104800 },
  { week: "W17", plan: 110000, fact: 118400 },
  { week: "W18", plan: 120000, fact: 121040 },
];

export const trafficByCampaign = topCampaigns;

// Campaigns page
export const campaignsTable = [
  { campaign: "WBN-Q4-LAL3-Video", placement: "FB Feed", spend: 18420, reach: 482000, clicks: 9840, cpc: 1.87, cpm: 38.21, ctr: 2.04, regs: 1820, cpl: 10.12, sales: 84, revenue: 92400, roas: 5.02 },
  { campaign: "WBN-Q4-LAL3-Video", placement: "IG Reels", spend: 8420, reach: 312000, clicks: 5210, cpc: 1.61, cpm: 26.99, ctr: 1.67, regs: 740, cpl: 11.38, sales: 32, revenue: 36800, roas: 4.37 },
  { campaign: "EVG-FB-Interest-A", placement: "FB Feed", spend: 14200, reach: 386000, clicks: 7280, cpc: 1.95, cpm: 36.78, ctr: 1.88, regs: 1310, cpl: 10.84, sales: 62, revenue: 71800, roas: 5.06 },
  { campaign: "EVG-FB-Interest-A", placement: "Audience Network", spend: 3200, reach: 142000, clicks: 1820, cpc: 1.76, cpm: 22.53, ctr: 1.28, regs: 240, cpl: 13.33, sales: 11, revenue: 12800, roas: 4.0 },
  { campaign: "Launch-May-IG-Reels", placement: "IG Reels", spend: 22100, reach: 612000, clicks: 9620, cpc: 2.30, cpm: 36.11, ctr: 1.57, regs: 1140, cpl: 19.39, sales: 58, revenue: 68400, roas: 3.09 },
  { campaign: "Retention-Email-Push", placement: "Owned", spend: 6800, reach: 84000, clicks: 12400, cpc: 0.55, cpm: 80.95, ctr: 14.76, regs: 420, cpl: 16.19, sales: 41, revenue: 49200, roas: 7.24 },
  { campaign: "WBN-Q4-Cold-Static", placement: "FB Feed", spend: 16800, reach: 408000, clicks: 6120, cpc: 2.74, cpm: 41.18, ctr: 1.50, regs: 980, cpl: 17.14, sales: 38, revenue: 41600, roas: 2.48 },
  { campaign: "Atlas-Search-Brand", placement: "Google Search", spend: 4200, reach: 64000, clicks: 3840, cpc: 1.09, cpm: 65.63, ctr: 6.0, regs: 360, cpl: 11.67, sales: 34, revenue: 39800, roas: 9.48 },
];

// Sales page
export const salesKpis: Kpi[] = [
  { key: "salesCount", label: "Sales count", value: 612, unit: "number", delta: 9.4 },
  { key: "revFact", label: "Revenue fact", value: 512840, unit: "currency", delta: 6.8 },
  { key: "revPlan", label: "Revenue plan", value: 480000, unit: "currency" },
  { key: "avgCheck", label: "Average чек", value: 838, unit: "currency", delta: -2.1 },
  { key: "payConv", label: "Payment conversion", value: 64.2, unit: "percent", delta: 1.8 },
];

export const salesBySource = [
  { source: "Facebook Ads", sales: 248, revenue: 208400 },
  { source: "Google Ads", sales: 142, revenue: 132800 },
  { source: "Email / CRM", sales: 98, revenue: 84200 },
  { source: "Organic / Direct", sales: 84, revenue: 62100 },
  { source: "TikTok Ads", sales: 40, revenue: 25340 },
];

export const salesByLeadType = [
  { type: "Webinar", sales: 264, revenue: 232800 },
  { size: "warm", type: "Application", sales: 184, revenue: 168400 },
  { type: "Direct booking", sales: 96, revenue: 78200 },
  { type: "Cold / Form", sales: 68, revenue: 33440 },
];

export const salesByTariff = [
  { tariff: "Standard", sales: 312, revenue: 187200 },
  { tariff: "Premium", sales: 184, revenue: 220800 },
  { tariff: "VIP", sales: 64, revenue: 89600 },
  { tariff: "Доплата", sales: 52, revenue: 15240, excluded: true },
];

export const revenueOverTime = revenueVsSpend.map((d) => ({ day: d.day, revenue: d.revenue }));

// Imports / Data Health
export type ImportStatus = "success" | "partial" | "failed";
export const importRuns: {
  id: string;
  source: string;
  startedAt: string;
  duration: string;
  rowsReceived: number;
  rowsInserted: number;
  rowsFailed: number;
  status: ImportStatus;
  error?: string;
}[] = [
  { id: "imp_018f", source: "Facebook Ads → fact_campaigns", startedAt: "Apr 27, 14:32", duration: "12s", rowsReceived: 4820, rowsInserted: 4820, rowsFailed: 0, status: "success" },
  { id: "imp_018e", source: "Google Sheets → fact_sales", startedAt: "Apr 27, 14:25", duration: "8s", rowsReceived: 184, rowsInserted: 178, rowsFailed: 6, status: "partial", error: "6 rows: tariff value not in mapping table" },
  { id: "imp_018d", source: "TikTok Ads → fact_campaigns", startedAt: "Apr 27, 10:14", duration: "—", rowsReceived: 0, rowsInserted: 0, rowsFailed: 0, status: "failed", error: "Auth token expired (401)" },
  { id: "imp_018c", source: "Webinar CSV → fact_daily", startedAt: "Apr 27, 09:02", duration: "4s", rowsReceived: 96, rowsInserted: 96, rowsFailed: 0, status: "success" },
  { id: "imp_018b", source: "CRM → fact_sales", startedAt: "Apr 27, 08:45", duration: "18s", rowsReceived: 612, rowsInserted: 612, rowsFailed: 0, status: "success" },
  { id: "imp_018a", source: "Google Ads → fact_campaigns", startedAt: "Apr 27, 08:12", duration: "9s", rowsReceived: 1240, rowsInserted: 1234, rowsFailed: 6, status: "partial", error: "6 rows: campaign_id missing in mapping" },
];

export const unknownMappings = [
  { id: 1, type: "tariff", value: "VIP+", source: "fact_sales", count: 14, suggested: "VIP" },
  { id: 2, type: "campaign", value: "wbn_q4_v2_lal3", source: "fact_campaigns", count: 8, suggested: "WBN-Q4-LAL3-Video" },
  { id: 3, type: "lead_type", value: "applic.", source: "fact_sales", count: 22, suggested: "Application" },
  { id: 4, type: "project", value: "pulse_edu", source: "fact_daily", count: 4, suggested: "Pulse Education" },
];

export const dataQualityAlerts = [
  { id: 1, severity: "warning" as const, message: "fact_daily missing rows for 2026-04-26 (Nova Health)" },
  { id: 2, severity: "critical" as const, message: "TikTok Ads sync failing for 4+ hours" },
  { id: 3, severity: "info" as const, message: "Mapping queue has 4 unresolved items" },
];

// AI Assistant
export const suggestedPrompts = [
  "Що змінилось за останні 7 днів?",
  "Які кампанії дали найкращий ROAS?",
  "Де просіли реєстрації?",
  "Що зараз працює найкраще?",
  "Що погіршилось у порівнянні з минулим тижнем?",
];

export const aiChatSeed = [
  {
    role: "assistant" as const,
    content:
      "Привіт 👋 Я аналітичний асистент. Я працюю тільки з підготовленими fact-таблицями і не змінюю сирі дані чи мапінги. Спитай про метрики, кампанії або тренди.",
  },
];
