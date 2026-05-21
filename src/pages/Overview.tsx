import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, unknown>;

function shouldRetryWithoutWorkspace(errorMessage: string | null) {
  if (!errorMessage) return false;
  const m = errorMessage.toLowerCase();
  return m.includes("workspace_id") && (m.includes("column") || m.includes("schema cache") || m.includes("could not find"));
}

const countView = async (view: string) => {
  const scoped = await supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID);
  if (!scoped.error) return { count: (scoped.data ?? []).length, error: null };
  if (shouldRetryWithoutWorkspace(scoped.error.message)) {
    const fallback = await supabase.from(view).select("*");
    return { count: (fallback.data ?? []).length, error: fallback.error?.message ?? null };
  }
  return { count: 0, error: scoped.error.message };
};


const OPEN_STATUSES = ["open","active","pending","unresolved"];
const CLOSED_STATUSES = ["resolved","closed","archived"];
const countOpenAlerts = async () => {
  const res = await supabase.from("v_operational_alerts_recent").select("*").eq("workspace_id", WORKSPACE_ID);
  const rows = (res.data ?? []) as Row[];
  if (rows.length === 0) return { count: 0, error: res.error?.message ?? null, label: "Відкриті сповіщення" };
  const hasStatus = rows.some((r) => r.status !== undefined);
  if (hasStatus) {
    const count = rows.filter((r) => { const st=String(r.status ?? "").toLowerCase(); return OPEN_STATUSES.includes(st) && !CLOSED_STATUSES.includes(st); }).length;
    return { count, error: res.error?.message ?? null, label: "Відкриті сповіщення" };
  }
  const hasResolved = rows.some((r) => r.resolved_at !== undefined);
  if (hasResolved) return { count: rows.filter((r)=>!r.resolved_at).length, error: res.error?.message ?? null, label: "Відкриті сповіщення" };
  return { count: rows.length, error: res.error?.message ?? null, label: "Останні сповіщення" };
};

