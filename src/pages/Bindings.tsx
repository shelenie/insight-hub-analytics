import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DeveloperDetails,
  FriendlyError,
} from "@/components/common/DeveloperDetails";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { toast } from "@/hooks/use-toast";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const ADS_SUBNAV_TRIGGER_CLASS =
  "h-10 whitespace-nowrap rounded-lg border border-transparent px-4 text-sm font-semibold transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm";
const EMPTY_AD_FORM = {
  ad_account_id: "",
  client_id: "",
  project_id: "",
  funnel_id: "",
};

type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };
type BindingsData = {
  sourceBindings: Row[];
  adAccountBindings: Row[];
  projectDataBindings: Row[];
  clients: Row[];
  projects: Row[];
  funnels: Row[];
  adAccounts: Row[];
  mappingReviewQueue: Row[];
  bindingHealth: Row[];
  mappingReviewHealth: OptionalViewData;
  mappingReviewActionsRecent: OptionalViewData;
  telegramHitlHealth: OptionalViewData;
};
type BindingType = "source" | "ad_account";
type BindingActionFeedback = {
  message: string;
  technical: BindingActionTechnicalDetails | null;
  variant: "success" | "error";
};
type BindingActionTechnicalDetails = {
  rpc?: string;
  action?: string;
  binding_id?: string;
  result?: unknown;
};
type AdAccountBindingStatusFilter = "active" | "archived" | "all";
type BindingsTab =
  | "overview"
  | "source"
  | "ad-account"
  | "project-data"
  | "mapping-review"
  | "health";

const FRIENDLY_COLUMN_LABELS: Record<string, string> = {
  ad_account_name: "Рекламний акаунт",
  binding_method: "Метод",
  binding_status: "Статус",
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
  mapping_status: "Мапінг",
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
  archived: "Архівний",
  paused: "Призупинений",
  ad_account: "Рекламний акаунт",
  confirmed: "Підтверджено",
  healthy: "Все гаразд",
  manual: "Вручну",
  pending: "Очікує",
  rejected: "Відхилено",
  resolved_not_applied: "Не застосовано",
  source: "Джерело даних",
};

const FRIENDLY_PLATFORM_LABELS: Record<string, string> = {
  facebook_lead_ads: "Facebook Lead Ads",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
};

const STATUS_COLUMNS = new Set([
  "binding_method",
  "binding_status",
  "binding_type",
  "health_status",
  "mapping_status",
  "status",
]);
const PLACEHOLDER_PATTERNS = [
  "test agency",
  "test client",
  "northstar digital clinic",
  "evergreen growth program",
  "main webinar funnel",
  "placeholder",
  "demo",
  "mock",
  "test_upload",
  "backend_test",
];

function isPlaceholderRow(row: Row) {
  const text = Object.values(row).join(" ").toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => text.includes(pattern));
}

function filterRows(rows: Row[]) {
  return rows.filter((row) => !isPlaceholderRow(row));
}

function getBindingStatus(row: Row) {
  return String(row.binding_status ?? row.status ?? "")
    .trim()
    .toLowerCase();
}

function isActiveBinding(row: Row) {
  return getBindingStatus(row) === "active";
}

function isArchivedOrPausedBinding(row: Row) {
  return ["archived", "paused"].includes(getBindingStatus(row));
}

function matchesAdAccountBindingStatusFilter(
  row: Row,
  filter: AdAccountBindingStatusFilter,
) {
  if (filter === "active") return isActiveBinding(row);
  if (filter === "archived") return isArchivedOrPausedBinding(row);
  return true;
}

function hasMatchingActiveAdBinding(rows: Row[], form: Record<string, string>) {
  return rows.some(
    (row) =>
      isActiveBinding(row) &&
      asText(row.ad_account_id) === form.ad_account_id &&
      asText(row.client_id) === form.client_id &&
      asText(row.project_id) === form.project_id &&
      asText(row.funnel_id) === form.funnel_id,
  );
}

