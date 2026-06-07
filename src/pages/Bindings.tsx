import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const ADS_SUBNAV_TRIGGER_CLASS =
  "h-10 whitespace-nowrap rounded-lg border border-transparent px-4 text-sm font-semibold transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm";

type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };
type BindingsData = {
  sourceBindings: Row[];
  adAccountBindings: Row[];
  projectDataBindings: Row[];
  mappingReviewQueue: Row[];
  bindingHealth: Row[];
  mappingReviewHealth: OptionalViewData;
  mappingReviewActionsRecent: OptionalViewData;
  telegramHitlHealth: OptionalViewData;
};
type BindingType = "source" | "ad_account";

const FRIENDLY_COLUMN_LABELS: Record<string, string> = {
  ad_account_name: "Рекламний акаунт",
  binding_method: "Метод",
  binding_status: "Статус звʼязку",
  binding_type: "Тип звʼязку",
  campaign: "Кампанія",
  client: "Клієнт",
  client_name: "Клієнт",
  confidence: "Впевненість",
  created_at: "Створено",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  details: "Деталі",
  external_account_id: "ID акаунта",
  funnel: "Воронка",
  funnel_name: "Воронка",
  health_status: "Стан звʼязків",
  impressions: "Покази",
  mapping_status: "Статус мапінгу",
  platform: "Платформа",
  project: "Проєкт",
  project_name: "Проєкт",
  proposed_client_name: "Запропонований клієнт",
  proposed_funnel_name: "Запропонована воронка",
  proposed_project_name: "Запропонований проєкт",
  reach: "Охоплення",
  reason: "Причина",
  source_kind: "Тип джерела",
  source_name: "Джерело",
  spend: "Витрати",
  status: "Статус",
  updated_at: "Оновлено",
};

const FRIENDLY_VALUE_LABELS: Record<string, string> = {
  active: "Активний",
  ad_account: "Рекламний акаунт",
  confirmed: "Підтверджено",
  healthy: "Все гаразд",
  manual: "Вручну",
  pending: "Очікує",
  rejected: "Відхилено",
  resolved_not_applied: "Підтверджено, не застосовано",
  source: "Джерело даних",
};

const STATUS_COLUMNS = new Set(["binding_method", "binding_status", "binding_type", "health_status", "mapping_status", "platform", "status"]);
const PLACEHOLDER_PATTERNS = ["test agency", "test client", "northstar digital clinic", "evergreen growth program", "main webinar funnel", "placeholder", "demo", "mock", "test_upload", "backend_test"];

function isPlaceholderRow(row: Row) {
  const text = Object.values(row).join(" ").toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => text.includes(pattern));
}

function filterRows(rows: Row[]) {
  return rows.filter((row) => !isPlaceholderRow(row));
}

