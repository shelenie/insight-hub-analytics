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
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang, TranslationKey } from "@/i18n/translations";

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
type OptionalJsonData = {
  payload: Record<string, unknown> | null;
  unavailableReason: string | null;
};
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
  adsMultiAccountReadiness: OptionalJsonData;
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

const FRIENDLY_COLUMN_LABELS: Record<string, string | Record<Lang, string>> = {
  ad_account_name: { uk: "Рекламний акаунт", en: "Ad account" },
  binding_method: { uk: "Метод", en: "Method" },
  binding_status: { uk: "Статус", en: "Status" },
  binding_type: { uk: "Тип звʼязку", en: "Binding type" },
  campaign: { uk: "Кампанія", en: "Campaign" },
  client: { uk: "Клієнт", en: "Client" },
  client_name: { uk: "Клієнт", en: "Client" },
  confidence: { uk: "Впевненість", en: "Confidence" },
  created_at: { uk: "Створено", en: "Created" },
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  details: { uk: "Деталі", en: "Details" },
  external_account_id: { uk: "ID акаунта", en: "Account ID" },
  external_account_name: { uk: "Назва акаунта", en: "Account name" },
  gap_type: { uk: "Тип розриву", en: "Gap type" },
  funnel: { uk: "Воронка", en: "Funnel" },
  funnel_name: { uk: "Воронка", en: "Funnel" },
  health_status: { uk: "Стан звʼязків", en: "Binding health" },
  message: { uk: "Повідомлення", en: "Message" },
  impressions: { uk: "Покази", en: "Impressions" },
  mapping_status: { uk: "Мапінг", en: "Mapping" },
  platform: { uk: "Платформа", en: "Platform" },
  next_action: { uk: "Наступний крок", en: "Next action" },
  overall_status: { uk: "Загальний стан", en: "Overall status" },
  project: { uk: "Проєкт", en: "Project" },
  project_name: { uk: "Проєкт", en: "Project" },
  proposed_client_name: { uk: "Запропонований клієнт", en: "Proposed client" },
  proposed_funnel_name: { uk: "Запропонована воронка", en: "Proposed funnel" },
  proposed_project_name: {
    uk: "Запропонований проєкт",
    en: "Proposed project",
  },
  reach: { uk: "Охоплення", en: "Reach" },
  reason: { uk: "Причина", en: "Reason" },
  source_kind: { uk: "Тип джерела", en: "Source type" },
  source_name: { uk: "Джерело", en: "Source" },
  spend: { uk: "Витрати", en: "Spend" },
  status: { uk: "Статус", en: "Status" },
  total_accounts: { uk: "Усього акаунтів", en: "Total accounts" },
  bound_accounts: { uk: "Привʼязані", en: "Bound accounts" },
  unbound_accounts: { uk: "Непривʼязані", en: "Unbound accounts" },
  needs_attention_count: { uk: "Потребують уваги", en: "Needs attention" },
  updated_at: { uk: "Оновлено", en: "Updated" },
};