export default function Overview() {
  const { session } = useAuth();
  const readiness = useQuery({ queryKey: ["backend-readiness", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const { data, error } = await supabase.from("v_production_backend_snapshot").select("*").eq("workspace_id", WORKSPACE_ID).maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  }});
  const counts = useQuery({ queryKey: ["overview-counts", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const [clients, projects, funnels, sources, ads, mapping, alerts] = await Promise.all([
      countView("v_clients"), countView("v_projects"), countView("v_funnels"), countView("v_source_entity_bindings"), countView("v_ad_account_bindings"), countView("v_mapping_review_queue"), countOpenAlerts(),
    ]);
    return { clients, projects, funnels, sources, ads, mapping, alerts };
  }});
  const activity = useQuery({ queryKey: ["overview-activity", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const [importHealth, importErrors, aiHealth] = await Promise.all([
      supabase.from("v_import_health").select("*").eq("workspace_id", WORKSPACE_ID).limit(10),
      supabase.from("v_import_error_summary").select("*").eq("workspace_id", WORKSPACE_ID).limit(10),
      supabase.from("v_ai_helper_health").select("*").eq("workspace_id", WORKSPACE_ID).limit(10),
    ]);
    return {
      hasImports: (importHealth.data ?? []).length > 0,
      hasImportErrors: (importErrors.data ?? []).length > 0,
      aiOk: aiHealth.error ? null : (aiHealth.data ?? []).length > 0,
      errors: { importHealth: importHealth.error?.message, importErrors: importErrors.error?.message, aiHealth: aiHealth.error?.message },
    };
  }});

  const r = readiness.data ?? {};
  const cards = [
    ["Стан системи", r.technical_status === "PASS" ? "Система працює" : "Триває перевірка"],
    ["Підключення даних", Number(r.failed_checks ?? 1) === 0 ? "Критичних помилок немає" : "Є пункти, що потребують уваги"],
    ["Клієнти / проєкти / воронки", String(r.onboarding_status ?? "") === "ready" ? "Дані доступні" : "Налаштування триває"],
    ["Рекламні дані", ["ads_setup_required"].includes(String(r.production_backend_status ?? r.snapshot_status)) ? "Потрібно підключити рекламні акаунти" : "Рекламні дані доступні"],
    ["AI-асистент", String(r.ai_helper_status ?? "ready") === "ready" ? "AI-асистент доступний" : "Перевіряємо доступність"],
    ["Сповіщення", String(r.operational_alerts_status ?? "ready") === "ready" ? "Сповіщення працюють" : "Потрібна увага"],
  ];

  const steps = useMemo(() => {
    const arr: { text: string; href: string; label: string }[] = [];
    if (["ads_setup_required"].includes(String(r.production_backend_status ?? r.snapshot_status))) arr.push({ text: "Підключіть рекламні акаунти, щоб побачити витрати та ефективність реклами.", href: "/ads-connectors", label: "Перейти до Ads конекторів" });
    if ((counts.data?.clients.count ?? 0) === 0 || (counts.data?.projects.count ?? 0) === 0 || (counts.data?.funnels.count ?? 0) === 0) arr.push({ text: "Додайте клієнта, проєкт і воронку.", href: "/onboarding", label: "Перейти до онбордингу" });
    if ((counts.data?.mapping.count ?? 0) > 0) arr.push({ text: "Перевірте мапінг джерел даних.", href: "/bindings", label: "Перейти до звʼязків даних" });
    if ((counts.data?.alerts.count ?? 0) > 0) arr.push({ text: "Перевірте відкриті сповіщення.", href: "/alerts", label: "Перейти до сповіщень" });
    if (!arr.length) arr.push({ text: "Основні налаштування виглядають готовими.", href: "/", label: "Готово" });
    return arr;
  }, [r.production_backend_status, r.snapshot_status, counts.data]);

  return <DashboardLayout title="Огляд" subtitle="Головний дашборд робочого простору">
    <div className="space-y-4">
      {!session ? <SectionCard title="Огляд"><p className="text-sm text-muted-foreground">Увійдіть, щоб побачити огляд робочого простору.</p></SectionCard> : null}
      {readiness.error ? <FriendlyError message="Потрібне оновлення backend для цього розділу." technical={readiness.error.message} /> : null}
      {session && !readiness.error && <SectionCard title="Стан робочого простору"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, desc]) => <div key={String(title)} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="font-medium">{desc}</p></div>)}</div></SectionCard>}

      <SectionCard title="Налаштування робочого простору"><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[
        ["Клієнти", counts.data?.clients], ["Проєкти", counts.data?.projects], ["Воронки", counts.data?.funnels], ["Джерела даних", counts.data?.sources], ["Рекламні акаунти", counts.data?.ads], ["Мапінг на перевірку", counts.data?.mapping], [String((counts.data?.alerts as {label?:string}|undefined)?.label ?? "Відкриті сповіщення"), counts.data?.alerts],
      ].map(([label, item]) => <div key={String(label)} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{(item as {error:string|null,count:number}|undefined)?.error ? "Дані поки недоступні" : (item as {count:number}|undefined)?.count ?? "—"}</p></div>)}</div></SectionCard>

      <SectionCard title="Наступні кроки"><div className="space-y-3">{steps.map((s, i) => <div key={i} className="rounded-md border p-3"><p className="text-sm">{s.text}</p><Button asChild variant="outline" size="sm" className="mt-2"><Link to={s.href}>{s.label}</Link></Button></div>)}</div></SectionCard>

      <SectionCard title="Остання активність"><ul className="space-y-2 text-sm"><li>{activity.data?.hasImports ? "Імпорти оновлюються" : "Імпортів поки немає"}</li><li>{activity.data?.hasImportErrors ? "Є помилки імпорту" : "Помилок імпорту немає"}</li><li>{(counts.data?.alerts.count ?? 0) > 0 ? "Є відкриті сповіщення" : "Критичних сповіщень немає"}</li><li>{activity.data?.aiOk === false ? "AI тимчасово недоступний" : "AI працює"}</li></ul></SectionCard>

      <DeveloperDetails><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify({ readiness: readiness.data, counts: counts.data, activity: activity.data, errors: activity.data?.errors }, null, 2)}</pre></DeveloperDetails>
    </div>
  </DashboardLayout>;
}