export default function Bindings() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const canManage = capabilities.can_manage_bindings || capabilities.can_manage_mapping_review;
  const [message, setMessage] = useState<string>("Дії перевіряються перед виконанням.");
  const [pending, setPending] = useState<string>("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [sourceForm, setSourceForm] = useState({ source_id: "", client_id: "", project_id: "", funnel_id: "" });
  const [adForm, setAdForm] = useState({ ad_account_id: "", client_id: "", project_id: "", funnel_id: "" });

  const query = useQuery<BindingsData>({
    queryKey: ["bindings-mapping-workspace", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [sourceRes, adRes, projectRes, queueRes, healthRes] = await Promise.all([
        supabase.from("v_source_entity_bindings").select("*"),
        supabase.from("v_ad_account_bindings").select("*"),
        supabase.from("v_project_data_bindings").select("*"),
        supabase.from("v_mapping_review_queue").select("*"),
        supabase.from("v_binding_health").select("*"),
      ]);
      if (sourceRes.error) throw sourceRes.error;
      if (adRes.error) throw adRes.error;
      if (projectRes.error) throw projectRes.error;
      if (queueRes.error) throw queueRes.error;
      if (healthRes.error) throw healthRes.error;

      const [mappingReviewHealth, mappingReviewActionsRecent, telegramHitlHealth] = await Promise.all([
        readOptionalView("v_mapping_review_health"),
        readOptionalView("v_mapping_review_actions_recent"),
        readOptionalView("v_telegram_hitl_production_health"),
      ]);

      return {
        sourceBindings: (sourceRes.data ?? []) as Row[],
        adAccountBindings: (adRes.data ?? []) as Row[],
        projectDataBindings: (projectRes.data ?? []) as Row[],
        mappingReviewQueue: (queueRes.data ?? []) as Row[],
        bindingHealth: (healthRes.data ?? []) as Row[],
        mappingReviewHealth,
        mappingReviewActionsRecent,
        telegramHitlHealth,
      };
    },
  });

  const runAction = async (key: string, fn: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    setPending(key);
    setMessage("");
    const { data, error } = await fn();
    setPending("");
    if (error) {
      setMessage("Цей розділ поки недоступний.");
      return;
    }
    if ((data as { ok?: boolean; error?: string } | null)?.ok === false) {
      setMessage((data as { error?: string }).error ?? "Не вдалося виконати дію.");
      return;
    }
    setMessage("Дію успішно виконано.");
    await refreshBindings();
  };

  const refreshBindings = async () => {
    await query.refetch();
    await Promise.all(
      ["v_source_entity_bindings", "v_ad_account_bindings", "v_project_data_bindings", "v_mapping_review_queue", "v_binding_health", "v_mapping_review_health", "v_mapping_review_actions_recent"].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey: [queryKey, WORKSPACE_ID] }),
      ),
    );
  };

  const handleRefresh = async () => {
    await refreshBindings();
    setLastRefreshedAt(new Date());
  };

  const filteredMappingReviewQueue = useMemo(() => filterRows(query.data?.mappingReviewQueue ?? []), [query.data?.mappingReviewQueue]);
  const firstQueue = filteredMappingReviewQueue[0];
  const overviewCards = [
    { title: "Джерела даних", value: query.data?.sourceBindings.length ?? 0 },
    { title: "Рекламні акаунти", value: query.data?.adAccountBindings.length ?? 0 },
    { title: "Звʼязки з проєктами", value: query.data?.projectDataBindings.length ?? 0 },
    { title: "Мапінг на перевірку", value: query.data?.mappingReviewQueue.length ?? 0 },
  ];
  const healthCards = buildHealthCards(query.data);
  const isRefreshing = query.isFetching;
  const refreshLabel = isRefreshing ? "Оновлюємо…" : "Оновити";
  const headerActions = session && !query.isLoading && !query.error ? (
    <>
      {lastRefreshedAt ? <p className="text-xs text-muted-foreground">Оновлено: {formatDateTime(lastRefreshedAt.toISOString())}</p> : null}
      <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs" onClick={handleRefresh} disabled={isRefreshing}>
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        {refreshLabel}
      </Button>
    </>
  ) : null;

  return (
    <DashboardLayout title="Звʼязки даних" subtitle="Керування звʼязками даних" actions={headerActions} contentClassName="pt-1 lg:pt-2">
      <div className="space-y-4">
        {!session ? (
          <SectionCard title="Звʼязки даних" description="Потрібен вхід">
            <p className="text-sm text-muted-foreground">Увійдіть, щоб переглянути звʼязки даних і чергу перевірки мапінгу.</p>
          </SectionCard>
        ) : query.isLoading ? (
          <SectionCard title="Звʼязки даних" description="Завантаження">
            <p className="text-sm text-muted-foreground">Завантажуємо звʼязки робочого простору…</p>
          </SectionCard>
        ) : query.error ? (
          <SectionCard title="Звʼязки даних" description="Стан розділу">
            <FriendlyError message="Потрібне оновлення backend для цього розділу." technical={query.error.message} />
          </SectionCard>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto min-w-full justify-start gap-2 rounded-xl border border-border/60 bg-card/70 p-1.5 shadow-sm">
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="overview">Огляд</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="source">Джерела даних</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="ad-account">Рекламні акаунти</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="project-data">Звʼязки з проєктами</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="mapping-review">Мапінг на перевірку</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="health">Стан підключень</TabsTrigger>
              </TabsList>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{message}</p>
              {roleLoading ? <p className="text-xs text-muted-foreground">Перевіряємо доступ…</p> : null}
              {!roleLoading && !canManage ? <p className="text-xs text-muted-foreground">У вас немає доступу до керування цим розділом.</p> : null}
              {!roleLoading && roleError ? <p className="text-xs text-muted-foreground">Доступ тимчасово не підтягнувся. Дії вимкнені.</p> : null}
            </div>

            <TabsContent value="overview" className="mt-1">
              <SectionCard title="Огляд звʼязків" description="Короткий стан підключень">
                <KpiGrid cards={overviewCards} />
                <div className="mt-4 space-y-1 rounded-md border border-border/70 bg-muted/25 p-3 text-sm text-muted-foreground">
                  {(query.data?.mappingReviewQueue.length ?? 0) === 0 ? <p>Немає звʼязків на перевірці.</p> : null}
                  {isHealthy(query.data?.bindingHealth ?? []) ? <p>Основні звʼязки виглядають коректно.</p> : null}
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="source" className="mt-1">
              <SectionCard title="Джерела даних" description="Підключені джерела даних">
                <AdminBindingForm type="source" canManage={canManage} session={Boolean(session)} pending={pending} form={sourceForm} setForm={setSourceForm} onSubmit={() => runAction("create-source", () => supabase.functions.invoke("binding-create-or-update", { body: { workspace_id: WORKSPACE_ID, binding_type: "source", ...sourceForm } }))} />
                <KnownColumnsTable rows={filterRows(query.data?.sourceBindings ?? [])} columns={["source_name", "source_kind", "platform", "client_name", "project_name", "funnel_name", "mapping_status", "binding_status", "confidence", "binding_method", "created_at", "updated_at"]} emptyText="Джерела даних ще не привʼязані." />
              </SectionCard>
            </TabsContent>

            <TabsContent value="ad-account" className="mt-1">
              <SectionCard title="Рекламні акаунти" description="Підключені рекламні акаунти">
                <AdminBindingForm type="ad_account" canManage={canManage} session={Boolean(session)} pending={pending} form={adForm} setForm={setAdForm} onSubmit={() => runAction("create-ad", () => supabase.functions.invoke("binding-create-or-update", { body: { workspace_id: WORKSPACE_ID, binding_type: "ad_account", ...adForm } }))} />
                <KnownColumnsTable rows={filterRows(query.data?.adAccountBindings ?? [])} columns={["ad_account_name", "external_account_id", "platform", "client_name", "project_name", "funnel_name", "mapping_status", "binding_status", "confidence", "binding_method", "created_at", "updated_at"]} emptyText="Рекламні акаунти ще не привʼязані." />
              </SectionCard>
            </TabsContent>

            <TabsContent value="project-data" className="mt-1">
              <SectionCard title="Звʼязки з проєктами" description="Звʼязки даних із проєктами">
                <KnownColumnsTable rows={filterRows(query.data?.projectDataBindings ?? [])} columns={["client_name", "project_name", "funnel_name", "source_name", "ad_account_name", "platform", "source_kind", "binding_type", "mapping_status", "health_status", "binding_status"]} emptyText="Звʼязків із проєктами поки немає." />
              </SectionCard>
            </TabsContent>

            <TabsContent value="mapping-review" className="mt-1">
              <SectionCard title="Мапінг на перевірку" description="Звʼязки, які потрібно перевірити">
                {filteredMappingReviewQueue.length === 0 ? (
                  <EmptyMappingReviewState />
                ) : (
                  <>
                    <KnownColumnsTable rows={filteredMappingReviewQueue} columns={["source_name", "ad_account_name", "proposed_client_name", "proposed_project_name", "proposed_funnel_name", "confidence", "mapping_status", "binding_method", "reason", "details", "created_at"]} emptyText="Немає звʼязків на перевірці." />
                    <div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" disabled={!session || !canManage || !firstQueue || pending === "send-telegram"} onClick={() => runAction("send-telegram", () => supabase.functions.invoke("mapping-review-send-telegram", { body: { workspace_id: WORKSPACE_ID, binding_type: getBindingType(firstQueue), binding_id: getBindingId(firstQueue) } }))}>{pending === "send-telegram" ? "Виконуємо…" : "Надіслати в Telegram"}</Button>
                        <Button type="button" variant="outline" disabled={!session || !canManage || !firstQueue || pending === "approve"} onClick={() => runAction("approve", () => supabase.functions.invoke("mapping-review-approve", { body: { workspace_id: WORKSPACE_ID, binding_type: getBindingType(firstQueue), binding_id: getBindingId(firstQueue) } }))}>{pending === "approve" ? "Виконуємо…" : "Підтвердити"}</Button>
                        <Button type="button" variant="destructive" disabled={!session || !canManage || !firstQueue || pending === "reject"} onClick={() => runAction("reject", () => supabase.functions.invoke("mapping-review-reject", { body: { workspace_id: WORKSPACE_ID, binding_type: getBindingType(firstQueue), binding_id: getBindingId(firstQueue) } }))}>{pending === "reject" ? "Виконуємо…" : "Відхилити"}</Button>
                      </div>
                    </div>
                  </>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="health" className="mt-1">
              <SectionCard title="Стан підключень" description="Стан звʼязків без технічних ID у головному вигляді">
                <KpiGrid cards={healthCards} />
                <DeveloperDetails title="Технічні деталі">
                  <p>workspace_id: {WORKSPACE_ID}</p>
                  <p>Поля v_binding_health: {formatFieldList(query.data?.bindingHealth ?? [])}</p>
                  <GenericTable rows={query.data?.bindingHealth ?? []} emptyText="Технічні дані про стан звʼязків відсутні." />
                </DeveloperDetails>
              </SectionCard>
              <OptionalViewCard title="Стан перевірки мапінгу" viewName="v_mapping_review_health" data={query.data?.mappingReviewHealth} />
              <OptionalViewCard title="Останні дії з мапінгом" viewName="v_mapping_review_actions_recent" data={query.data?.mappingReviewActionsRecent} />
              <OptionalViewCard title="Стан Telegram-підтверджень" viewName="v_telegram_hitl_production_health" data={query.data?.telegramHitlHealth} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

const getBindingId = (row: Row) => String(row.binding_id ?? row.id ?? "");
const getBindingType = (row: Row): BindingType => String(row.binding_type ?? "source") === "ad_account" ? "ad_account" : "source";

async function readOptionalView(viewName: string): Promise<OptionalViewData> {
  const result = await supabase.from(viewName).select("*");
  if (result.error) return { rows: [], unavailableReason: result.error.message };
  return { rows: (result.data ?? []) as Row[], unavailableReason: null };
}

function AdminBindingForm({ type, canManage, session, pending, form, setForm, onSubmit }: { type: BindingType; canManage: boolean; session: boolean; pending: string; form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSubmit: () => void }) {
  const idField = type === "source" ? "source_id" : "ad_account_id";
  const pendingKey = type === "source" ? "create-source" : "create-ad";
  const submitLabel = type === "source" ? "Зберегти звʼязок джерела" : "Зберегти звʼязок рекламного акаунта";
  return (
    <details className="mb-3 rounded-md border border-border/70 bg-muted/20 p-3">
      <summary className="cursor-pointer font-medium">Розширене налаштування</summary>
      <p className="mt-2 text-xs text-muted-foreground">Для адміністратора. Використовуйте тільки якщо маєте точні ID.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[idField, "client_id", "project_id", "funnel_id"].map((field) => (
          <input key={field} className="rounded border border-border/70 bg-background px-2 py-1 text-sm" placeholder={field} value={form[field] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} />
        ))}
        <Button disabled={!session || !canManage || !form[idField] || pending === pendingKey} onClick={onSubmit}>{pending === pendingKey ? "Зберігаємо…" : submitLabel}</Button>
      </div>
    </details>
  );
}

function OptionalViewCard({ title, viewName, data }: { title: string; viewName: string; data: OptionalViewData | undefined }) {
  return (
    <SectionCard title={title} description="Деталі">
      {data?.unavailableReason ? <p className="text-sm text-muted-foreground">Цей розділ поки недоступний.</p> : <GenericTable rows={data?.rows ?? []} emptyText="Записів поки немає." />}
      <DeveloperDetails title="Технічні деталі">
        <p>{viewName}</p>
        {data?.unavailableReason ? <p>{data.unavailableReason}</p> : null}
      </DeveloperDetails>
    </SectionCard>
  );
}

function KnownColumnsTable({ rows, columns, emptyText }: { rows: Row[]; columns: string[]; emptyText: string }) {
  const availableColumns = columns.filter((column) => rows.some((row) => row[column] !== undefined));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  if (availableColumns.length === 0) return <GenericTable rows={rows} emptyText={emptyText} />;
  return <GenericDataTable rows={rows} columns={availableColumns} />;
}

function GenericTable({ rows, emptyText }: { rows: Row[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {}).filter((column) => column !== "workspace_id");
  if (columns.length === 0) return <p className="text-sm text-muted-foreground">Дані є, але немає полів для відображення.</p>;
  return <GenericDataTable rows={rows} columns={columns} />;
}

function GenericDataTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {columns.map((column) => (
              <th key={column} className={`px-3 py-2 font-medium ${isCompactColumn(column) ? "text-center" : ""}`}>{friendlyLabel(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${row.id ?? "row"}`} className="border-b border-border/40 last:border-0">
              {columns.map((column) => (
                <td key={`${index}-${column}`} className={`px-3 py-2 align-middle text-foreground ${isCompactColumn(column) ? "text-center" : ""} ${column.endsWith("_at") ? "whitespace-nowrap" : ""}`}>
                  <FormattedValue value={row[column]} column={column} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KpiGrid({ cards }: { cards: { title: string; value: string | number; description?: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="rounded-md border border-border/70 bg-card/60 p-4">
          <p className="text-sm text-muted-foreground">{card.title}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
          {card.description ? <p className="mt-1 text-xs text-muted-foreground">{card.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

function EmptyMappingReviewState() {
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/25 p-6 text-center">
      <p className="text-sm font-medium text-foreground">Немає звʼязків на перевірці.</p>
      <p className="mt-1 text-sm text-muted-foreground">Коли система знайде невідомий або непідтверджений звʼязок, він зʼявиться тут.</p>
    </div>
  );
}

function FormattedValue({ value, column }: { value: string | number | boolean | null | undefined; column: string }) {
  const formatted = formatValue(value, column);
  if (formatted === "—") return <span className="text-muted-foreground">—</span>;
  if (STATUS_COLUMNS.has(column)) return <Badge variant={badgeVariant(String(value), column)}>{formatted}</Badge>;
  return <span>{formatted}</span>;
}

function buildHealthCards(data: BindingsData | undefined) {
  const healthRows = data?.bindingHealth ?? [];
  const mappingRows = data?.mappingReviewHealth.rows ?? [];
  const telegramRows = data?.telegramHitlHealth.rows ?? [];
  const cards = [
    { title: "Активні звʼязки джерел", value: metricFromRows(healthRows, ["active_source_bindings", "source_bindings", "sources_active"]) ?? data?.sourceBindings.length ?? 0 },
    { title: "Активні звʼязки рекламних акаунтів", value: metricFromRows(healthRows, ["active_ad_account_bindings", "ad_account_bindings", "ad_accounts_active"]) ?? data?.adAccountBindings.length ?? 0 },
    { title: "На перевірці", value: metricFromRows(healthRows, ["mapping_review_items", "pending_mapping_reviews", "pending_reviews"]) ?? data?.mappingReviewQueue.length ?? 0 },
    { title: "Стан звʼязків", value: formatStatus(textFromRows(healthRows, ["binding_health_status", "health_status", "status"]) || "healthy"), description: "Основний стан активних звʼязків." },
  ];

  if (mappingRows.length > 0) {
    cards.push({ title: "Мапінг", value: metricFromRows(mappingRows, ["pending_mapping_reviews", "mapping_review_items", "pending_reviews"]) ?? mappingRows.length, description: "Очікують перевірки." });
  }
  if (telegramRows.length > 0) {
    cards.push({ title: "Telegram HITL", value: metricFromRows(telegramRows, ["pending_telegram_mapping_actions", "pending_telegram", "pending_actions"]) ?? telegramRows.length, description: "Очікують Telegram." });
  }
  return cards;
}

function metricFromRows(rows: Row[], keys: string[]) {
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
    }
  }
  return null;
}

function textFromRows(rows: Row[], keys: string[]) {
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "";
}

function isHealthy(rows: Row[]) {
  const status = textFromRows(rows, ["binding_health_status", "health_status", "status"]);
  return !status || status.toLowerCase() === "healthy";
}

function friendlyLabel(value: string) {
  return FRIENDLY_COLUMN_LABELS[value.toLowerCase()] ?? value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatValue(value: string | number | boolean | null | undefined, column: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (column.endsWith("_at") || column.includes("date")) return formatDateTime(value);
  if (STATUS_COLUMNS.has(column)) return formatStatus(String(value));
  if (column === "confidence") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isNaN(numeric)) return numeric <= 1 ? `${Math.round(numeric * 100)}%` : `${Math.round(numeric)}%`;
  }
  return String(value);
}

function formatStatus(value: string) {
  return FRIENDLY_VALUE_LABELS[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

function formatDateTime(value: string | number | boolean) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" }).format(date).replace(",", ",");
}

function badgeVariant(value: string, column: string) {
  const normalized = value.toLowerCase();
  if (normalized === "healthy" || normalized === "active" || normalized === "confirmed") return "secondary";
  if (normalized === "rejected" || normalized === "error" || normalized === "failed") return "destructive";
  if (column === "platform") return "outline";
  return "outline";
}

function isCompactColumn(column: string) {
  return STATUS_COLUMNS.has(column) || column === "confidence";
}

function formatFieldList(rows: Row[]) {
  const fields = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return fields.length ? fields.join(", ") : "—";
}
