import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, unknown>;

export default function Overview() {
  const { session } = useAuth();
  const readiness = useQuery({ queryKey: ["backend-readiness", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const { data, error } = await supabase.from("v_production_backend_snapshot").select("*").eq("workspace_id", WORKSPACE_ID).maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  }});
  const contract = useQuery({ queryKey: ["ui-backend-contract", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const result = await supabase.from("v_ui_backend_contract").select("*").eq("workspace_id", WORKSPACE_ID).limit(20);
    return { rows: (result.data ?? []) as Row[], unavailableReason: result.error?.message ?? null };
  }});

  const r = readiness.data ?? {};
  const cards = [
    ["Стан системи", r.technical_status === "PASS" ? "Система працює" : "Триває перевірка"],
    ["Підключення даних", Number(r.failed_checks ?? 1) === 0 ? "Критичних помилок немає" : "Є пункти, що потребують уваги"],
    ["Клієнти / проєкти / воронки", String(r.onboarding_status ?? "unknown") === "ready" ? "Дані доступні" : "Налаштування триває"],
    ["Рекламні дані", String(r.production_backend_status) === "ads_setup_required" ? "Потрібно підключити рекламні акаунти" : "Рекламні дані доступні"],
    ["AI-асистент", String(r.ai_helper_status ?? "ready") === "ready" ? "AI-асистент доступний" : "Перевіряємо доступність"],
    ["Сповіщення", String(r.operational_alerts_status ?? "ready") === "ready" ? "Сповіщення працюють" : "Потрібна увага"],
  ];

  return <DashboardLayout title="Overview" subtitle="Огляд робочого простору">
    <div className="space-y-4">
      {!session ? <SectionCard title="Overview"><p className="text-sm text-muted-foreground">Увійдіть, щоб побачити огляд робочого простору.</p></SectionCard> : readiness.isLoading ? <SectionCard title="Overview"><p className="text-sm text-muted-foreground">Завантаження…</p></SectionCard> : null}
      {readiness.error ? <FriendlyError message="Потрібне оновлення backend для цього розділу." technical={readiness.error.message} /> : null}
      {session && !readiness.error && !readiness.isLoading ? <SectionCard title="Стан робочого простору"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, desc]) => <div key={title} className="rounded-md border border-border/70 bg-card/40 p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="font-medium">{desc}</p></div>)}</div>{String(r.snapshot_status) === "ads_setup_required" ? <p className="mt-3 text-sm text-muted-foreground">Щоб побачити рекламні дані, підключіть рекламні акаунти.</p> : null}</SectionCard> : null}
      <DeveloperDetails>
        {contract.data?.unavailableReason ? <p>Цей розділ поки недоступний.</p> : <p>Contract rows: {(contract.data?.rows.length ?? 0)}</p>}
        {contract.data?.unavailableReason ? <p className="break-words mt-2">{contract.data.unavailableReason}</p> : null}
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify({ readiness: readiness.data, contract: contract.data?.rows ?? [] }, null, 2)}</pre>
      </DeveloperDetails>
    </div>
  </DashboardLayout>;
}