export default function Bindings() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const {
    capabilities,
    isLoading: roleLoading,
    error: roleError,
  } = useWorkspaceRole(WORKSPACE_ID);
  const canManage =
    !roleLoading &&
    (capabilities.can_manage_bindings ||
      capabilities.can_manage_mapping_review);
  const [message, setMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<BindingsTab>("overview");
  const [formFeedback, setFormFeedback] = useState<
    Record<BindingType, BindingActionFeedback | null>
  >({ source: null, ad_account: null });
  const [normalAdFeedback, setNormalAdFeedback] =
    useState<BindingActionFeedback | null>(null);
  const [technicalAdFeedback, setTechnicalAdFeedback] =
    useState<BindingActionFeedback | null>(null);
  const [pending, setPending] = useState<string>("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [sourceForm, setSourceForm] = useState({
    source_id: "",
    client_id: "",
    project_id: "",
    funnel_id: "",
  });
  const [normalAdForm, setNormalAdForm] = useState(EMPTY_AD_FORM);
  const [technicalAdForm, setTechnicalAdForm] = useState(EMPTY_AD_FORM);
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [adFormMode, setAdFormMode] = useState<"create" | "edit">("create");
  const [adFormError, setAdFormError] = useState("");
  const [adAccountStatusFilter, setAdAccountStatusFilter] =
    useState<AdAccountBindingStatusFilter>("active");

  const query = useQuery<BindingsData>({
    queryKey: ["bindings-mapping-workspace", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [
        sourceRes,
        adRes,
        projectRes,
        clientsRes,
        projectsRes,
        funnelsRes,
        adAccountsRes,
        queueRes,
        healthRes,
      ] = await Promise.all([
        supabase.from("v_source_entity_bindings").select("*"),
        supabase.from("v_ad_account_bindings").select("*"),
        supabase.from("v_project_data_bindings").select("*"),
        supabase.from("v_clients").select("*").eq("workspace_id", WORKSPACE_ID),
        supabase
          .from("v_projects")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID),
        supabase.from("v_funnels").select("*").eq("workspace_id", WORKSPACE_ID),
        supabase
          .from("ad_accounts")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID),
        supabase.from("v_mapping_review_queue").select("*"),
        supabase.from("v_binding_health").select("*"),
      ]);
      if (sourceRes.error) throw sourceRes.error;
      if (adRes.error) throw adRes.error;
      if (projectRes.error) throw projectRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (funnelsRes.error) throw funnelsRes.error;
      if (adAccountsRes.error) throw adAccountsRes.error;
      if (queueRes.error) throw queueRes.error;
      if (healthRes.error) throw healthRes.error;

      const [
        mappingReviewHealth,
        mappingReviewActionsRecent,
        telegramHitlHealth,
      ] = await Promise.all([
        readOptionalView("v_mapping_review_health"),
        readOptionalView("v_mapping_review_actions_recent"),
        readOptionalView("v_telegram_hitl_production_health"),
      ]);

      return {
        sourceBindings: (sourceRes.data ?? []) as Row[],
        adAccountBindings: (adRes.data ?? []) as Row[],
        projectDataBindings: (projectRes.data ?? []) as Row[],
        clients: (clientsRes.data ?? []) as Row[],
        projects: (projectsRes.data ?? []) as Row[],
        funnels: (funnelsRes.data ?? []) as Row[],
        adAccounts: (adAccountsRes.data ?? []) as Row[],
        mappingReviewQueue: (queueRes.data ?? []) as Row[],
        bindingHealth: (healthRes.data ?? []) as Row[],
        mappingReviewHealth,
        mappingReviewActionsRecent,
        telegramHitlHealth,
      };
    },
  });

  const clearFormFeedback = (bindingType?: BindingType) => {
    if (bindingType) {
      setFormFeedback((current) => ({ ...current, [bindingType]: null }));
      return;
    }
    setFormFeedback({ source: null, ad_account: null });
    setNormalAdFeedback(null);
    setTechnicalAdFeedback(null);
  };

  const updateSourceForm: React.Dispatch<
    React.SetStateAction<typeof sourceForm>
  > = (update) => {
    clearFormFeedback("source");
    setSourceForm(update);
  };

  const updateNormalAdForm: React.Dispatch<
    React.SetStateAction<typeof normalAdForm>
  > = (update) => {
    setNormalAdFeedback(null);
    setAdFormError("");
    setNormalAdForm(update);
  };

  const updateTechnicalAdForm: React.Dispatch<
    React.SetStateAction<typeof technicalAdForm>
  > = (update) => {
    setTechnicalAdFeedback(null);
    setTechnicalAdForm(update);
  };

  const runAction = async (
    key: string,
    fn: () => Promise<{ data: unknown; error: InvokeError | null }>,
    options?: {
      bindingType?: BindingType;
      successMessage?: string;
      includeTechnicalDetails?: boolean;
      feedbackHandler?: (feedback: BindingActionFeedback) => void;
      successFeedback?: boolean;
    },
  ) => {
    setPending(key);
    setMessage("");
    if (options?.bindingType) clearFormFeedback(options.bindingType);
    const { data, error } = await fn();
    setPending("");
    if (error) {
      const friendlyError = await getFriendlyBindingActionError(error);
      if (options?.feedbackHandler) {
        options.feedbackHandler({
          message: friendlyError,
          technical: null,
          variant: "error",
        });
      } else if (options?.bindingType) {
        setFormFeedback((current) => ({
          ...current,
          [options.bindingType!]: {
            message: friendlyError,
            technical: null,
            variant: "error",
          },
        }));
      } else {
        setMessage(friendlyError);
      }
      return false;
    }

    const response = data as BindingActionResponse | null;
    if (response?.ok === false) {
      const friendlyError = getFriendlyBindingActionMessage(response);
      if (options?.feedbackHandler) {
        options.feedbackHandler({
          message: friendlyError,
          technical:
            options.includeTechnicalDetails === false
              ? null
              : getBindingActionTechnicalDetails(response),
          variant: "error",
        });
      } else if (options?.bindingType) {
        setFormFeedback((current) => ({
          ...current,
          [options.bindingType!]: {
            message: friendlyError,
            technical: getBindingActionTechnicalDetails(response),
            variant: "error",
          },
        }));
      } else {
        setMessage(friendlyError);
      }
      return false;
    }

    if (options?.feedbackHandler) {
      if (options.successFeedback !== false) {
        options.feedbackHandler({
          message: options.successMessage ?? "Дію успішно виконано.",
          technical:
            options.includeTechnicalDetails === false
              ? null
              : getBindingActionTechnicalDetails(response),
          variant: "success",
        });
      }
    } else if (options?.bindingType) {
      setFormFeedback((current) => ({
        ...current,
        [options.bindingType!]: {
          message: options.successMessage ?? "Дію успішно виконано.",
          technical:
            options.includeTechnicalDetails === false
              ? null
              : getBindingActionTechnicalDetails(response),
          variant: "success",
        },
      }));
    } else {
      setMessage("Дію успішно виконано.");
    }
    await refreshBindings();
    return true;
  };

  const refreshBindings = async () => {
    await query.refetch();
    await Promise.all([
      ...[
        "v_source_entity_bindings",
        "v_ad_account_bindings",
        "v_project_data_bindings",
        "v_mapping_review_queue",
        "v_binding_health",
        "v_mapping_review_health",
        "v_mapping_review_actions_recent",
      ].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey: [queryKey, WORKSPACE_ID] }),
      ),
      queryClient.invalidateQueries({
        queryKey: ["ads-connectors-workspace", WORKSPACE_ID],
      }),
    ]);
  };

  const handleRefresh = async () => {
    clearFormFeedback();
    await refreshBindings();
    setLastRefreshedAt(new Date());
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as BindingsTab);
    clearFormFeedback();
  };

  const filteredSourceBindings = useMemo(
    () => filterRows(query.data?.sourceBindings ?? []),
    [query.data?.sourceBindings],
  );
  const filteredAdAccountBindings = useMemo(() => {
    const rows = filterRows(query.data?.adAccountBindings ?? []);
    return rows.filter((row) =>
      matchesAdAccountBindingStatusFilter(row, adAccountStatusFilter),
    );
  }, [adAccountStatusFilter, query.data?.adAccountBindings]);
  const filteredProjectDataBindings = useMemo(
    () => filterRows(query.data?.projectDataBindings ?? []),
    [query.data?.projectDataBindings],
  );
  const adBindingOptions = useMemo(
    () => buildAdAccountBindingOptions(query.data),
    [query.data],
  );
  const adFormOptions = useMemo(
    () => buildAdFormOptions(query.data, normalAdForm),
    [normalAdForm, query.data],
  );
  const filteredMappingReviewQueue = useMemo(
    () => filterRows(query.data?.mappingReviewQueue ?? []),
    [query.data?.mappingReviewQueue],
  );
  const firstQueue = filteredMappingReviewQueue[0];
  const visibleBindingCounts = {
    sourceBindings: filteredSourceBindings.length,
    adAccountBindings: filteredAdAccountBindings.length,
    projectDataBindings: filteredProjectDataBindings.length,
    mappingReviewQueue: filteredMappingReviewQueue.length,
  };
  const overviewCards = [
    {
      title: "Джерела файлів / таблиць",
      value: visibleBindingCounts.sourceBindings,
      description: "Google Sheets, імпорти або інші нерекламні джерела.",
    },
    {
      title: "Привʼязані рекламні акаунти",
      value: visibleBindingCounts.adAccountBindings,
    },
    {
      title: "Активні звʼязки з проєктами",
      value: visibleBindingCounts.projectDataBindings,
    },
    { title: "На перевірці", value: visibleBindingCounts.mappingReviewQueue },
  ];
  const connectionStatusCards = buildConnectionStatusCards(
    query.data,
    visibleBindingCounts,
  );
  const isRefreshing = query.isFetching;
  const refreshLabel = isRefreshing ? "Оновлюємо…" : "Оновити";
  const headerActions =
    session && !query.isLoading && !query.error ? (
      <>
        {lastRefreshedAt ? (
          <p className="text-xs text-muted-foreground">
            Оновлено: {formatDateTime(lastRefreshedAt.toISOString())}
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {refreshLabel}
        </Button>
      </>
    ) : null;

  return (
    <DashboardLayout
      title="Звʼязки даних"
      subtitle="Керування звʼязками даних"
      actions={headerActions}
      contentClassName="pt-1 lg:pt-2"
    >
      <div className="space-y-4">
        {!session ? (
          <SectionCard title="Звʼязки даних" description="Потрібен вхід">
            <p className="text-sm text-muted-foreground">
              Увійдіть, щоб переглянути звʼязки даних і чергу перевірки мапінгу.
            </p>
          </SectionCard>
        ) : query.isLoading ? (
          <SectionCard title="Звʼязки даних" description="Завантаження">
            <p className="text-sm text-muted-foreground">
              Завантажуємо звʼязки робочого простору…
            </p>
          </SectionCard>
        ) : query.error ? (
          <SectionCard title="Звʼязки даних" description="Стан розділу">
            <FriendlyError
              message="Потрібне оновлення backend для цього розділу."
              technical={query.error.message}
            />
          </SectionCard>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-4"
          >
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto min-w-full justify-start gap-2 rounded-xl border border-border/60 bg-card/70 p-1.5 shadow-sm">
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="overview"
                >
                  Огляд
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="source"
                >
                  Джерела даних
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="ad-account"
                >
                  Рекламні акаунти
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="project-data"
                >
                  Звʼязки з проєктами
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="mapping-review"
                >
                  Мапінг на перевірку
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="health"
                >
                  Стан підключень
                </TabsTrigger>
              </TabsList>
            </div>

            {message || (!roleLoading && (!canManage || roleError)) ? (
              <div className="space-y-1">
                {message ? (
                  <p className="text-xs text-muted-foreground">{message}</p>
                ) : null}
                {!roleLoading && !canManage ? (
                  <p className="text-xs text-muted-foreground">
                    У вас немає доступу до керування цим розділом.
                  </p>
                ) : null}
                {!roleLoading && roleError ? (
                  <p className="text-xs text-muted-foreground">
                    Доступ тимчасово не підтягнувся. Дії вимкнені.
                  </p>
                ) : null}
              </div>
            ) : null}

            <TabsContent value="overview" className="mt-1">
              <SectionCard
                title="Огляд звʼязків"
                description="Короткий стан підключень"
              >
                <KpiGrid cards={overviewCards} />
                <div className="mt-4 space-y-1 rounded-md border border-border/70 bg-muted/25 p-3 text-sm text-muted-foreground">
                  <p>
                    Рекламні акаунти рахуються окремо від джерел файлів і
                    таблиць.
                  </p>
                  {filteredMappingReviewQueue.length === 0 ? (
                    <p>Немає звʼязків на перевірці.</p>
                  ) : null}
                  {isHealthy(query.data?.bindingHealth ?? []) ? (
                    <p>Основні звʼязки виглядають коректно.</p>
                  ) : null}
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="source" className="mt-1">
              <SectionCard
                title="Джерела даних"
                description="Підключені джерела даних"
              >
                <KnownColumnsTable
                  rows={filteredSourceBindings}
                  columns={[
                    "source_name",
                    "source_kind",
                    "platform",
                    "client_name",
                    "project_name",
                    "funnel_name",
                    "mapping_status",
                    "binding_status",
                    "confidence",
                    "binding_method",
                    "created_at",
                    "updated_at",
                  ]}
                  emptyText="Джерела даних ще не привʼязані."
                />
                <AdminBindingForm
                  type="source"
                  canManage={canManage}
                  session={Boolean(session)}
                  pending={pending}
                  form={sourceForm}
                  setForm={updateSourceForm}
                  feedback={formFeedback.source}
                  onSubmit={() =>
                    runAction(
                      "create-source",
                      () =>
                        supabase.functions.invoke("binding-create-or-update", {
                          body: {
                            workspace_id: WORKSPACE_ID,
                            binding_type: "source",
                            ...sourceForm,
                          },
                        }),
                      {
                        bindingType: "source",
                        successMessage: "Звʼязок джерела збережено.",
                      },
                    )
                  }
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="ad-account" className="mt-1">
              <SectionCard
                title="Рекламні акаунти"
                description="Керуйте привʼязкою рекламних акаунтів до клієнтів, проєктів і воронок."
              >
                <div className="mb-3 grid gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <p className="text-sm leading-5 text-muted-foreground">
                    Оберіть акаунт, клієнта, проєкт і воронку — ID передаються автоматично.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <label
                        className="text-xs font-medium text-muted-foreground sm:whitespace-nowrap"
                        htmlFor="ad-account-status-filter"
                      >
                        Статус:
                      </label>
                      <Select
                        value={adAccountStatusFilter}
                        onValueChange={(value) =>
                          setAdAccountStatusFilter(
                            value as AdAccountBindingStatusFilter,
                          )
                        }
                      >
                        <SelectTrigger
                          id="ad-account-status-filter"
                          className="h-9 w-full bg-background sm:w-[14.5rem] sm:shrink-0"
                        >
                          <SelectValue placeholder="Статус" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Активні</SelectItem>
                          <SelectItem value="archived">
                            Архівні/призупинені
                          </SelectItem>
                          <SelectItem value="all">Усі</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      className="h-9 sm:shrink-0"
                      disabled={!session || !canManage}
                      onClick={() => {
                        setNormalAdForm(EMPTY_AD_FORM);
                        setAdFormMode("create");
                        setAdFormError("");
                        setNormalAdFeedback(null);
                        setAdFormOpen(true);
                      }}
                    >
                      + Привʼязати рекламний акаунт
                    </Button>
                  </div>
                </div>

                <Sheet
                  open={adFormOpen}
                  onOpenChange={(open) => {
                    setAdFormOpen(open);
                    if (!open) setAdFormError("");
                  }}
                >
                  <SheetContent
                    side="right"
                    className="flex h-full w-full flex-col overflow-y-auto sm:max-w-xl"
                  >
                    <SheetHeader className="pr-8">
                      <SheetTitle>
                        {adFormMode === "edit"
                          ? "Редагувати привʼязку"
                          : "Привʼязати рекламний акаунт"}
                      </SheetTitle>
                      <SheetDescription>
                        Оберіть назви зі списків — технічні ID передаються у
                        backend автоматично.
                      </SheetDescription>
                    </SheetHeader>
                    <AdAccountBindingCard
                      canManage={canManage}
                      session={Boolean(session)}
                      pending={pending}
                      form={normalAdForm}
                      setForm={updateNormalAdForm}
                      options={adFormOptions}
                      error={adFormError}
                      feedback={
                        normalAdFeedback?.variant === "error"
                          ? { ...normalAdFeedback, technical: null }
                          : null
                      }
                      onCancel={() => setAdFormOpen(false)}
                      onSubmit={async () => {
                        const validationError = validateAdForm(normalAdForm);
                        if (validationError)
                          return setAdFormError(validationError);
                        const existingActiveBinding = hasMatchingActiveAdBinding(
                          query.data?.adAccountBindings ?? [],
                          normalAdForm,
                        );
                        const saved = await runAction(
                          "create-ad",
                          () =>
                            supabase.functions.invoke(
                              "binding-create-or-update",
                              {
                                body: {
                                  workspace_id: WORKSPACE_ID,
                                  binding_type: "ad_account",
                                  ...normalAdForm,
                                },
                              },
                            ),
                          {
                            bindingType: "ad_account",
                            successMessage:
                              "Звʼязок рекламного акаунта збережено.",
                            includeTechnicalDetails: false,
                            feedbackHandler: setNormalAdFeedback,
                            successFeedback: false,
                          },
                        );
                        if (saved) {
                          setNormalAdForm(EMPTY_AD_FORM);
                          setAdFormOpen(false);
                          toast({
                            title: existingActiveBinding
                              ? "Звʼязок оновлено"
                              : "Звʼязок створено",
                            description: existingActiveBinding
                              ? "Існуючий active-звʼязок оновлено без створення дубля."
                              : "Рекламний акаунт привʼязано до клієнта, проєкту і воронки.",
                            className:
                              "border-emerald-500/50 bg-emerald-50 text-emerald-950 shadow-xl dark:bg-emerald-950 dark:text-emerald-50",
                            duration: 5000,
                          });
                        }
                      }}
                    />
                  </SheetContent>
                </Sheet>

                <AdAccountsBusinessTable
                  rows={filteredAdAccountBindings}
                  onEdit={(row) => {
                    setAdFormError("");
                    setNormalAdFeedback(null);
                    setAdFormMode("edit");
                    setNormalAdForm({
                      ad_account_id: asText(row.ad_account_id ?? row.id),
                      client_id: asText(row.client_id),
                      project_id: asText(row.project_id),
                      funnel_id: asText(row.funnel_id),
                    });
                    setAdFormOpen(true);
                  }}
                />
                <AdminBindingForm
                  type="ad_account"
                  canManage={canManage}
                  session={Boolean(session)}
                  pending={pending}
                  form={technicalAdForm}
                  setForm={updateTechnicalAdForm}
                  feedback={technicalAdFeedback}
                  onSubmit={() =>
                    runAction(
                      "create-ad",
                      () =>
                        supabase.functions.invoke("binding-create-or-update", {
                          body: {
                            workspace_id: WORKSPACE_ID,
                            binding_type: "ad_account",
                            ...technicalAdForm,
                          },
                        }),
                      {
                        bindingType: "ad_account",
                        feedbackHandler: setTechnicalAdFeedback,
                        successMessage:
                          "Звʼязок рекламного акаунта збережено. Якщо такий active-звʼязок уже існував, його оновлено без створення дубля.",
                      },
                    )
                  }
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="project-data" className="mt-1">
              <SectionCard
                title="Звʼязки з проєктами"
                description="Звʼязки даних із проєктами"
              >
                <KnownColumnsTable
                  rows={filteredProjectDataBindings}
                  columns={[
                    "client_name",
                    "project_name",
                    "funnel_name",
                    "source_name",
                    "ad_account_name",
                    "platform",
                    "source_kind",
                    "binding_type",
                    "mapping_status",
                    "health_status",
                    "binding_status",
                  ]}
                  emptyText="Звʼязків із проєктами поки немає."
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="mapping-review" className="mt-1">
              <SectionCard
                title="Мапінг на перевірку"
                description="Звʼязки, які потрібно перевірити"
              >
                {filteredMappingReviewQueue.length === 0 ? (
                  <EmptyMappingReviewState />
                ) : (
                  <>
                    <KnownColumnsTable
                      rows={filteredMappingReviewQueue}
                      columns={[
                        "source_name",
                        "ad_account_name",
                        "proposed_client_name",
                        "proposed_project_name",
                        "proposed_funnel_name",
                        "confidence",
                        "mapping_status",
                        "binding_method",
                        "reason",
                        "details",
                        "created_at",
                      ]}
                      emptyText="Немає звʼязків на перевірці."
                    />
                    <div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={
                            !session ||
                            !canManage ||
                            !firstQueue ||
                            pending === "send-telegram"
                          }
                          onClick={() =>
                            runAction("send-telegram", () =>
                              supabase.functions.invoke(
                                "mapping-review-send-telegram",
                                {
                                  body: {
                                    workspace_id: WORKSPACE_ID,
                                    binding_type: getBindingType(firstQueue),
                                    binding_id: getBindingId(firstQueue),
                                  },
                                },
                              ),
                            )
                          }
                        >
                          {pending === "send-telegram"
                            ? "Виконуємо…"
                            : "Надіслати в Telegram"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !session ||
                            !canManage ||
                            !firstQueue ||
                            pending === "approve"
                          }
                          onClick={() =>
                            runAction("approve", () =>
                              supabase.functions.invoke(
                                "mapping-review-approve",
                                {
                                  body: {
                                    workspace_id: WORKSPACE_ID,
                                    binding_type: getBindingType(firstQueue),
                                    binding_id: getBindingId(firstQueue),
                                  },
                                },
                              ),
                            )
                          }
                        >
                          {pending === "approve" ? "Виконуємо…" : "Підтвердити"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={
                            !session ||
                            !canManage ||
                            !firstQueue ||
                            pending === "reject"
                          }
                          onClick={() =>
                            runAction("reject", () =>
                              supabase.functions.invoke(
                                "mapping-review-reject",
                                {
                                  body: {
                                    workspace_id: WORKSPACE_ID,
                                    binding_type: getBindingType(firstQueue),
                                    binding_id: getBindingId(firstQueue),
                                  },
                                },
                              ),
                            )
                          }
                        >
                          {pending === "reject" ? "Виконуємо…" : "Відхилити"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="health" className="mt-1">
              <SectionCard
                title="Стан мапінгу та підтверджень"
                description="Виробничий стан мапінгу та Telegram-підтверджень"
              >
                <KpiGrid cards={connectionStatusCards.production} />
                <DeveloperDetails title="Деталі Telegram HITL">
                  <p>
                    Компактна діагностика Telegram-підтверджень без технічних
                    ID.
                  </p>
                  <CompactDiagnosticsGrid
                    cards={connectionStatusCards.telegramHitlDetails}
                  />
                  {connectionStatusCards.unavailableNotes.length ? (
                    <div className="mt-3 space-y-1">
                      {connectionStatusCards.unavailableNotes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  ) : null}
                </DeveloperDetails>
              </SectionCard>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

type BindingActionResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  rpc?: string;
  action?: string;
  binding_id?: string;
  result?: unknown;
};
type InvokeError = {
  message?: string;
  context?: unknown;
};

async function getFriendlyBindingActionError(error: InvokeError) {
  const payload = await readFunctionErrorPayload(error);
  return getFriendlyBindingActionMessage({
    ok: false,
    error: payload?.error ?? error.message,
    code: payload?.code,
  });
}

async function readFunctionErrorPayload(
  error: InvokeError,
): Promise<BindingActionResponse | null> {
  const response = error.context;
  if (!response || typeof response !== "object" || !("json" in response))
    return null;
  const jsonReader = (response as { json?: () => Promise<unknown> }).json;
  if (typeof jsonReader !== "function") return null;
  const payload = await jsonReader.call(response).catch(() => null);
  return payload && typeof payload === "object"
    ? (payload as BindingActionResponse)
    : null;
}

function getFriendlyBindingActionMessage(response: BindingActionResponse) {
  if (
    response.code === "permission_denied" ||
    response.code === "insufficient_role" ||
    response.error?.toLowerCase().includes("insufficient")
  ) {
    return "Недостатньо прав для ручної прив’язки. Перевірте роль користувача або права робочого простору.";
  }

  if (
    response.code === "archived_target" ||
    response.error?.toLowerCase().includes("archiv")
  ) {
    return "Не можна створити зв’язок для архівного клієнта, проєкту або воронки.";
  }

  if (
    response.code === "invalid_payload" ||
    response.code === "target_not_found" ||
    response.code === "target_workspace_mismatch" ||
    response.code === "target_lookup_failed" ||
    response.code === "ad_account_not_found" ||
    response.code === "ad_account_workspace_mismatch" ||
    response.code === "ad_account_lookup_failed" ||
    response.code === "ad_account_platform_missing" ||
    response.code === "source_not_found" ||
    response.code === "source_workspace_mismatch"
  ) {
    return "Перевірте ID рекламного акаунта, клієнта, проєкту і воронки.";
  }

  if (
    response.code === "rpc_failed" ||
    response.code === "rpc_not_wired" ||
    response.code === "access_check_failed"
  ) {
    return "Backend не зміг зберегти звʼязок. Спробуйте ще раз або передайте деталі адміністратору.";
  }

  return response.error || "Не вдалося виконати дію.";
}

function getBindingActionTechnicalDetails(
  response: BindingActionResponse | null,
): BindingActionTechnicalDetails | null {
  if (!response) return null;
  const resultObject =
    response.result &&
    typeof response.result === "object" &&
    !Array.isArray(response.result)
      ? (response.result as Record<string, unknown>)
      : null;
  const resultString =
    typeof response.result === "string" && response.result.trim()
      ? response.result.trim()
      : null;
  const bindingId =
    response.binding_id ??
    (typeof resultObject?.id === "string" ? resultObject.id : null) ??
    (typeof resultObject?.binding_id === "string"
      ? resultObject.binding_id
      : null) ??
    resultString;
  if (
    !response.rpc &&
    !response.action &&
    !bindingId &&
    response.result === undefined
  )
    return null;
  return {
    rpc: response.rpc,
    action: response.action,
    binding_id: bindingId ?? undefined,
    result: response.result,
  };
}

const getBindingId = (row: Row) => String(row.binding_id ?? row.id ?? "");
const getBindingType = (row: Row): BindingType =>
  String(row.binding_type ?? "source") === "ad_account"
    ? "ad_account"
    : "source";

async function readOptionalView(viewName: string): Promise<OptionalViewData> {
  const result = await supabase.from(viewName).select("*");
  if (result.error)
    return { rows: [], unavailableReason: result.error.message };
  return { rows: (result.data ?? []) as Row[], unavailableReason: null };
}

type SelectOption = {
  value: string;
  label: string;
  description?: string;
  clientId?: string;
  projectId?: string;
};

type AdFormOptions = {
  adAccounts: SelectOption[];
  clients: SelectOption[];
  projects: SelectOption[];
  funnels: SelectOption[];
  projectEmptyText: string;
  funnelEmptyText: string;
};

function AdAccountBindingCard({
  canManage,
  session,
  pending,
  form,
  setForm,
  options,
  error,
  feedback,
  onCancel,
  onSubmit,
}: {
  canManage: boolean;
  session: boolean;
  pending: string;
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  options: AdFormOptions;
  error: string;
  feedback: BindingActionFeedback | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const disabled = !session || !canManage || pending === "create-ad";
  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col">
      <div className="grid gap-3">
        <BindingSelect
          label="Рекламний акаунт"
          placeholder="Оберіть рекламний акаунт"
          value={form.ad_account_id}
          options={options.adAccounts}
          emptyText="Рекламних акаунтів поки немає."
          disabled={disabled}
          onChange={(value) =>
            setForm((current) => ({ ...current, ad_account_id: value }))
          }
        />
        <BindingSelect
          label="Клієнт"
          placeholder="Оберіть клієнта"
          value={form.client_id}
          options={options.clients}
          emptyText="Клієнтів поки немає."
          disabled={disabled}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              client_id: value,
              project_id: "",
              funnel_id: "",
            }))
          }
        />
        <BindingSelect
          label="Проєкт"
          placeholder="Оберіть проєкт"
          value={form.project_id}
          options={options.projects}
          emptyText={options.projectEmptyText}
          disabled={
            disabled || !form.client_id || options.projects.length === 0
          }
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              project_id: value,
              funnel_id: "",
            }))
          }
        />
        <BindingSelect
          label="Воронка"
          placeholder="Оберіть воронку"
          value={form.funnel_id}
          options={options.funnels}
          emptyText={options.funnelEmptyText}
          disabled={
            disabled || !form.project_id || options.funnels.length === 0
          }
          onChange={(value) =>
            setForm((current) => ({ ...current, funnel_id: value }))
          }
        />
      </div>
      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button type="button" disabled={disabled} onClick={onSubmit}>
          {pending === "create-ad" ? "Зберігаємо…" : "Зберегти привʼязку"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Скасувати
        </Button>
      </div>
      <BindingFeedback feedback={feedback} />
    </div>
  );
}

function BindingSelect({
  label,
  placeholder,
  value,
  options,
  emptyText,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  emptyText: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const searchPlaceholder = `Пошук: ${label.toLowerCase()}`;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="min-h-10 w-full justify-between bg-background text-left font-normal"
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,520px)] p-0" align="start">
          <Command filter={filterComboboxOptions}>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={comboboxSearchValue(option)}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!options.length ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : null}
    </div>
  );
}