const FRIENDLY_VALUE_LABELS: Record<string, string | Record<Lang, string>> = {
  active: { uk: "Активний", en: "Active" },
  archived: { uk: "Архівний", en: "Archived" },
  paused: { uk: "Призупинений", en: "Paused" },
  ad_account: { uk: "Рекламний акаунт", en: "Ad account" },
  confirmed: { uk: "Підтверджено", en: "Confirmed" },
  healthy: { uk: "Все гаразд", en: "Healthy" },
  manual: { uk: "Вручну", en: "Manual" },
  pending: { uk: "Очікує", en: "Pending" },
  rejected: { uk: "Відхилено", en: "Rejected" },
  resolved_not_applied: { uk: "Не застосовано", en: "Not applied" },
  source: { uk: "Джерело даних", en: "Data source" },
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
  const { t, lang } = useI18n();
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
        adsMultiAccountReadiness,
      ] = await Promise.all([
        readOptionalView("v_mapping_review_health"),
        readOptionalView("v_mapping_review_actions_recent"),
        readOptionalView("v_telegram_hitl_production_health"),
        readAdsMultiAccountReadiness(),
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
        adsMultiAccountReadiness,
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
      const friendlyError = await getFriendlyBindingActionError(error, t);
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
      const friendlyError = getFriendlyBindingActionMessage(response, t);
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
          message: options.successMessage ?? t("bindingsActionSuccess"),
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
          message: options.successMessage ?? t("bindingsActionSuccess"),
          technical:
            options.includeTechnicalDetails === false
              ? null
              : getBindingActionTechnicalDetails(response),
          variant: "success",
        },
      }));
    } else {
      setMessage(t("bindingsActionSuccess"));
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
    () => buildAdFormOptions(query.data, normalAdForm, t, lang),
    [lang, normalAdForm, query.data, t],
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
      title: t("bindingsOverviewFilesTitle"),
      value: visibleBindingCounts.sourceBindings,
      description: t("bindingsOverviewFilesDescription"),
    },
    {
      title: t("bindingsOverviewAdAccountsTitle"),
      value: visibleBindingCounts.adAccountBindings,
      description: t("bindingsOverviewAdAccountsDescription"),
    },
    {
      title: t("bindingsOverviewProjectContextTitle"),
      value: visibleBindingCounts.projectDataBindings,
      description: t("bindingsOverviewProjectContextDescription"),
    },
    {
      title: t("bindingsOverviewAwaitingConfirmationTitle"),
      value: visibleBindingCounts.mappingReviewQueue,
      description: t("bindingsOverviewAwaitingConfirmationDescription"),
    },
  ];
  const connectionStatusCards = buildConnectionStatusCards(
    query.data,
    visibleBindingCounts,
    t,
    lang,
  );
  const isRefreshing = query.isFetching;
  const refreshLabel = isRefreshing
    ? t("bindingsRefreshRefreshing")
    : t("refresh");
  const headerActions =
    session && !query.isLoading && !query.error ? (
      <>
        {lastRefreshedAt ? (
          <p className="text-xs text-muted-foreground">
            {t("bindingsRefreshUpdated")}{" "}
            {formatDateTime(lastRefreshedAt.toISOString())}
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
      title={t("bindingsPageTitle")}
      subtitle={t("bindingsPageSubtitle")}
      actions={headerActions}
      contentClassName="pt-1 lg:pt-2"
    >
      <div className="space-y-4">
        {!session ? (
          <SectionCard
            title={t("bindingsPageTitle")}
            description={t("bindingsLoginRequiredTitle")}
          >
            <p className="text-sm text-muted-foreground">
              {t("bindingsLoginRequiredMessage")}
            </p>
          </SectionCard>
        ) : query.isLoading ? (
          <SectionCard
            title={t("bindingsPageTitle")}
            description={t("bindingsLoadingTitle")}
          >
            <p className="text-sm text-muted-foreground">
              {t("bindingsLoadingMessage")}
            </p>
          </SectionCard>
        ) : query.error ? (
          <SectionCard
            title={t("bindingsPageTitle")}
            description={t("bindingsSectionStatusTitle")}
          >
            <FriendlyError
              message={t("bindingsBackendUpdateRequired")}
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
                  {t("bindingsTabOverview")}
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="source"
                >
                  {t("bindingsTabSources")}
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="ad-account"
                >
                  {t("bindingsTabAdAccounts")}
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="project-data"
                >
                  {t("bindingsTabProjectData")}
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="mapping-review"
                >
                  {t("bindingsTabMappingReview")}
                </TabsTrigger>
                <TabsTrigger
                  className={ADS_SUBNAV_TRIGGER_CLASS}
                  value="health"
                >
                  {t("bindingsTabHealth")}
                </TabsTrigger>
              </TabsList>
            </div>

            <p className="rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
              {t("bindingsPageScopeNote")}
            </p>

            {message || (!roleLoading && (!canManage || roleError)) ? (
              <div className="space-y-1">
                {message ? (
                  <p className="text-xs text-muted-foreground">{message}</p>
                ) : null}
                {!roleLoading && !canManage ? (
                  <p className="text-xs text-muted-foreground">
                    {t("bindingsNoManageAccess")}
                  </p>
                ) : null}
                {!roleLoading && roleError ? (
                  <p className="text-xs text-muted-foreground">
                    {t("bindingsRoleUnavailable")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <TabsContent value="overview" className="mt-1">
              <SectionCard title={t("bindingsOverviewTitle")}>
                <KpiGrid cards={overviewCards} />
                <AdsBindingReadinessSummary
                  readiness={query.data?.adsMultiAccountReadiness}
                />
                <div className="mt-4 space-y-3 rounded-md border border-border/70 bg-muted/25 p-3 text-sm text-muted-foreground">
                  <p>{t("bindingsOverviewDescription")}</p>
                  <div className="space-y-1">
                    <p>{t("bindingsOverviewFilesHelper")}</p>
                    <p>{t("bindingsOverviewAdAccountsHelper")}</p>
                    <p>{t("bindingsOverviewReviewHelper")}</p>
                  </div>
                  {filteredMappingReviewQueue.length === 0 ? (
                    <p>{t("bindingsOverviewNoReview")}</p>
                  ) : null}
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="source" className="mt-1">
              <SectionCard
                title={t("bindingsSourcesTitle")}
                description={t("bindingsSourcesDescription")}
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
                  emptyText={t("bindingsSourcesEmpty")}
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
                        successMessage: t("bindingsSourceSaved"),
                      },
                    )
                  }
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="ad-account" className="mt-1">
              <SectionCard noPadding>
                <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[14px] font-semibold tracking-tight">
                      {t("bindingsAdAccountsTitle")}
                    </h2>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {t("bindingsAdAccountsDescription")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:shrink-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <label
                        className="text-xs font-medium text-muted-foreground sm:whitespace-nowrap"
                        htmlFor="ad-account-status-filter"
                      >
                        {t("bindingsStatusLabel")}
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
                          <SelectValue
                            placeholder={t("bindingsStatusPlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            {t("bindingsStatusActive")}
                          </SelectItem>
                          <SelectItem value="archived">
                            {t("bindingsStatusArchivedPaused")}
                          </SelectItem>
                          <SelectItem value="all">
                            {t("bindingsStatusAll")}
                          </SelectItem>
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
                      {t("bindingsCreateAdAccountButton")}
                    </Button>
                  </div>
                </div>
                <div className="p-4">
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
                            ? t("bindingsAdDrawerEditTitle")
                            : t("bindingsAdDrawerCreateTitle")}
                        </SheetTitle>
                        <SheetDescription>
                          {t("bindingsAdDrawerDescription")}
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
                          const validationError = validateAdForm(
                            normalAdForm,
                            t,
                          );
                          if (validationError)
                            return setAdFormError(validationError);
                          const existingActiveBinding =
                            hasMatchingActiveAdBinding(
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
                              successMessage: t("bindingsAdSaved"),
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
                                ? t("bindingsToastUpdatedTitle")
                                : t("bindingsToastCreatedTitle"),
                              description: existingActiveBinding
                                ? t("bindingsToastUpdatedDescription")
                                : t("bindingsToastCreatedDescription"),
                              className:
                                "border-emerald-500/50 bg-emerald-50 text-emerald-950 shadow-xl dark:bg-emerald-950 dark:text-emerald-50",
                              duration: 5000,
                            });
                          }
                        }}
                      />
                    </SheetContent>
                  </Sheet>

                  <BindingGapsPanel
                    readiness={query.data?.adsMultiAccountReadiness}
                    adAccounts={query.data?.adAccounts ?? []}
                    canManage={canManage}
                    session={Boolean(session)}
                    onBindAccount={(adAccountId) => {
                      setAdFormError("");
                      setNormalAdFeedback(null);
                      setAdFormMode("create");
                      setNormalAdForm({
                        ad_account_id: adAccountId,
                        client_id: "",
                        project_id: "",
                        funnel_id: "",
                      });
                      setAdFormOpen(true);
                    }}
                  />
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
                          supabase.functions.invoke(
                            "binding-create-or-update",
                            {
                              body: {
                                workspace_id: WORKSPACE_ID,
                                binding_type: "ad_account",
                                ...technicalAdForm,
                              },
                            },
                          ),
                        {
                          bindingType: "ad_account",
                          feedbackHandler: setTechnicalAdFeedback,
                          successMessage: t("bindingsAdSavedIdempotent"),
                        },
                      )
                    }
                  />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="project-data" className="mt-1">
              <SectionCard
                title={t("bindingsProjectBindingsTitle")}
                description={t("bindingsProjectBindingsDescription")}
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
                  emptyText={t("bindingsProjectBindingsEmpty")}
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="mapping-review" className="mt-1">
              <SectionCard
                title={t("bindingsMappingReviewTitle")}
                description={t("bindingsMappingReviewDescription")}
              >
                {filteredMappingReviewQueue.length === 0 ? (
                  <EmptyMappingReviewState
                    title={t("bindingsMappingReviewEmptyTitle")}
                    description={t("bindingsMappingReviewEmptyDescription")}
                  />
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
                      emptyText={t("bindingsMappingReviewEmptyTitle")}
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
                            ? t("bindingsRunning")
                            : t("bindingsSendTelegram")}
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
                          {pending === "approve"
                            ? t("bindingsRunning")
                            : t("bindingsApprove")}
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
                          {pending === "reject"
                            ? t("bindingsRunning")
                            : t("bindingsReject")}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="health" className="mt-1">
              <SectionCard
                title={t("bindingsHealthTitle")}
                description={t("bindingsHealthDescription")}
              >
                <KpiGrid cards={connectionStatusCards.production} />
                <DeveloperDetails
                  title={t("bindingsAdsReadinessTechnicalTitle")}
                >
                  {query.data?.adsMultiAccountReadiness?.unavailableReason ||
                  !query.data?.adsMultiAccountReadiness?.payload ? (
                    <p>{t("bindingsAdsReadinessUnavailable")}</p>
                  ) : (
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs">
                      {JSON.stringify(
                        query.data.adsMultiAccountReadiness.payload,
                        null,
                        2,
                      )}
                    </pre>
                  )}
                </DeveloperDetails>
                <DeveloperDetails title={t("bindingsTelegramDetailsTitle")}>
                  <p>{t("bindingsTelegramDetailsDescription")}</p>
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

async function getFriendlyBindingActionError(
  error: InvokeError,
  t: (key: TranslationKey) => string,
) {
  const payload = await readFunctionErrorPayload(error);
  return getFriendlyBindingActionMessage(
    {
      ok: false,
      error: payload?.error ?? error.message,
      code: payload?.code,
    },
    t,
  );
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

function getFriendlyBindingActionMessage(
  response: BindingActionResponse,
  t: (key: TranslationKey) => string,
) {
  if (
    response.code === "permission_denied" ||
    response.code === "insufficient_role" ||
    response.error?.toLowerCase().includes("insufficient")
  ) {
    return t("bindingsPermissionDenied");
  }

  if (
    response.code === "archived_target" ||
    response.error?.toLowerCase().includes("archiv")
  ) {
    return t("bindingsArchivedTargetError");
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
    return t("bindingsInvalidTargetError");
  }

  if (
    response.code === "rpc_failed" ||
    response.code === "rpc_not_wired" ||
    response.code === "access_check_failed"
  ) {
    return t("bindingsBackendSaveError");
  }

  return response.error || t("bindingsActionFailed");
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

async function readAdsMultiAccountReadiness(): Promise<OptionalJsonData> {
  const result = await supabase.rpc(
    "build_ads_multi_account_readiness" as never,
    { p_workspace_id: WORKSPACE_ID } as never,
  );
  if (result.error) {
    return { payload: null, unavailableReason: result.error.message };
  }
  return { payload: toObject(result.data), unavailableReason: null };
}

function AdsBindingReadinessSummary({
  readiness,
}: {
  readiness: OptionalJsonData | undefined;
}) {
  const { t, lang } = useI18n();
  if (!readiness) return null;
  if (readiness.unavailableReason || !readiness.payload) {
    return <ReadinessUnavailableNotice />;
  }
  const payload = readiness.payload;
  const summary = readObject(payload, "summary");
  const gapRows = readArray(payload, "binding_gaps");
  const unboundCount = readNumber(summary, "unbound_accounts") ?? gapRows.length;
  const platforms = uniquePlatformLabels(gapRows);
  const platformText = platforms.length ? platforms.join(", ") : "—";
  const summaryTemplate = unboundCount === 1 ? t("bindingsAdsNeedBindingSummaryOne") : t("bindingsAdsNeedBindingSummary");
  return (
    <div className="mt-4 rounded-md border border-border/70 bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {t("bindingsAdsReadinessTitle")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {unboundCount > 0
              ? interpolate(summaryTemplate, {
                  count: formatCount(unboundCount),
                  platforms: platformText,
                })
              : t("bindingsAdsNoBindingGapsSummary")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("bindingsAdsReadinessDescription")}
          </p>
        </div>
        <Badge variant={unboundCount > 0 ? "outline" : "secondary"}>
          {unboundCount > 0 ? t("bindingsGapNeedsBinding") : formatStatus(readString(payload, "overall_status") || "ok", lang)}
        </Badge>
      </div>
    </div>
  );
}

function BindingGapsPanel({
  readiness,
  adAccounts,
  canManage,
  session,
  onBindAccount,
}: {
  readiness: OptionalJsonData | undefined;
  adAccounts: Row[];
  canManage: boolean;
  session: boolean;
  onBindAccount: (adAccountId: string) => void;
}) {
  const { t } = useI18n();
  if (!readiness) return null;
  if (readiness.unavailableReason || !readiness.payload) {
    return <ReadinessUnavailableNotice />;
  }
  const gapRows = readArray(readiness.payload, "binding_gaps");
  return (
    <div className="mb-4 rounded-md border border-border/70 bg-muted/20 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {t("bindingsBindingGapsTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("bindingsBindingGapsDescription")}
          </p>
        </div>
      </div>
      {gapRows.length > 0 ? (
        <div className="space-y-3">
          {gapRows.map((row, index) => {
            const platformCode = asText(row.platform);
            const externalAccountId = asText(row.external_account_id);
            const platform = formatPlatform(platformCode || "—");
            const accountName = asText(row.external_account_name) || "—";
            const accountId = externalAccountId || "—";
            const matchedAdAccountId = findMatchingAdAccountId(
              adAccounts,
              platformCode,
              externalAccountId,
            );
            const actionDisabled = !session || !canManage || !matchedAdAccountId;
            return (
              <div key={`${platform}-${accountId}-${index}`} className="rounded-md border border-border/70 bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{platform}</p>
                    <p className="mt-1 text-sm text-foreground">{accountName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{accountId}</p>
                  </div>
                  <Badge variant="outline">{t("bindingsGapNeedsBinding")}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t("bindingsGapFriendlyMessage")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={actionDisabled}
                    onClick={() => {
                      if (matchedAdAccountId) onBindAccount(matchedAdAccountId);
                    }}
                  >
                    {t("bindingsGapBindAccountAction")}
                  </Button>
                  {!matchedAdAccountId ? (
                    <p className="max-w-xl text-xs text-muted-foreground">
                      {t("bindingsGapAccountNotSelectable")}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-foreground">
                      {t("bindingsGapNextStep")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("bindingsNoBindingGaps")}
        </p>
      )}
    </div>
  );
}

function findMatchingAdAccountId(
  adAccounts: Row[],
  platform: string,
  externalAccountId: string,
) {
  if (!platform || !externalAccountId) return "";
  const normalizedPlatform = platform.toLowerCase();
  const matched = filterRows(adAccounts).find(
    (row) =>
      asText(row.platform).toLowerCase() === normalizedPlatform &&
      asText(row.external_account_id) === externalAccountId,
  );
  return matched ? entityId(matched, "ad_account_id") : "";
}

function uniquePlatformLabels(rows: Row[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => formatPlatform(asText(row.platform)))
        .filter((value) => value.length > 0),
    ),
  );
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function ReadinessUnavailableNotice() {
  const { t } = useI18n();
  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      {t("bindingsAdsReadinessUnavailable")}
    </div>
  );
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readObject(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return toObject(payload[key]) ?? {};
}

function readArray(payload: Record<string, unknown>, key: string): Row[] {
  const value = payload[key];
  return Array.isArray(value)
    ? value
        .filter(
          (item) =>
            item && typeof item === "object" && !Array.isArray(item),
        )
        .map((item) => item as Row)
    : [];
}

function readNumber(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function formatCount(value: number | null) {
  return value === null ? "—" : value;
}

function readinessBadgeVariant(
  status: string,
): "secondary" | "destructive" | "outline" {
  const normalized = status.toLowerCase();
  if (["ready", "production_ready", "ok", "healthy"].includes(normalized))
    return "secondary";
  if (["error", "failed", "blocked"].includes(normalized))
    return "destructive";
  return "outline";
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
  const { t } = useI18n();
  const disabled = !session || !canManage || pending === "create-ad";
  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col">
      <div className="grid gap-3">
        <BindingSelect
          label={t("bindingsSelectAdAccountLabel")}
          placeholder={t("bindingsSelectAdAccountPlaceholder")}
          value={form.ad_account_id}
          options={options.adAccounts}
          emptyText={t("bindingsSelectAdAccountEmpty")}
          disabled={disabled}
          onChange={(value) =>
            setForm((current) => ({ ...current, ad_account_id: value }))
          }
        />
        <BindingSelect
          label={t("bindingsSelectClientLabel")}
          placeholder={t("bindingsSelectClientPlaceholder")}
          value={form.client_id}
          options={options.clients}
          emptyText={t("bindingsSelectClientEmpty")}
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
          label={t("bindingsSelectProjectLabel")}
          placeholder={t("bindingsSelectProjectPlaceholder")}
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
          label={t("bindingsSelectFunnelLabel")}
          placeholder={t("bindingsSelectFunnelPlaceholder")}
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
          {pending === "create-ad"
            ? t("bindingsSaveInProgress")
            : t("bindingsSaveBinding")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("bindingsCancel")}
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
  const { t } = useI18n();
  const searchPlaceholder = `${t("bindingsSearchPrefix")} ${label.toLowerCase()}`;

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
  const { t } = useI18n();
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("bindingsAdTableEmpty")}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
      <table className="min-w-full table-auto text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {[
              t("bindingsColumnAccount"),
              t("tablePlatform"),
              t("bindingsSelectClientLabel"),
              t("bindingsSelectProjectLabel"),
              t("bindingsSelectFunnelLabel"),
              t("tableMappingStatus"),
              t("tableStatus"),
              t("tableUpdatedAt"),
              t("bindingsColumnAction"),
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
                  {accountName(row, t)}
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
                  {t("bindingsRebind")}
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
  const { t } = useI18n();
  const submitLabel =
    type === "source" ? t("bindingsSaveSource") : t("bindingsSaveAdAccount");
  return (
    <details className="mt-6 rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-sm">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
        {t("bindingsTechnicalSummary")}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("bindingsTechnicalHelp")}
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
          {pending === pendingKey ? t("bindingsSaveInProgress") : submitLabel}
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
  const { t } = useI18n();
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {}).filter(
    (column) => column !== "workspace_id",
  );
  if (columns.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("bindingsNoDisplayFields")}
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
  const { lang } = useI18n();
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
                {friendlyLabel(column, lang)}
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

function EmptyMappingReviewState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/25 p-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
  const { lang } = useI18n();
  const formatted = formatValue(value, column, lang);
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
  t: (key: TranslationKey) => string,
  lang: Lang,
): AdFormOptions {
  const clients = filterRows(data?.clients ?? [])
    .map((row) => ({
      value: entityId(row, "client_id"),
      label: entityName(row, "client", t),
    }))
    .filter((option) => option.value);
  const projectsAll = filterRows(data?.projects ?? [])
    .map((row) => ({
      value: entityId(row, "project_id"),
      label: entityName(row, "project", t),
      clientId: asText(row.client_id),
    }))
    .filter((option) => option.value);
  const projects = projectsAll.filter(
    (option) => option.clientId === form.client_id || !form.client_id,
  );
  const funnelsAll = filterRows(data?.funnels ?? [])
    .map((row) => ({
      value: entityId(row, "funnel_id"),
      label: entityName(row, "funnel", t),
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
        ? `${formatStatus(getBindingStatus(boundRow), lang)}: ${[boundRow.client_name, boundRow.project_name, boundRow.funnel_name].map(asText).filter(Boolean).join(" → ") || t("bindingsAdAlreadyBoundFallback")}`
        : t("bindingsAdUnboundHint");
      return {
        value,
        label: `${formatPlatform(asText(row.platform))} · ${accountName(row, t)} · ${asText(row.external_account_id) || value}`,
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
      ? t("bindingsProjectEmptyForClient")
      : t("bindingsChooseClientFirst"),
    funnelEmptyText: form.project_id
      ? t("bindingsFunnelEmptyForProject")
      : t("bindingsChooseProjectFirst"),
  };
}

function validateAdForm(
  form: Record<string, string>,
  t: (key: TranslationKey) => string,
) {
  if (!form.ad_account_id) return t("bindingsValidationAdAccount");
  if (!form.client_id) return t("bindingsValidationClient");
  if (!form.project_id) return t("bindingsValidationProject");
  if (!form.funnel_id) return t("bindingsValidationFunnel");
  return "";
}

function entityId(row: Row, preferredKey: string) {
  return asText(row[preferredKey]) || asText(row.id);
}
function entityName(
  row: Row,
  entity: "client" | "project" | "funnel",
  t: (key: TranslationKey) => string,
) {
  return (
    asText(row.name) ||
    asText(row[`${entity}_name`]) ||
    t("bindingsUnnamedEntity")
  );
}
function accountName(row: Row, t: (key: TranslationKey) => string) {
  return (
    asText(row.external_account_name) ||
    asText(row.ad_account_name) ||
    asText(row.name) ||
    t("bindingsUnnamedAdAccount")
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
  t: (key: TranslationKey) => string,
  lang: Lang,
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
        title: t("bindingsMappingInReviewTitle"),
        value: pendingMappingReviews,
        description: t("bindingsMappingInReviewDescription"),
      },
      {
        title: t("bindingsTelegramPendingTitle"),
        value: pendingTelegramActions,
        description: t("bindingsTelegramPendingDescription"),
      },
      {
        title: t("bindingsErrors24hTitle"),
        value:
          metricFromRows(telegramRows, [
            "failed_messages_last_24h",
            "failed_messages_24h",
            "errors_last_24h",
          ]) ?? 0,
        description: t("bindingsErrors24hDescription"),
      },
      {
        title: t("bindingsStatusCardTitle"),
        value: formatStatus(mappingStatus, lang),
        description:
          telegramStatus.toLowerCase() === "healthy"
            ? t("bindingsHealthyStatusDescription")
            : `Telegram: ${formatStatus(telegramStatus, lang)}`,
      },
    ],
    telegramHitlDetails: [
      {
        title: t("bindingsActiveTelegramChats"),
        value:
          metricFromRows(telegramRows, [
            "active_chats",
            "telegram_active_chats",
            "active_telegram_chats",
          ]) ?? 0,
      },
      {
        title: t("bindingsActiveRoutes"),
        value:
          metricFromRows(telegramRows, [
            "active_routes",
            "telegram_active_routes",
            "routes_active",
          ]) ?? 0,
      },
      {
        title: t("bindingsQueuedMessages"),
        value:
          metricFromRows(telegramRows, [
            "queued_messages",
            "messages_queued",
            "queue_messages",
          ]) ?? 0,
      },
      {
        title: t("bindingsActionRequests"),
        value:
          metricFromRows(telegramRows, [
            "pending_action_requests",
            "action_requests_pending",
            "pending_requests",
          ]) ?? pendingTelegramActions,
      },
      {
        title: t("bindingsApprovers"),
        value: activeApprovers ?? 0,
        description:
          activeApprovers === 1
            ? t("bindingsApproverSingle")
            : t("bindingsApproverPlural"),
      },
      {
        title: t("bindingsTelegramHitlStatus"),
        value: formatStatus(telegramStatus),
        description: t("bindingsTelegramAvailable"),
      },
    ],
    unavailableNotes: [
      data?.mappingReviewHealth.unavailableReason
        ? t("bindingsMappingHealthUnavailable")
        : null,
      data?.mappingReviewActionsRecent.unavailableReason
        ? t("bindingsRecentActionsUnavailable")
        : null,
      data?.telegramHitlHealth.unavailableReason
        ? t("bindingsTelegramHealthUnavailable")
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

function friendlyLabel(value: string, lang: Lang) {
  const label = FRIENDLY_COLUMN_LABELS[value.toLowerCase()];
  if (typeof label === "string") return label;
  return (
    label?.[lang] ??
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatValue(
  value: string | number | boolean | null | undefined,
  column: string,
  lang: Lang,
) {
  if (value === null || value === undefined || value === "") return "—";
  if (column.endsWith("_at") || column.includes("date"))
    return formatDateTime(value);
  if (column === "platform") return formatPlatform(String(value));
  if (STATUS_COLUMNS.has(column)) return formatStatus(String(value), lang);
  if (column === "confidence") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isNaN(numeric))
      return numeric <= 1
        ? `${Math.round(numeric * 100)}%`
        : `${Math.round(numeric)}%`;
  }
  return String(value);
}

function formatStatus(value: string, lang: Lang = "uk") {
  const label = FRIENDLY_VALUE_LABELS[value.toLowerCase()];
  if (typeof label === "string") return label;
  return label?.[lang] ?? value.replaceAll("_", " ");
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