function comboboxSearchValue(option: SelectOption) {
  return [option.label, option.description, option.value]
    .filter(Boolean)
    .join(" ");
}

function filterComboboxOptions(value: string, search: string) {
  if (!search.trim()) return 1;
  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
}

function BindingFeedback({
  feedback,
}: {
  feedback: BindingActionFeedback | null;
}) {
  if (!feedback) return null;
  return (
    <div
      className={`mt-3 rounded-md border p-3 text-sm shadow-sm ${feedback.variant === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
      role="status"
      aria-live="polite"
    >
      <p className="font-medium">{feedback.message}</p>
      {feedback.technical ? (
        <details className="mt-2 rounded border border-border/60 bg-muted/25 p-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">
            Technical details
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(feedback.technical, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function AdAccountsBusinessTable({
  rows,
  onEdit,
}: {
  rows: Row[];
  onEdit: (row: Row) => void;
}) {
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Рекламні акаунти ще не привʼязані для вибраного фільтра.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
      <table className="min-w-full table-auto text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {[
              "Акаунт",
              "Платформа",
              "Клієнт",
              "Проєкт",
              "Воронка",
              "Мапінг",
              "Статус",
              "Оновлено",
              "Дія",
            ].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${getBindingId(row) || asText(row.external_account_id) || index}`}
              className="border-b border-border/40 last:border-0"
            >
              <td className="px-3 py-2">
                <div className="font-medium text-foreground">
                  {accountName(row)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {asText(row.external_account_id) || "—"}
                </div>
              </td>
              <td className="px-3 py-2">
                {formatPlatform(asText(row.platform) || "—")}
              </td>
              <td className="px-3 py-2">{asText(row.client_name) || "—"}</td>
              <td className="px-3 py-2">{asText(row.project_name) || "—"}</td>
              <td className="px-3 py-2">{asText(row.funnel_name) || "—"}</td>
              <td className="px-3 py-2">
                <FormattedValue
                  value={row.mapping_status}
                  column="mapping_status"
                />
              </td>
              <td className="px-3 py-2">
                <FormattedValue
                  value={row.binding_status ?? row.status}
                  column="binding_status"
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <FormattedValue value={row.updated_at} column="updated_at" />
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => onEdit(row)}
                >
                  Перепривʼязати
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminBindingForm({
  type,
  canManage,
  session,
  pending,
  form,
  setForm,
  feedback,
  onSubmit,
}: {
  type: BindingType;
  canManage: boolean;
  session: boolean;
  pending: string;
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  feedback: BindingActionFeedback | null;
  onSubmit: () => void;
}) {
  const idField = type === "source" ? "source_id" : "ad_account_id";
  const pendingKey = type === "source" ? "create-source" : "create-ad";
  const submitLabel =
    type === "source"
      ? "Зберегти звʼязок джерела"
      : "Зберегти звʼязок рекламного акаунта";
  return (
    <details className="mt-6 rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-sm">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
        Advanced / Технічний режим: налаштування через ID
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Для адміністратора. Використовуйте тільки для ручної привʼязки, коли
        точно знаєте ID.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[idField, "client_id", "project_id", "funnel_id"].map((field) => (
          <input
            key={field}
            className="rounded border border-border/70 bg-background px-2 py-1 text-sm"
            placeholder={field}
            value={form[field] ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                [field]: event.target.value,
              }))
            }
          />
        ))}
        <Button
          disabled={
            !session || !canManage || !form[idField] || pending === pendingKey
          }
          onClick={onSubmit}
        >
          {pending === pendingKey ? "Зберігаємо…" : submitLabel}
        </Button>
      </div>
      <BindingFeedback feedback={feedback} />
    </details>
  );
}

function KnownColumnsTable({
  rows,
  columns,
  emptyText,
}: {
  rows: Row[];
  columns: string[];
  emptyText: string;
}) {
  const availableColumns = columns.filter((column) =>
    rows.some((row) => row[column] !== undefined),
  );
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  if (availableColumns.length === 0)
    return <GenericTable rows={rows} emptyText={emptyText} />;
  return <GenericDataTable rows={rows} columns={availableColumns} />;
}

function GenericTable({ rows, emptyText }: { rows: Row[]; emptyText: string }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {}).filter(
    (column) => column !== "workspace_id",
  );
  if (columns.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Дані є, але немає полів для відображення.
      </p>
    );
  return <GenericDataTable rows={rows} columns={columns} />;
}

function GenericDataTable({
  rows,
  columns,
}: {
  rows: Row[];
  columns: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="min-w-full table-auto text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column}
                className={`px-3 py-2 font-medium ${isCompactColumn(column) ? "text-center" : ""}`}
              >
                {friendlyLabel(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${index}-${row.id ?? "row"}`}
              className="border-b border-border/40 last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={`${index}-${column}`}
                  className={`px-3 py-2 align-middle text-foreground ${isCompactColumn(column) ? "text-center" : ""} ${column.endsWith("_at") ? "whitespace-nowrap" : ""}`}
                >
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

function KpiGrid({
  cards,
}: {
  cards: { title: string; value: string | number; description?: string }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-md border border-border/70 bg-card/60 p-4"
        >
          <p className="text-sm text-muted-foreground">{card.title}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {card.value}
          </p>
          {card.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CompactDiagnosticsGrid({
  cards,
}: {
  cards: { title: string; value: string | number; description?: string }[];
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded border border-border/60 bg-background/60 p-2"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              {card.title}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {card.value}
            </p>
          </div>
          {card.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EmptyMappingReviewState() {
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/25 p-6 text-center">
      <p className="text-sm font-medium text-foreground">
        Немає звʼязків на перевірці.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Коли система знайде невідомий або непідтверджений звʼязок, він зʼявиться
        тут.
      </p>
    </div>
  );
}

function FormattedValue({
  value,
  column,
}: {
  value: string | number | boolean | null | undefined;
  column: string;
}) {
  const formatted = formatValue(value, column);
  if (formatted === "—")
    return <span className="text-muted-foreground">—</span>;
  if (STATUS_COLUMNS.has(column))
    return (
      <Badge variant={badgeVariant(String(value), column)}>{formatted}</Badge>
    );
  if (column === "external_account_id")
    return (
      <span
        className="block max-w-[16rem] truncate font-mono text-xs text-muted-foreground"
        title={formatted}
      >
        {formatted}
      </span>
    );
  return <span>{formatted}</span>;
}

function buildAdAccountBindingOptions(data: BindingsData | undefined) {
  return filterRows(data?.adAccountBindings ?? []);
}

function buildAdFormOptions(
  data: BindingsData | undefined,
  form: Record<string, string>,
): AdFormOptions {
  const clients = filterRows(data?.clients ?? [])
    .map((row) => ({
      value: entityId(row, "client_id"),
      label: entityName(row, "client"),
    }))
    .filter((option) => option.value);
  const projectsAll = filterRows(data?.projects ?? [])
    .map((row) => ({
      value: entityId(row, "project_id"),
      label: entityName(row, "project"),
      clientId: asText(row.client_id),
    }))
    .filter((option) => option.value);
  const projects = projectsAll.filter(
    (option) => option.clientId === form.client_id || !form.client_id,
  );
  const funnelsAll = filterRows(data?.funnels ?? [])
    .map((row) => ({
      value: entityId(row, "funnel_id"),
      label: entityName(row, "funnel"),
      projectId: asText(row.project_id),
    }))
    .filter((option) => option.value);
  const funnels = funnelsAll.filter(
    (option) => option.projectId === form.project_id || !form.project_id,
  );
  const bindingRows = buildAdAccountBindingOptions(data);
  const adAccounts = filterRows(data?.adAccounts ?? [])
    .map((row) => {
      const value = entityId(row, "ad_account_id");
      const boundRow = bindingRows.find(
        (binding) =>
          asText(binding.ad_account_id) === value ||
          asText(binding.external_account_id) ===
            asText(row.external_account_id),
      );
      const hint = boundRow
        ? `${formatStatus(getBindingStatus(boundRow))}: ${[boundRow.client_name, boundRow.project_name, boundRow.funnel_name].map(asText).filter(Boolean).join(" → ") || "привʼязка без назви"}`
        : "Ще не привʼязано";
      return {
        value,
        label: `${formatPlatform(asText(row.platform))} · ${accountName(row)} · ${asText(row.external_account_id) || value}`,
        description: hint,
      };
    })
    .filter((option) => option.value);
  return {
    adAccounts,
    clients,
    projects,
    funnels,
    projectEmptyText: form.client_id
      ? "Для цього клієнта ще немає проєктів"
      : "Спочатку оберіть клієнта",
    funnelEmptyText: form.project_id
      ? "Для цього проєкту ще немає воронок"
      : "Спочатку оберіть проєкт",
  };
}

function validateAdForm(form: Record<string, string>) {
  if (!form.ad_account_id) return "Оберіть рекламний акаунт.";
  if (!form.client_id) return "Оберіть клієнта.";
  if (!form.project_id) return "Оберіть проєкт.";
  if (!form.funnel_id) return "Оберіть воронку.";
  return "";
}

function entityId(row: Row, preferredKey: string) {
  return asText(row[preferredKey]) || asText(row.id);
}
function entityName(row: Row, entity: "client" | "project" | "funnel") {
  return asText(row.name) || asText(row[`${entity}_name`]) || `Без назви`;
}
function accountName(row: Row) {
  return (
    asText(row.external_account_name) ||
    asText(row.ad_account_name) ||
    asText(row.name) ||
    "Рекламний акаунт без назви"
  );
}
function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function buildConnectionStatusCards(
  data: BindingsData | undefined,
  visibleCounts: {
    sourceBindings: number;
    adAccountBindings: number;
    mappingReviewQueue: number;
  },
) {
  const healthRows = data?.bindingHealth ?? [];
  const mappingRows = data?.mappingReviewHealth.rows ?? [];
  const telegramRows = data?.telegramHitlHealth.rows ?? [];
  const pendingMappingReviews =
    metricFromRows(mappingRows, [
      "pending_mapping_reviews",
      "mapping_review_items",
      "pending_reviews",
    ]) ??
    metricFromRows(healthRows, [
      "mapping_review_items",
      "pending_mapping_reviews",
      "pending_reviews",
    ]) ??
    visibleCounts.mappingReviewQueue;
  const pendingTelegramActions =
    metricFromRows(mappingRows, [
      "pending_telegram_mapping_actions",
      "pending_telegram",
      "pending_telegram_actions",
      "pending_actions",
    ]) ??
    metricFromRows(telegramRows, [
      "pending_telegram_mapping_actions",
      "pending_telegram",
      "pending_telegram_actions",
      "pending_actions",
    ]) ??
    0;
  const mappingStatus =
    textFromRows(mappingRows, [
      "mapping_review_health_status",
      "health_status",
      "status",
    ]) ||
    textFromRows(healthRows, [
      "mapping_review_health_status",
      "binding_health_status",
      "health_status",
      "status",
    ]) ||
    "healthy";
  const telegramStatus =
    textFromRows(telegramRows, [
      "telegram_hitl_production_status",
      "telegram_hitl_health_status",
      "health_status",
      "status",
    ]) || "healthy";
  const activeApprovers = metricFromRows(telegramRows, [
    "active_approvers",
    "approvers_active",
    "active_telegram_approvers",
  ]);

  return {
    production: [
      {
        title: "Мапінг на перевірці",
        value: pendingMappingReviews,
        description: "Звʼязки, які потребують ручного підтвердження.",
      },
      {
        title: "Очікують відповіді в Telegram",
        value: pendingTelegramActions,
        description: "Надіслані запити, які ще не оброблені.",
      },
      {
        title: "Помилок за 24 год",
        value:
          metricFromRows(telegramRows, [
            "failed_messages_last_24h",
            "failed_messages_24h",
            "errors_last_24h",
          ]) ?? 0,
        description: "Помилки Telegram-повідомлень за останню добу.",
      },
      {
        title: "Стан",
        value: formatStatus(mappingStatus),
        description:
          telegramStatus.toLowerCase() === "healthy"
            ? "Мапінг і Telegram-підтвердження працюють."
            : `Telegram: ${formatStatus(telegramStatus)}`,
      },
    ],
    telegramHitlDetails: [
      {
        title: "Активні Telegram-чати",
        value:
          metricFromRows(telegramRows, [
            "active_chats",
            "telegram_active_chats",
            "active_telegram_chats",
          ]) ?? 0,
      },
      {
        title: "Активні маршрути",
        value:
          metricFromRows(telegramRows, [
            "active_routes",
            "telegram_active_routes",
            "routes_active",
          ]) ?? 0,
      },
      {
        title: "Повідомлень у черзі",
        value:
          metricFromRows(telegramRows, [
            "queued_messages",
            "messages_queued",
            "queue_messages",
          ]) ?? 0,
      },
      {
        title: "Запитів на дію",
        value:
          metricFromRows(telegramRows, [
            "pending_action_requests",
            "action_requests_pending",
            "pending_requests",
          ]) ?? pendingTelegramActions,
      },
      {
        title: "Підтверджувачі",
        value: activeApprovers ?? 0,
        description:
          activeApprovers === 1
            ? "Активний підтверджувач."
            : "Активні підтверджувачі.",
      },
      {
        title: "Стан Telegram HITL",
        value: formatStatus(telegramStatus),
        description: "Telegram-підтвердження доступні.",
      },
    ],
    unavailableNotes: [
      data?.mappingReviewHealth.unavailableReason
        ? "Дані стану мапінгу тимчасово недоступні."
        : null,
      data?.mappingReviewActionsRecent.unavailableReason
        ? "Останні дії мапінгу тимчасово недоступні."
        : null,
      data?.telegramHitlHealth.unavailableReason
        ? "Дані Telegram HITL тимчасово недоступні."
        : null,
    ].filter((note): note is string => Boolean(note)),
  };
}

function metricFromRows(rows: Row[], keys: string[]) {
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number") return value;
      if (
        typeof value === "string" &&
        value.trim() !== "" &&
        !Number.isNaN(Number(value))
      )
        return Number(value);
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
  const status = textFromRows(rows, [
    "binding_health_status",
    "health_status",
    "status",
  ]);
  return !status || status.toLowerCase() === "healthy";
}

function friendlyLabel(value: string) {
  return (
    FRIENDLY_COLUMN_LABELS[value.toLowerCase()] ??
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatValue(
  value: string | number | boolean | null | undefined,
  column: string,
) {
  if (value === null || value === undefined || value === "") return "—";
  if (column.endsWith("_at") || column.includes("date"))
    return formatDateTime(value);
  if (column === "platform") return formatPlatform(String(value));
  if (STATUS_COLUMNS.has(column)) return formatStatus(String(value));
  if (column === "confidence") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isNaN(numeric))
      return numeric <= 1
        ? `${Math.round(numeric * 100)}%`
        : `${Math.round(numeric)}%`;
  }
  return String(value);
}

function formatStatus(value: string) {
  return (
    FRIENDLY_VALUE_LABELS[value.toLowerCase()] ?? value.replaceAll("_", " ")
  );
}

function formatPlatform(value: string) {
  const normalized = value.toLowerCase();
  return FRIENDLY_PLATFORM_LABELS[normalized] ?? value;
}

function formatDateTime(value: string | number | boolean) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  })
    .format(date)
    .replace(",", ",");
}

function badgeVariant(value: string, column: string) {
  const normalized = value.toLowerCase();
  if (
    normalized === "healthy" ||
    normalized === "active" ||
    normalized === "confirmed"
  )
    return "secondary";
  if (
    normalized === "rejected" ||
    normalized === "error" ||
    normalized === "failed"
  )
    return "destructive";
  return "outline";
}

function isCompactColumn(column: string) {
  return STATUS_COLUMNS.has(column) || column === "confidence";
}
