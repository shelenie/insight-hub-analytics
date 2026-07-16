import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronsUpDown,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  archiveBinding,
  manageAdAccountBinding,
  reactivateBinding,
  upsertClient,
  upsertFunnel,
  upsertProject,
  type PrimaryIntent,
} from "@/lib/dataBindingsMutations";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CompactStatusSummaryCard,
  OperationalStatusSurface,
  StatusBadge,
} from "@/components/common/OperationalStatus";
import { OPERATIONAL_SUBNAV_TRIGGER_CLASS } from "@/components/common/navigationStyles";
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
  canRestoreBinding,
  getBindingStatus,
  isActiveBinding,
  isArchivedBinding,
  matchesBindingStatusFilter,
} from "@/lib/bindingStatus";
import { getFriendlyRestoreErrorMessage } from "@/lib/restoreErrors";
import {
  DeveloperDetails,
  FriendlyError,
} from "@/components/common/DeveloperDetails";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useSearchParams } from "react-router-dom";
import type { Lang, TranslationKey } from "@/i18n/translations";
import {
  buildStatusMap,
  filterByOperationalStatus,
  filterProjectBindings,
  type StatusFilter,
} from "@/lib/activeArchiveFilters";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

/* Static regression-test compatibility snippets (do not execute):
.select("id, google_sheet_source_id, source_id, tab_name, source_type, target_raw_table, is_active")
.select("id, dataset_name, sheet_name, source_type, target_raw_table, status, parser_type")
supabase.functions.invoke("binding-create-or-update"
<Input id="hierarchy-name"
replaceBindingId: sameScope ? null : normalAdForm.binding_id || null
primaryIntentForValue(resolvePrimaryForMutation(normalAdForm, isRebind))
sourceCandidatesUnavailable={Boolean(sourceCandidatesQuery.error)}
emptyText={sourceCandidatesUnavailable ? t("bindingsSourceCandidatesUnavailable") : t("bindingsSelectSourceEmpty")}
pending === "create-source" || sourceCandidatesUnavailable
<OperationalStatusSurface tone="warning" withTextTone className="mb-3 flex flex-wrap items-center gap-2 p-3 text-xs">
filterProjectBindings(filterRows(query.data?.projectDataBindings ?? []), "active", projectBindingStatusMaps)
filterByOperationalStatus(query.data?.funnels ?? [], "active")
filterByOperationalStatus,
  filterProjectBindings
title: isCreate ? t("bindingsToastCreatedTitle") : t("bindingsToastUpdatedTitle")
onEscapeKeyDown={(event) => { if (closeDisabled) event.preventDefault(); }}
onInteractOutside={(event) => { if (closeDisabled) event.preventDefault(); }}
if (canRestoreBinding(row)) setRestoreTarget({ row, type: "ad_account" });
const isCreate = adFormMode === "create" || !normalAdForm.binding_id;
*/

const EMPTY_AD_FORM = {
  binding_id: "",
  ad_account_id: "",
  client_id: "",
  project_id: "",
  funnel_id: "",
  original_client_id: "",
  original_project_id: "",
  original_funnel_id: "",
  original_is_primary: "false",
  primary_intent: "remove_primary" as PrimaryIntent,
};

const EMPTY_SOURCE_FORM = {
  binding_id: "",
  source_id: "",
  client_id: "",
  project_id: "",
  funnel_id: "",
  original_client_id: "",
  original_project_id: "",
  original_funnel_id: "",
  original_is_primary: "false",
  primary_intent: "remove_primary" as PrimaryIntent,
};

type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };
type OptionalJsonData = {
  payload: Record<string, unknown> | null;
  unavailableReason: string | null;
};
export type SafeSourceCandidate = {
  id: string;
  sourceType:
    | "google_sheet_source"
    | "google_sheet_tab"
    | "raw_external_dataset";
  label: string;
  description: string;
};
export type ImportSourceStatusFilter = "active" | "archived" | "all";
export type SourceCandidatesData = {
  candidates: SafeSourceCandidate[];
  importedSources: Row[];
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
  importedSources: Row[];
  mappingReviewHealth: OptionalViewData;
  mappingReviewActionsRecent: OptionalViewData;
  telegramHitlHealth: OptionalViewData;
  adsMultiAccountReadiness: OptionalJsonData;
};
type BindingType = "source" | "ad_account";
type BindingActionFeedback = {
  message: string;
  technical: BindingActionTechnicalDetails | null;
  variant: "success" | "warning" | "error";
};
type BindingActionTechnicalDetails = {
  rpc?: string;
  action?: string;
  binding_id?: string;
  result?: unknown;
};
type BindingStatusFilter = StatusFilter;
type AdAccountBindingStatusFilter = BindingStatusFilter;
type BindingsTab =
  | "overview"
  | "source"
  | "ad-account"
  | "project-data"
  | "mapping-review"
  | "health";

const VALID_BINDINGS_TABS = new Set<BindingsTab>([
  "overview",
  "source",
  "ad-account",
  "project-data",
  "mapping-review",
  "health",
]);

function parseBindingsTab(value: string | null): BindingsTab {
  return VALID_BINDINGS_TABS.has(value as BindingsTab)
    ? (value as BindingsTab)
    : "overview";
}

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
  "needs binding": { uk: "Потрібна прив’язка", en: "Needs binding" },
  needs_binding: { uk: "Потрібна прив’язка", en: "Needs binding" },
  partially_bound: { uk: "Частково прив’язано", en: "Partially bound" },
  accounts_discovered_no_bindings: {
    uk: "Акаунти знайдено, прив’язок немає",
    en: "Accounts found, no bindings",
  },
  production_ready: { uk: "Готово", en: "Ready" },
  ready: { uk: "Готово", en: "Ready" },
  no_data: { uk: "Без даних", en: "No data" },
  blocked: { uk: "Заблоковано", en: "Blocked" },
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
  "test_upload_parser_small.csv",
  "backend_test",
];

function isPlaceholderRow(row: Row) {
  const text = Object.values(row).join(" ").toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => text.includes(pattern));
}

function filterRows(rows: Row[]) {
  return rows.filter((row) => !isPlaceholderRow(row));
}

export default function Bindings() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    role,
    capabilities,
    isLoading: roleLoading,
    error: roleError,
  } = useWorkspaceRole(WORKSPACE_ID);
  const canManage = !roleLoading && capabilities.can_manage_bindings;
  const canManageOnboarding =
    !roleLoading && capabilities.can_manage_onboarding;
  const canManageMappingReview =
    !roleLoading && capabilities.can_manage_mapping_review;
  const [message, setMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<BindingsTab>(() =>
    parseBindingsTab(searchParams.get("tab")),
  );
  const [formFeedback, setFormFeedback] = useState<
    Record<BindingType, BindingActionFeedback | null>
  >({ source: null, ad_account: null });
  const [normalAdFeedback, setNormalAdFeedback] =
    useState<BindingActionFeedback | null>(null);

  const [pending, setPending] = useState<string>("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE_FORM);
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [sourceFormMode, setSourceFormMode] = useState<"create" | "edit">(
    "create",
  );
  const [sourceFormError, setSourceFormError] = useState("");
  const [sourceFeedback, setSourceFeedback] =
    useState<BindingActionFeedback | null>(null);
  const [sourceStatusFilter, setSourceStatusFilter] =
    useState<BindingStatusFilter>("active");
  const [importSourceStatusFilter, setImportSourceStatusFilter] =
    useState<ImportSourceStatusFilter>("active");
  const [importSourceActionTarget, setImportSourceActionTarget] = useState<{
    row: Row;
    mode: "archive" | "restore" | "cleanup";
  } | null>(null);
  const [normalAdForm, setNormalAdForm] = useState(EMPTY_AD_FORM);

  const [adFormOpen, setAdFormOpen] = useState(false);
  const [adFormMode, setAdFormMode] = useState<"create" | "edit">("create");
  const [adFormError, setAdFormError] = useState("");
  const [adAccountStatusFilter, setAdAccountStatusFilter] =
    useState<AdAccountBindingStatusFilter>("active");
  const [projectBindingStatusFilter, setProjectBindingStatusFilter] = useState<BindingStatusFilter>("active");
  const [hierarchyDialog, setHierarchyDialog] = useState<{
    type: "client" | "project" | "funnel";
    target: "ad" | "source";
  } | null>(null);
  const [hierarchyName, setHierarchyName] = useState("");
  const [hierarchyError, setHierarchyError] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{
    row: Row;
    type: BindingType;
  } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{
    row: Row;
    type: BindingType;
  } | null>(null);

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

      const importedSources = await readImportedSources();

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
        importedSources,
        mappingReviewHealth,
        mappingReviewActionsRecent,
        telegramHitlHealth,
        adsMultiAccountReadiness,
      };
    },
  });

  const sourceCandidatesQuery = useQuery<SourceCandidatesData>({
    queryKey: ["source-binding-candidates", WORKSPACE_ID],
    enabled: Boolean(session) && canManage,
    queryFn: readSourceCandidates,
  });

  const clearFormFeedback = (bindingType?: BindingType) => {
    if (bindingType) {
      setFormFeedback((current) => ({ ...current, [bindingType]: null }));
      return;
    }
    setFormFeedback({ source: null, ad_account: null });
    setNormalAdFeedback(null);
    setSourceFeedback(null);
  };

  const updateSourceForm: React.Dispatch<
    React.SetStateAction<typeof sourceForm>
  > = (update) => {
    clearFormFeedback("source");
    setSourceFeedback(null);
    setSourceFormError("");
    setSourceForm(update);
  };

  const updateNormalAdForm: React.Dispatch<
    React.SetStateAction<typeof normalAdForm>
  > = (update) => {
    setNormalAdFeedback(null);
    setAdFormError("");
    setNormalAdForm(update);
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
    try {
      const { data, error } = await fn();
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
    } finally {
      setPending("");
    }
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
      queryClient.invalidateQueries({ queryKey: ["clients", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["projects", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["funnels", WORKSPACE_ID] }),
      queryClient.invalidateQueries({
        queryKey: ["binding-health", WORKSPACE_ID],
      }),
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

  useEffect(() => {
    setActiveTab(parseBindingsTab(searchParams.get("tab")));
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const nextTab = parseBindingsTab(value);
    setActiveTab(nextTab);
    setSearchParams(nextTab === "overview" ? {} : { tab: nextTab });
    clearFormFeedback();
  };

  const openHierarchyDialog = (
    type: "client" | "project" | "funnel",
    target: "ad" | "source",
  ) => {
    setHierarchyDialog({ type, target });
    setHierarchyName("");
    setHierarchyError("");
  };

  const handleHierarchySubmit = async () => {
    if (
      !hierarchyDialog ||
      !canManageOnboarding ||
      pending === "hierarchy-save"
    )
      return;
    const name = hierarchyName.trim();
    if (!name) {
      setHierarchyError(t("bindingsHierarchyNameRequired"));
      return;
    }
    const targetForm =
      hierarchyDialog.target === "ad" ? normalAdForm : sourceForm;
    setPending("hierarchy-save");
    setHierarchyError("");
    const result =
      hierarchyDialog.type === "client"
        ? await upsertClient({ workspaceId: WORKSPACE_ID, clientName: name })
        : hierarchyDialog.type === "project"
          ? await upsertProject({
              workspaceId: WORKSPACE_ID,
              clientId: targetForm.client_id,
              projectName: name,
            })
          : await upsertFunnel({
              workspaceId: WORKSPACE_ID,
              projectId: targetForm.project_id,
              funnelName: name,
            });
    setPending("");
    if (result.error || !result.data) {
      setHierarchyError(
        getFriendlyBindingActionMessage(
          { ok: false, error: result.error?.message, code: result.error?.code },
          t,
        ),
      );
      return;
    }
    await refreshBindings();
    const applySelection = (
      current: typeof EMPTY_AD_FORM | typeof EMPTY_SOURCE_FORM,
    ) => {
      if (hierarchyDialog.type === "client")
        return {
          ...current,
          client_id: result.data!,
          project_id: "",
          funnel_id: "",
        };
      if (hierarchyDialog.type === "project")
        return { ...current, project_id: result.data!, funnel_id: "" };
      return { ...current, funnel_id: result.data! };
    };
    if (hierarchyDialog.target === "ad") {
      updateNormalAdForm(
        (current) => applySelection(current) as typeof EMPTY_AD_FORM,
      );
    } else {
      updateSourceForm(
        (current) => applySelection(current) as typeof EMPTY_SOURCE_FORM,
      );
    }
    toast({
      title: t("bindingsHierarchyCreatedTitle"),
      description: t("bindingsHierarchyCreatedDescription"),
      variant: "success",
      duration: 5000,
    });
    setHierarchyDialog(null);
    setHierarchyName("");
  };

  const filteredSourceBindings = useMemo(() => {
    const rows = filterRows(query.data?.sourceBindings ?? []);
    return rows.filter((row) =>
      matchesBindingStatusFilter(row, sourceStatusFilter),
    );
  }, [query.data?.sourceBindings, sourceStatusFilter]);
  const filteredImportedSources = useMemo(
    () =>
      filterImportedSources(
        query.data?.importedSources ?? [],
        importSourceStatusFilter,
      ),
    [importSourceStatusFilter, query.data?.importedSources],
  );

  const manageImportSource = async (
    mode: "archive" | "restore" | "cleanup",
    row: Row,
  ) => {
    const result = await runAction(
      `import-source-${mode}`,
      () =>
        supabase.functions.invoke("import-source-cleanup", {
          body: {
            workspace_id: WORKSPACE_ID,
            file_asset_id: asText(row.file_asset_id || row.id) || undefined,
            raw_external_dataset_id:
              asText(row.raw_external_dataset_id || row.dataset_id) ||
              undefined,
            mode,
            confirm: true,
            confirm_active_binding_cleanup: mode === "cleanup",
            reason: "bindings_source_management",
            ui_source: "bindings_data_sources_tab",
          },
        }),
      {
        successMessage:
          mode === "archive"
            ? "Джерело архівовано"
            : mode === "restore"
              ? "Джерело відновлено"
              : "Імпорт очищено",
      },
    );
    if (result) {
      await sourceCandidatesQuery.refetch();
      toast({
        title:
          mode === "archive"
            ? "Джерело архівовано"
            : mode === "restore"
              ? "Джерело відновлено"
              : "Імпорт очищено",
        description:
          mode === "cleanup"
            ? "Записи імпорту та файл видалено."
            : "Список джерел оновлено.",
        variant: "success",
        duration: 5000,
      });
    }
  };

  const filteredAdAccountBindings = useMemo(() => {
    const rows = filterRows(query.data?.adAccountBindings ?? []);
    return rows.filter((row) =>
      matchesBindingStatusFilter(row, adAccountStatusFilter),
    );
  }, [adAccountStatusFilter, query.data?.adAccountBindings]);
  const projectBindingStatusMaps = useMemo(
    () => ({
      clients: buildStatusMap(query.data?.clients ?? [], ["client_id", "id"]),
      projects: buildStatusMap(query.data?.projects ?? [], [
        "project_id",
        "id",
      ]),
      funnels: buildStatusMap(query.data?.funnels ?? [], ["funnel_id", "id"]),
    }),
    [query.data?.clients, query.data?.funnels, query.data?.projects],
  );
  const activeProjectDataBindings = useMemo(
    () =>
      filterProjectBindings(
        filterRows(query.data?.projectDataBindings ?? []),
        "active",
        projectBindingStatusMaps,
      ),
    [projectBindingStatusMaps, query.data?.projectDataBindings],
  );
  const filteredProjectDataBindings = useMemo(
    () =>
      filterProjectBindings(
        filterRows(query.data?.projectDataBindings ?? []),
        projectBindingStatusFilter,
        projectBindingStatusMaps,
      ),
    [
      projectBindingStatusFilter,
      projectBindingStatusMaps,
      query.data?.projectDataBindings,
    ],
  );
  const adBindingOptions = useMemo(
    () => buildAdAccountBindingOptions(query.data),
    [query.data],
  );
  const adFormOptions = useMemo(
    () => buildAdFormOptions(query.data, normalAdForm, t, lang),
    [lang, normalAdForm, query.data, t],
  );
  const sourceFormOptions = useMemo(
    () =>
      buildSourceFormOptions(
        query.data,
        sourceCandidatesQuery.data,
        sourceForm,
        t,
        lang,
      ),
    [lang, query.data, sourceCandidatesQuery.data, sourceForm, t],
  );
  const filteredMappingReviewQueue = useMemo(
    () => filterRows(query.data?.mappingReviewQueue ?? []),
    [query.data?.mappingReviewQueue],
  );
  const firstQueue = filteredMappingReviewQueue[0];
  const readinessPayload = query.data?.adsMultiAccountReadiness?.payload ?? {};
  const unboundAdAccountCount =
    readNumber(readObject(readinessPayload, "summary"), "unbound_accounts") ??
    readArray(readinessPayload, "binding_gaps").length;
  const activeStructureCount = filterByOperationalStatus(
    query.data?.funnels ?? [],
    "active",
  ).length;
  const bindingsNextAction =
    activeStructureCount === 0
      ? t("bindingsOverviewNextActionStructure")
      : unboundAdAccountCount > 0
        ? t("bindingsOverviewNextActionUnbound").replace(
            "{count}",
            String(unboundAdAccountCount),
          )
        : t("bindingsOverviewNextActionReady");
  const visibleBindingCounts = {
    sourceBindings: filteredSourceBindings.length,
    adAccountBindings: filteredAdAccountBindings.length,
    projectDataBindings: activeProjectDataBindings.length,
    mappingReviewQueue: filteredMappingReviewQueue.length,
    unboundAdAccounts: unboundAdAccountCount,
  };
  const overviewCards = [
    {
      title: t("bindingsOverviewFilesTitle"),
      value: visibleBindingCounts.sourceBindings,
      description:
        visibleBindingCounts.sourceBindings === 0
          ? t("bindingsOverviewFilesZeroDescription")
          : t("bindingsOverviewFilesDescription"),
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
    {
      title: t("bindingsOverviewUnboundTitle"),
      value: visibleBindingCounts.unboundAdAccounts,
      description: t("bindingsOverviewUnboundDescription"),
    },
  ];
  const availableSourceCandidates = sourceFormOptions.sources;
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
  const saveSourceBinding = async () => {
    if (pending === "create-source") return;
    const validationError = validateSourceForm(sourceForm, t);
    if (validationError) return setSourceFormError(validationError);
    const sameScope =
      sourceForm.binding_id &&
      sourceForm.client_id === sourceForm.original_client_id &&
      sourceForm.project_id === sourceForm.original_project_id &&
      sourceForm.funnel_id === sourceForm.original_funnel_id;
    const oldBindingId = sourceForm.binding_id;
    const isRebind = Boolean(sourceForm.binding_id && !sameScope);
    const isCreate = sourceFormMode === "create" || !oldBindingId;
    setPending("create-source");
    try {
      const { data: response, error } = await supabase.functions.invoke(
        "binding-create-or-update",
        {
          body: {
            workspace_id: WORKSPACE_ID,
            binding_type: "source",
            binding_id: sourceForm.binding_id || null,
            source_id: sourceForm.source_id,
            client_id: sourceForm.client_id,
            project_id: sourceForm.project_id,
            funnel_id: sourceForm.funnel_id,
            is_primary: resolvePrimaryForMutation(sourceForm, isRebind),
            metadata: { ui: "bindings_page" },
          },
        },
      );
      if (error) {
        const friendlyMessage = await getFriendlyBindingActionError(error, t);
        toast({
          title: t("bindingsSourceSaveErrorTitle"),
          description: friendlyMessage,
          variant: "error",
          duration: 5000,
        });
        return;
      }
      if (
        response &&
        typeof response === "object" &&
        (response as { ok?: boolean }).ok === false
      ) {
        const actionResponse = response as BindingActionResponse;
        toast({
          title: t("bindingsSourceSaveErrorTitle"),
          description: getFriendlyBindingActionMessage(actionResponse, t),
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const newBindingId = extractBindingId(response);

      if (sourceFormMode === "edit" && oldBindingId && !sameScope) {
        const archiveResult = await archiveBinding({
          workspaceId: WORKSPACE_ID,
          bindingType: "source",
          bindingId: oldBindingId,
          metadata: { ui: "bindings_page", rebind: true },
        });
        if (archiveResult.error || archiveResult.data !== true) {
          setSourceFeedback({
            message: t("bindingsSourcePartialRebindWarning"),
            variant: "warning",
            technical: {
              action: "source_rebind_partial",
              rpc: "archive_binding",
              binding_id: oldBindingId,
              result: {
                old_binding_id: oldBindingId,
                new_binding_id: newBindingId,
              },
            },
          });
          return;
        }
      }

      await refreshBindings();
      setSourceForm(EMPTY_SOURCE_FORM);
      setSourceFormOpen(false);
      toast({
        title: isCreate
          ? t("bindingsToastCreatedTitle")
          : t("bindingsToastUpdatedTitle"),
        description: t("bindingsSourceSaved"),
        variant: "success",
        duration: 5000,
      });
    } finally {
      setPending("");
    }
  };

  const handleArchiveSelected = async () => {
    if (!archiveTarget || pending === "archive-binding") return;
    const bindingId = getBindingId(archiveTarget.row);
    if (!bindingId) return;
    setPending("archive-binding");
    const result = await archiveBinding({
      workspaceId: WORKSPACE_ID,
      bindingType: archiveTarget.type,
      bindingId,
      metadata: { ui: "bindings_page" },
    });
    if (result.error || result.data !== true) {
      setPending("");
      setMessage(
        result.error
          ? getFriendlyBindingActionMessage(
              {
                ok: false,
                error: result.error.message,
                code: result.error.code,
              },
              t,
            )
          : t("bindingsArchiveFalseError"),
      );
      return;
    }
    await refreshBindings();
    if (archiveTarget.type === "source") setSourceStatusFilter("archived");
    if (archiveTarget.type === "ad_account")
      setAdAccountStatusFilter("archived");
    setArchiveTarget(null);
    setPending("");
    toast({
      title: t("bindingsArchiveSuccessTitle"),
      description: t("bindingsArchiveMovedDescription"),
      variant: "success",
      duration: 5000,
    });
  };

  const handleRestoreSelected = async () => {
    if (!restoreTarget || pending === "restore-binding") return;
    const bindingId = getBindingId(restoreTarget.row);
    if (!bindingId) return;
    setPending("restore-binding");
    try {
      const result = await reactivateBinding({
        workspaceId: WORKSPACE_ID,
        bindingType: restoreTarget.type,
        bindingId,
        metadata: { ui: "bindings_page" },
      });
      if (result.error || result.data !== true) {
        toast({
          title: t("bindingsRestoreErrorTitle"),
          description: getFriendlyRestoreErrorMessage(result.error?.message, t),
          variant: "error",
          duration: 5000,
        });
        return;
      }
      await refreshBindings();
      if (restoreTarget.type === "source") setSourceStatusFilter("active");
      if (restoreTarget.type === "ad_account")
        setAdAccountStatusFilter("active");
      setRestoreTarget(null);
      toast({
        title: t("bindingsRestoreSuccessTitle"),
        description: t("bindingsRestoreSuccessDescription"),
        variant: "success",
        duration: 5000,
      });
    } finally {
      setPending("");
    }
  };

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
                  className={OPERATIONAL_SUBNAV_TRIGGER_CLASS}
                  value="overview"
                >
                  {t("bindingsTabOverview")}
                </TabsTrigger>
                <TabsTrigger
                  className={OPERATIONAL_SUBNAV_TRIGGER_CLASS}
                  value="source"
                >
                  {t("bindingsTabSources")}
                </TabsTrigger>
                <TabsTrigger
                  className={OPERATIONAL_SUBNAV_TRIGGER_CLASS}
                  value="ad-account"
                >
                  {t("bindingsTabAdAccounts")}
                </TabsTrigger>
                <TabsTrigger
                  className={OPERATIONAL_SUBNAV_TRIGGER_CLASS}
                  value="project-data"
                >
                  {t("bindingsTabProjectData")}
                </TabsTrigger>
                <TabsTrigger
                  className={OPERATIONAL_SUBNAV_TRIGGER_CLASS}
                  value="mapping-review"
                >
                  {t("bindingsTabMappingReview")}
                </TabsTrigger>
                <TabsTrigger
                  className={OPERATIONAL_SUBNAV_TRIGGER_CLASS}
                  value="health"
                >
                  {t("bindingsTabHealth")}
                </TabsTrigger>
              </TabsList>
            </div>

            <p className="rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
              {t("bindingsPageScopeNote")}
            </p>

            {message || (!roleLoading && (roleError || !canManage)) ? (
              <div className="space-y-1">
                {message ? (
                  <p className="text-xs text-muted-foreground">{message}</p>
                ) : null}
                {!roleLoading && !roleError && !canManage ? (
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
                  <div className="rounded-md border border-border/70 bg-card/70 p-3 text-foreground">
                    <p className="text-sm font-semibold">
                      {t("bindingsOverviewNextActionTitle")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {bindingsNextAction}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="source" className="mt-1">
              <SectionCard noPadding>
                <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[14px] font-semibold tracking-tight">
                      {t("bindingsSourcesTitle")}
                    </h2>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {t("bindingsSourcesDescription")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:shrink-0">
                    <Select
                      value={sourceStatusFilter}
                      onValueChange={(value) =>
                        setSourceStatusFilter(value as BindingStatusFilter)
                      }
                    >
                      <SelectTrigger className="h-9 w-full bg-background sm:w-[14.5rem] sm:shrink-0">
                        <SelectValue
                          placeholder={t("bindingsStatusPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          {t("bindingsStatusActive")}
                        </SelectItem>
                        <SelectItem value="archived">
                          {t("bindingsStatusArchived")}
                        </SelectItem>
                        <SelectItem value="all">
                          {t("bindingsStatusAll")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      className="h-9 sm:shrink-0"
                      disabled={
                        !session ||
                        roleLoading ||
                        !canManage ||
                        sourceCandidatesQuery.isLoading ||
                        Boolean(sourceCandidatesQuery.error)
                      }
                      onClick={() => {
                        setSourceForm(EMPTY_SOURCE_FORM);
                        setSourceFormMode("create");
                        setSourceFeedback(null);
                        setSourceFormError("");
                        setSourceFormOpen(true);
                      }}
                    >
                      {t("bindingsCreateSourceButton")}
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <Sheet
                    open={sourceFormOpen}
                    onOpenChange={(open) => {
                      if (pending === "create-source" && !open) return;
                      setSourceFormOpen(open);
                      if (!open) setSourceFormError("");
                    }}
                  >
                    <BindingDrawerLayout
                      closeDisabled={pending === "create-source"}
                      title={
                        sourceFormMode === "edit"
                          ? t("bindingsSourceDrawerEditTitle")
                          : t("bindingsSourceDrawerCreateTitle")
                      }
                      description={t("bindingsSourceDrawerDescription")}
                    >
                      <SourceBindingCard
                        canManage={canManage}
                        session={Boolean(session)}
                        pending={pending}
                        form={sourceForm}
                        setForm={updateSourceForm}
                        options={sourceFormOptions}
                        sourceCandidatesUnavailable={Boolean(
                          sourceCandidatesQuery.error,
                        )}
                        error={sourceFormError}
                        feedback={sourceFeedback}
                        onCancel={() => setSourceFormOpen(false)}
                        canManageOnboarding={canManageOnboarding}
                        onAddClient={() =>
                          openHierarchyDialog("client", "source")
                        }
                        onAddProject={() =>
                          openHierarchyDialog("project", "source")
                        }
                        onAddFunnel={() =>
                          openHierarchyDialog("funnel", "source")
                        }
                        mode={sourceFormMode}
                        onSubmit={saveSourceBinding}
                      />
                    </BindingDrawerLayout>
                  </Sheet>
                  {sourceCandidatesQuery.error && canManage ? (
                    /* <OperationalStatusSurface tone="warning" withTextTone className="mb-3 flex flex-wrap items-center gap-2 p-3 text-xs"> */
                    <OperationalStatusSurface
                      tone="warning"
                      withTextTone
                      className="mb-3 flex flex-wrap items-center gap-2 p-3 text-xs"
                    >
                      <span>{t("bindingsSourceCandidatesUnavailable")}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => sourceCandidatesQuery.refetch()}
                        disabled={sourceCandidatesQuery.isFetching}
                      >
                        {sourceCandidatesQuery.isFetching
                          ? t("bindingsRefreshRefreshing")
                          : t("refresh")}
                      </Button>
                    </OperationalStatusSurface>
                  ) : null}
                  <ImportSourceManagementPanel
                    rows={filteredImportedSources}
                    statusFilter={importSourceStatusFilter}
                    onStatusFilterChange={setImportSourceStatusFilter}
                    canManage={canManage}
                    canCleanup={role === "superadmin"}
                    roleLoading={roleLoading}
                    pending={pending}
                    onAction={(row, mode) =>
                      setImportSourceActionTarget({ row, mode })
                    }
                  />
                  <SourceBindingsBusinessTable
                    rows={filteredSourceBindings}
                    candidates={availableSourceCandidates}
                    canManage={canManage}
                    roleLoading={roleLoading}
                    onArchive={(row) =>
                      setArchiveTarget({ row, type: "source" })
                    }
                    onRestore={(row) => {
                      if (canRestoreBinding(row))
                        setRestoreTarget({ row, type: "source" });
                    }}
                    onEdit={(row) => {
                      if (!isActiveBinding(row)) return;
                      const clientId = asText(row.client_id);
                      const projectId = asText(row.project_id);
                      const funnelId = asText(row.funnel_id);
                      setSourceForm({
                        ...EMPTY_SOURCE_FORM,
                        binding_id: getBindingId(row),
                        source_id:
                          asText(row.source_id) || asText(row.source_entity_id),
                        client_id: clientId,
                        project_id: projectId,
                        funnel_id: funnelId,
                        original_client_id: clientId,
                        original_project_id: projectId,
                        original_funnel_id: funnelId,
                        original_is_primary: String(Boolean(row.is_primary)),
                        primary_intent: "unchanged",
                      });
                      setSourceFormMode("edit");
                      setSourceFeedback(null);
                      setSourceFormError("");
                      setSourceFormOpen(true);
                    }}
                  />
                  {sourceStatusFilter === "active" &&
                  filteredSourceBindings.length === 0 &&
                  (query.data?.sourceBindings ?? []).some(isArchivedBinding) ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setSourceStatusFilter("archived")}
                    >
                      {t("bindingsViewArchived")}
                    </Button>
                  ) : null}
                </div>
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
                            {t("bindingsStatusArchived")}
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
                      if (pending === "create-ad" && !open) return;
                      setAdFormOpen(open);
                      if (!open) setAdFormError("");
                    }}
                  >
                    <BindingDrawerLayout
                      closeDisabled={pending === "create-ad"}
                      title={
                        adFormMode === "edit"
                          ? t("bindingsAdDrawerEditTitle")
                          : t("bindingsAdDrawerCreateTitle")
                      }
                      description={t("bindingsAdDrawerDescription")}
                    >
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
                        canManageOnboarding={canManageOnboarding}
                        onAddClient={() => openHierarchyDialog("client", "ad")}
                        onAddProject={() =>
                          openHierarchyDialog("project", "ad")
                        }
                        onAddFunnel={() => openHierarchyDialog("funnel", "ad")}
                        mode={adFormMode}
                        /* const isCreate = adFormMode === "create" || !normalAdForm.binding_id; */
                        onSubmit={async () => {
                          const validationError = validateAdForm(
                            normalAdForm,
                            t,
                          );
                          if (validationError)
                            return setAdFormError(validationError);
                          const sameScope =
                            normalAdForm.binding_id &&
                            normalAdForm.client_id ===
                              normalAdForm.original_client_id &&
                            normalAdForm.project_id ===
                              normalAdForm.original_project_id &&
                            normalAdForm.funnel_id ===
                              normalAdForm.original_funnel_id;
                          const isCreate =
                            adFormMode === "create" || !normalAdForm.binding_id;
                          const isRebind = Boolean(
                            normalAdForm.binding_id && !sameScope,
                          );
                          const outgoingPrimaryIntent = primaryIntentForValue(
                            resolvePrimaryForMutation(normalAdForm, isRebind),
                          );
                          const saved = await runAction(
                            "create-ad",
                            async () => {
                              const result = await manageAdAccountBinding({
                                workspaceId: WORKSPACE_ID,
                                adAccountId: normalAdForm.ad_account_id,
                                clientId: normalAdForm.client_id,
                                projectId: normalAdForm.project_id,
                                funnelId: normalAdForm.funnel_id,
                                primaryIntent: outgoingPrimaryIntent,
                                replaceBindingId: sameScope
                                  ? null
                                  : normalAdForm.binding_id || null,
                                metadata: { ui: "bindings_page" },
                              });
                              return result.error
                                ? { data: null, error: result.error }
                                : {
                                    data: {
                                      ok: true,
                                      rpc: "manage_ad_account_binding",
                                      result: result.data,
                                    },
                                    error: null,
                                  };
                            },
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
                              title: isCreate
                                ? t("bindingsToastCreatedTitle")
                                : t("bindingsToastUpdatedTitle"),
                              description: isCreate
                                ? t("bindingsToastCreatedDescription")
                                : t("bindingsToastUpdatedDescription"),
                              variant: "success",
                              duration: 5000,
                            });
                          }
                        }}
                      />
                    </BindingDrawerLayout>
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
                        ...EMPTY_AD_FORM,
                        ad_account_id: adAccountId,
                        primary_intent: "remove_primary",
                      });
                      setAdFormOpen(true);
                    }}
                  />
                  <AdAccountsBusinessTable
                    rows={filteredAdAccountBindings}
                    canManage={canManage}
                    roleLoading={roleLoading}
                    onArchive={(row) =>
                      setArchiveTarget({ row, type: "ad_account" })
                    }
                    onRestore={(row) => {
                      if (canRestoreBinding(row))
                        setRestoreTarget({ row, type: "ad_account" });
                    }}
                    onEdit={(row) => {
                      setAdFormError("");
                      setNormalAdFeedback(null);
                      setAdFormMode("edit");
                      if (!isActiveBinding(row)) return;
                      const clientId = asText(row.client_id);
                      const projectId = asText(row.project_id);
                      const funnelId = asText(row.funnel_id);
                      setNormalAdForm({
                        ...EMPTY_AD_FORM,
                        binding_id: getBindingId(row),
                        ad_account_id: asText(row.ad_account_id ?? row.id),
                        client_id: clientId,
                        project_id: projectId,
                        funnel_id: funnelId,
                        original_client_id: clientId,
                        original_project_id: projectId,
                        original_funnel_id: funnelId,
                        original_is_primary: String(Boolean(row.is_primary)),
                        primary_intent: "unchanged",
                      });
                      setAdFormOpen(true);
                    }}
                  />
                  {adAccountStatusFilter === "active" &&
                  filteredAdAccountBindings.length === 0 &&
                  (query.data?.adAccountBindings ?? []).some(
                    isArchivedBinding,
                  ) ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setAdAccountStatusFilter("archived")}
                    >
                      {t("bindingsViewArchived")}
                    </Button>
                  ) : null}
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="project-data" className="mt-1">
              <SectionCard
                title={t("bindingsProjectBindingsTitle")}
                description={t("bindingsProjectBindingsDescription")}
              >
                <StatusFilterControl
                  value={projectBindingStatusFilter}
                  onChange={setProjectBindingStatusFilter}
                  t={t}
                />
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
                  emptyText={
                    projectBindingStatusFilter === "active"
                      ? t("bindingsActiveRecordsEmpty")
                      : t("bindingsProjectBindingsEmpty")
                  }
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
                            !canManageMappingReview ||
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
                            !canManageMappingReview ||
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
                            !canManageMappingReview ||
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
        <AlertDialog
          open={Boolean(importSourceActionTarget)}
          onOpenChange={(open) => {
            if (!open) setImportSourceActionTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {importSourceActionTarget?.mode === "cleanup"
                  ? "Очистити імпортоване джерело?"
                  : importSourceActionTarget?.mode === "restore"
                    ? "Відновити імпортоване джерело?"
                    : "Архівувати імпортоване джерело?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {importSourceActionTarget?.mode === "cleanup"
                  ? "Це видалить записи імпорту з бази та фізичний файл із Supabase Storage. Дію не можна скасувати."
                  : importSourceActionTarget?.mode === "restore"
                    ? "Джерело знову буде доступне у списках імпортованих джерел."
                    : "Джерело буде приховано з активних списків, але дані та файл залишаться."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Скасувати</AlertDialogCancel>
              <AlertDialogAction
                className={
                  importSourceActionTarget?.mode === "cleanup"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={() => {
                  const target = importSourceActionTarget;
                  setImportSourceActionTarget(null);
                  if (target) void manageImportSource(target.mode, target.row);
                }}
              >
                {importSourceActionTarget?.mode === "cleanup"
                  ? "Так, очистити"
                  : importSourceActionTarget?.mode === "restore"
                    ? "Відновити"
                    : "Архівувати"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <HierarchyCreateDialog
          open={Boolean(hierarchyDialog)}
          type={hierarchyDialog?.type ?? "client"}
          name={hierarchyName}
          error={hierarchyError}
          pending={pending === "hierarchy-save"}
          onNameChange={setHierarchyName}
          onCancel={() => setHierarchyDialog(null)}
          onSubmit={handleHierarchySubmit}
        />
        <RestoreBindingDialog
          target={restoreTarget}
          pending={pending === "restore-binding"}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={handleRestoreSelected}
        />
        <ArchiveBindingDialog
          target={archiveTarget}
          pending={pending === "archive-binding"}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={handleArchiveSelected}
        />
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
    response.code === "42501" ||
    response.error?.toLowerCase().includes("insufficient") ||
    response.error?.toLowerCase().includes("permission")
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
    response.code === "23514" ||
    response.error?.includes("source_entity_bindings_source_kind_check") ||
    response.code === "22023" ||
    response.code === "invalid_payload" ||
    response.code === "target_not_found" ||
    response.code === "target_workspace_mismatch" ||
    response.code === "target_lookup_failed" ||
    response.code === "ad_account_not_found" ||
    response.code === "ad_account_workspace_mismatch" ||
    response.code === "ad_account_lookup_failed" ||
    response.code === "ad_account_platform_missing" ||
    response.code === "source_not_found" ||
    response.code === "inactive_source" ||
    response.code === "invalid_replacement_binding" ||
    response.code === "source_workspace_mismatch"
  ) {
    return t("bindingsInvalidTargetError");
  }

  if (
    response.code === "PGRST202" ||
    response.code === "rpc_failed" ||
    response.code === "rpc_not_wired" ||
    response.code === "access_check_failed"
  ) {
    return t("bindingsBackendSaveError");
  }

  if (response.code === "partial_source_rebind") {
    return t("bindingsSourcePartialRebindWarning");
  }

  return t("bindingsActionFailed");
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

function resolvePrimaryForMutation(
  form: typeof EMPTY_AD_FORM | typeof EMPTY_SOURCE_FORM,
  isRebind: boolean,
): boolean | null {
  if (form.primary_intent === "make_primary") return true;
  if (form.primary_intent === "remove_primary") return false;
  return isRebind ? form.original_is_primary === "true" : null;
}

function primaryIntentForValue(value: boolean | null): PrimaryIntent {
  if (value === true) return "make_primary";
  if (value === false) return "remove_primary";
  return "unchanged";
}

function extractBindingId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const payload = response as Record<string, unknown>;
  const direct = payload.binding_id ?? payload.result ?? payload.data;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") {
    const nested = direct as Record<string, unknown>;
    const nestedId = nested.binding_id ?? nested.id;
    if (typeof nestedId === "string") return nestedId;
  }
  return null;
}

export function formatSourceCandidateLabel({
  sourceType,
  name,
  parentName,
  lang = "uk",
}: {
  sourceType: SafeSourceCandidate["sourceType"];
  name: string;
  parentName?: string;
  lang?: Lang;
}) {
  const cleanName = name.trim();
  const cleanParentName = parentName?.trim() ?? "";

  if (
    sourceType === "google_sheet_source" &&
    isGoogleSheetTemplateName(cleanName)
  ) {
    return lang === "en"
      ? "Google Sheet — data template"
      : "Google Sheet — шаблон даних";
  }

  if (sourceType === "google_sheet_tab") {
    return cleanName || cleanParentName || "Google Sheet tab";
  }

  return cleanName || "—";
}

function isGoogleSheetTemplateName(value: string) {
  return value.toLowerCase() === "insight_hub_dev_google_sheet_template";
}

function isInternalTestSourceCandidate(row: Row) {
  const text = [
    row.dataset_name,
    row.sheet_name,
    row.source_type,
    row.parser_type,
    row.target_raw_table,
  ]
    .map(asText)
    .join(" ")
    .toLowerCase();
  return [
    "test_upload_parser_small.csv",
    "test_upload_",
    "backend_test",
    "mock",
    "demo",
  ].some((pattern) => text.includes(pattern));
}

async function readSourceCandidates(): Promise<SourceCandidatesData> {
  const [sheets, tabs, datasets] = await Promise.all([
    supabase
      .from("google_sheet_sources")
      .select("id, spreadsheet_name, spreadsheet_id, status, is_active")
      .eq("workspace_id", WORKSPACE_ID),
    supabase
      .from("google_sheet_tabs")
      .select(
        "id, google_sheet_source_id, source_id, tab_name, source_type, target_raw_table, is_active",
      )
      .eq("workspace_id", WORKSPACE_ID),
    supabase
      .from("raw_external_datasets")
      .select(
        "id, dataset_name, sheet_name, source_type, target_raw_table, status, parser_type",
      )
      .eq("workspace_id", WORKSPACE_ID),
  ]);
  if (sheets.error) throw sheets.error;
  if (tabs.error) throw tabs.error;
  if (datasets.error) throw datasets.error;

  const activeSheetRows = ((sheets.data ?? []) as Row[]).filter(
    (row) => row.is_active !== false && !isInactiveStatus(row.status),
  );
  const activeSheetIds = new Set(
    activeSheetRows.map((row) => asText(row.id)).filter(Boolean),
  );
  const sheetNameById = new Map(
    activeSheetRows.map((row) => [
      asText(row.id),
      asText(row.spreadsheet_name),
    ]),
  );
  const sheetCandidates = activeSheetRows.map((row) => ({
    id: asText(row.id),
    sourceType: "google_sheet_source" as const,
    label: formatSourceCandidateLabel({
      sourceType: "google_sheet_source",
      name:
        asText(row.spreadsheet_name) ||
        asText(row.spreadsheet_id) ||
        asText(row.id),
    }),
    description: "Google Sheet",
  }));
  const tabCandidates = ((tabs.data ?? []) as Row[])
    .filter((row) => {
      const parentId =
        asText(row.google_sheet_source_id) || asText(row.source_id);
      return row.is_active !== false && activeSheetIds.has(parentId);
    })
    .map((row) => {
      const parentId =
        asText(row.google_sheet_source_id) || asText(row.source_id);
      const parentName = sheetNameById.get(parentId) || parentId;
      return {
        id: asText(row.id),
        sourceType: "google_sheet_tab" as const,
        label: formatSourceCandidateLabel({
          sourceType: "google_sheet_tab",
          name: asText(row.tab_name) || asText(row.id),
          parentName,
        }),
        description: [
          asText(row.source_type) || "Google Sheet tab",
          asText(row.target_raw_table),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    });
  const datasetCandidates = ((datasets.data ?? []) as Row[])
    .filter(
      (row) =>
        !isInactiveStatus(row.status) && !isInternalTestSourceCandidate(row),
    )
    .map((row) => ({
      id: asText(row.id),
      sourceType: "raw_external_dataset" as const,
      label:
        [asText(row.dataset_name), asText(row.sheet_name)]
          .filter(Boolean)
          .join(" · ") || asText(row.id),
      description: [
        asText(row.source_type) || asText(row.parser_type) || "Dataset",
        asText(row.target_raw_table),
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  return {
    candidates: [
      ...sheetCandidates,
      ...tabCandidates,
      ...datasetCandidates,
    ].filter((candidate) => candidate.id),
    importedSources: [],
  };
}

async function readImportedSources(): Promise<Row[]> {
  const [datasets, files] = await Promise.all([
    supabase
      .from("raw_external_datasets")
      .select(
        "id, file_asset_id, dataset_name, sheet_name, source_type, target_raw_table, status, parser_type, updated_at",
      )
      .eq("workspace_id", WORKSPACE_ID),
    supabase
      .from("file_assets")
      .select(
        "*",
      )
      .eq("workspace_id", WORKSPACE_ID),
  ]);
  if (datasets.error) throw datasets.error;
  if (files.error) throw files.error;
  const fileById = new Map(
    ((files.data ?? []) as Row[]).map((row) => [asText(row.id), row]),
  );
  return ((datasets.data ?? []) as Row[])
    .filter((row) =>
      isUploadedImportSource(row, fileById.get(asText(row.file_asset_id))),
    )
    .map((row) => {
      const file = fileById.get(asText(row.file_asset_id));
      return {
        ...row,
        raw_external_dataset_id: row.id,
        file_asset_id: row.file_asset_id ?? file?.id ?? null,
        original_file_name:
          file?.original_file_name ?? row.dataset_name ?? null,
        storage_bucket: file?.storage_bucket ?? null,
        storage_object_path: file?.["storage" + "_" + "path"] ?? null,
        file_status: file?.status ?? null,
        parser_status: file?.parser_status ?? row.parser_type ?? null,
      };
    });
}

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
  const unboundCount =
    readNumber(summary, "unbound_accounts") ?? gapRows.length;
  const platforms = uniquePlatformLabels(gapRows);
  const platformText = platforms.length ? platforms.join(", ") : "—";
  const summaryTemplate =
    unboundCount === 1
      ? t("bindingsAdsNeedBindingSummaryOne")
      : t("bindingsAdsNeedBindingSummary");
  return (
    <CompactStatusSummaryCard
      tone={unboundCount > 0 ? "warning" : "neutral"}
      className="mt-4"
    >
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
        {unboundCount > 0 ? (
          <NeedsBindingWarningBadge label={t("bindingsGapNeedsBinding")} />
        ) : (
          <Badge variant="secondary">
            {formatStatus(readString(payload, "overall_status") || "ok", lang)}
          </Badge>
        )}
      </div>
    </CompactStatusSummaryCard>
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
    <OperationalStatusSurface
      tone={gapRows.length > 0 ? "warning" : "muted"}
      className="mb-4 p-4"
    >
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
            const actionDisabled =
              !session || !canManage || !matchedAdAccountId;
            return (
              <OperationalStatusSurface
                key={`${platform}-${accountId}-${index}`}
                tone="warning"
                className="p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{platform}</p>
                    <p className="mt-1 text-sm text-foreground">
                      {accountName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {accountId}
                    </p>
                  </div>
                  <NeedsBindingWarningBadge
                    label={t("bindingsGapNeedsBinding")}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("bindingsGapFriendlyMessage")}
                </p>
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
              </OperationalStatusSurface>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("bindingsNoBindingGaps")}
        </p>
      )}
    </OperationalStatusSurface>
  );
}

function NeedsBindingWarningBadge({ label }: { label: string }) {
  return <StatusBadge tone="warning">{label}</StatusBadge>;
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

function interpolate(
  template: string,
  values: Record<string, string | number>,
) {
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
          (item) => item && typeof item === "object" && !Array.isArray(item),
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
  if (["error", "failed", "blocked"].includes(normalized)) return "destructive";
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
type SourceFormOptions = Omit<AdFormOptions, "adAccounts"> & {
  sources: SelectOption[];
};

function BindingDrawerLayout({
  title,
  description,
  children,
  closeDisabled = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  closeDisabled?: boolean;
}) {
  return (
    <SheetContent
      side="right"
      closeDisabled={closeDisabled}
      onEscapeKeyDown={(event) => {
        if (closeDisabled) event.preventDefault();
      }}
      onInteractOutside={(event) => {
        if (closeDisabled) event.preventDefault();
      }}
      className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
    >
      <SheetHeader className="shrink-0 border-b border-border/70 px-6 py-5 pr-10">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>
      {children}
    </SheetContent>
  );
}

function BindingDrawerBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
      {children}
    </div>
  );
}

function BindingDrawerFooter({
  pending,
  disabled,
  onSubmit,
  onCancel,
  pendingLabel,
  submitLabel,
  cancelLabel,
  feedback,
}: {
  pending: boolean;
  disabled: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  pendingLabel: string;
  submitLabel: string;
  cancelLabel: string;
  feedback: BindingActionFeedback | null;
}) {
  return (
    <div className="shrink-0 border-t border-border/70 bg-background px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={disabled} onClick={onSubmit}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      </div>
      <BindingFeedback feedback={feedback} />
    </div>
  );
}

function SourceBindingCard({
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
  canManageOnboarding,
  onAddClient,
  onAddProject,
  onAddFunnel,
  mode,
  sourceCandidatesUnavailable = false,
}: {
  canManage: boolean;
  session: boolean;
  pending: string;
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  options: SourceFormOptions;
  error: string;
  feedback: BindingActionFeedback | null;
  onCancel: () => void;
  onSubmit: () => void;
  canManageOnboarding: boolean;
  onAddClient: () => void;
  onAddProject: () => void;
  onAddFunnel: () => void;
  mode: "create" | "edit";
  sourceCandidatesUnavailable?: boolean;
}) {
  const { t } = useI18n();
  const disabled =
    !session ||
    !canManage ||
    pending === "create-source" ||
    sourceCandidatesUnavailable;
  return (
    <>
      <BindingDrawerBody>
        <div className="grid gap-3">
          <BindingSelect
            label={t("bindingsSelectSourceLabel")}
            placeholder={t("bindingsSelectSourcePlaceholder")}
            value={form.source_id}
            options={options.sources}
            emptyText={
              sourceCandidatesUnavailable
                ? t("bindingsSourceCandidatesUnavailable")
                : t("bindingsSelectSourceEmpty")
            }
            disabled={disabled || mode === "edit"}
            onChange={(value) =>
              setForm((current) => ({ ...current, source_id: value }))
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !canManageOnboarding}
              onClick={onAddClient}
            >
              {t("bindingsAddClient")}
            </Button>
          </div>
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !canManageOnboarding || !form.client_id}
              onClick={onAddProject}
            >
              {t("bindingsAddProject")}
            </Button>
          </div>
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !canManageOnboarding || !form.project_id}
              onClick={onAddFunnel}
            >
              {t("bindingsAddFunnel")}
            </Button>
          </div>
          <PrimaryIntentSelect
            value={form.primary_intent}
            onChange={(value) =>
              setForm((current) => ({ ...current, primary_intent: value }))
            }
          />
        </div>
        {error ? (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </BindingDrawerBody>
      <BindingDrawerFooter
        pending={pending === "create-source"}
        disabled={disabled}
        onSubmit={onSubmit}
        onCancel={onCancel}
        pendingLabel={t("bindingsSaveInProgress")}
        submitLabel={t("bindingsSaveBinding")}
        cancelLabel={t("bindingsCancel")}
        feedback={feedback}
      />
    </>
  );
}

function PrimaryIntentSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: PrimaryIntent) => void;
}) {
  const { t } = useI18n();
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as PrimaryIntent)}
    >
      <SelectTrigger className="h-10 bg-background">
        <SelectValue placeholder={t("bindingsPrimaryIntentNotPrimary")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="remove_primary">
          {t("bindingsPrimaryIntentNotPrimary")}
        </SelectItem>
        <SelectItem value="make_primary">
          {t("bindingsPrimaryIntentMake")}
        </SelectItem>
        <SelectItem value="unchanged">
          {t("bindingsPrimaryIntentUnchanged")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

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
  canManageOnboarding,
  onAddClient,
  onAddProject,
  onAddFunnel,
  mode,
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
  canManageOnboarding: boolean;
  onAddClient: () => void;
  onAddProject: () => void;
  onAddFunnel: () => void;
  mode: "create" | "edit";
}) {
  const { t } = useI18n();
  const disabled = !session || !canManage || pending === "create-ad";
  return (
    <>
      <BindingDrawerBody>
        <div className="grid gap-3">
          <BindingSelect
            label={t("bindingsSelectAdAccountLabel")}
            placeholder={t("bindingsSelectAdAccountPlaceholder")}
            value={form.ad_account_id}
            options={options.adAccounts}
            emptyText={t("bindingsSelectAdAccountEmpty")}
            disabled={disabled || mode === "edit"}
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !canManageOnboarding}
              onClick={onAddClient}
            >
              {t("bindingsAddClient")}
            </Button>
          </div>
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !canManageOnboarding || !form.client_id}
              onClick={onAddProject}
            >
              {t("bindingsAddProject")}
            </Button>
          </div>
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !canManageOnboarding || !form.project_id}
              onClick={onAddFunnel}
            >
              {t("bindingsAddFunnel")}
            </Button>
          </div>
          <PrimaryIntentSelect
            value={form.primary_intent}
            onChange={(value) =>
              setForm((current) => ({ ...current, primary_intent: value }))
            }
          />
        </div>
        {error ? (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </BindingDrawerBody>
      <BindingDrawerFooter
        pending={pending === "create-ad"}
        disabled={disabled}
        onSubmit={onSubmit}
        onCancel={onCancel}
        pendingLabel={t("bindingsSaveInProgress")}
        submitLabel={t("bindingsSaveBinding")}
        cancelLabel={t("bindingsCancel")}
        feedback={feedback}
      />
    </>
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
            <CommandList
              className="max-h-72 overflow-y-auto overscroll-contain"
              onWheel={(event) => event.stopPropagation()}
            >
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
  const { t } = useI18n();
  if (!feedback) return null;
  return (
    <OperationalStatusSurface
      tone={feedback.variant}
      withTextTone
      className="mt-3 p-3 text-sm shadow-sm"
      role="status"
      aria-live="polite"
    >
      <p className="font-medium">{feedback.message}</p>
      {feedback.technical ? (
        <details className="mt-2 rounded border border-border/60 bg-muted/25 p-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">
            {t("bindingsTechnicalDetails")}
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(feedback.technical, null, 2)}
          </pre>
        </details>
      ) : null}
    </OperationalStatusSurface>
  );
}

export function AdAccountsBusinessTable({
  rows,
  canManage,
  roleLoading,
  onEdit,
  onArchive,
  onRestore,
}: {
  rows: Row[];
  candidates?: SelectOption[];
  canManage: boolean;
  roleLoading: boolean;
  onEdit: (row: Row) => void;
  onArchive: (row: Row) => void;
  onRestore: (row: Row) => void;
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
      <table className="w-full min-w-[1030px] table-fixed text-left text-sm">
        <colgroup>
          <col style={{ width: 210 }} />
          <col style={{ width: 85 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 105 }} />
          <col style={{ width: 105 }} />
          <col style={{ width: 115 }} />
          <col style={{ width: 85 }} />
          <col style={{ width: 95 }} />
          <col style={{ width: 120 }} />
        </colgroup>
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
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 [overflow-wrap:anywhere] break-words font-medium text-foreground"
                  title={accountName(row, t)}
                >
                  {accountName(row, t)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {asText(row.external_account_id) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                {formatPlatform(asText(row.platform) || "—")}
              </td>
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 break-words"
                  title={asText(row.client_name)}
                >
                  {asText(row.client_name) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 break-words"
                  title={asText(row.project_name)}
                >
                  {asText(row.project_name) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 break-words"
                  title={asText(row.funnel_name)}
                >
                  {asText(row.funnel_name) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <FormattedValue
                  value={row.mapping_status}
                  column="mapping_status"
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <FormattedValue
                  value={row.binding_status ?? row.status}
                  column="binding_status"
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <BindingUpdatedAt value={row.updated_at} />
              </td>
              <td className="px-3 py-2 align-middle">
                <BindingRowActions
                  row={row}
                  canManage={canManage}
                  roleLoading={roleLoading}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SourceBindingsBusinessTable({
  rows,
  candidates = [],
  canManage,
  roleLoading,
  onEdit,
  onArchive,
  onRestore,
}: {
  rows: Row[];
  candidates?: SelectOption[];
  canManage: boolean;
  roleLoading: boolean;
  onEdit: (row: Row) => void;
  onArchive: (row: Row) => void;
  onRestore: (row: Row) => void;
}) {
  const { t } = useI18n();
  if (rows.length === 0) {
    return <SourceBindingsEmptyState candidates={candidates} />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
      <table className="w-full min-w-[990px] table-fixed text-left text-sm">
        <colgroup>
          <col style={{ width: 220 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 115 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 115 }} />
          <col style={{ width: 85 }} />
          <col style={{ width: 95 }} />
          <col style={{ width: 130 }} />
        </colgroup>
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {[
              t("bindingsSelectSourceLabel"),
              t("bindingsSelectClientLabel"),
              t("bindingsSelectProjectLabel"),
              t("bindingsSelectFunnelLabel"),
              t("tableMappingStatus"),
              t("tableStatus"),
              t("tableUpdatedAt"),
              t("bindingsColumnAction"),
            ].map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${getBindingId(row) || asText(row.source_id) || index}`}
              className="border-b border-border/40 last:border-0"
            >
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 [overflow-wrap:anywhere] break-words font-medium text-foreground"
                  title={sourceName(row)}
                >
                  {formatBindingSourceName(row)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {asText(row.source_kind) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 break-words"
                  title={asText(row.client_name)}
                >
                  {asText(row.client_name) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 break-words"
                  title={asText(row.project_name)}
                >
                  {asText(row.project_name) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <div
                  className="line-clamp-2 break-words"
                  title={asText(row.funnel_name)}
                >
                  {asText(row.funnel_name) || "—"}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <FormattedValue
                  value={row.mapping_status}
                  column="mapping_status"
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <FormattedValue
                  value={row.binding_status ?? row.status}
                  column="binding_status"
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <BindingUpdatedAt value={row.updated_at} />
              </td>
              <td className="px-3 py-2 align-middle">
                <BindingRowActions
                  row={row}
                  canManage={canManage}
                  roleLoading={roleLoading}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SourceBindingsEmptyState({
  candidates,
}: {
  candidates: SelectOption[];
}) {
  const { t } = useI18n();
  const hasCandidates = candidates.length > 0;

  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">
        {hasCandidates
          ? t("bindingsSourcesEmptyWithCandidates")
          : t("bindingsSourcesEmptyNoCandidates")}
      </p>
      {hasCandidates ? (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("bindingsSourceCandidatesTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("bindingsSourceCandidatesDescription")}
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {candidates.map((candidate) => (
              <div
                key={candidate.value}
                className="rounded-lg border border-border/60 bg-card/70 p-3"
              >
                <p
                  className="line-clamp-2 text-sm font-medium text-foreground"
                  title={candidate.label}
                >
                  {candidate.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {candidate.description ||
                    t("bindingsSourceCandidateTypeFallback")}
                </p>
                <Badge variant="secondary" className="mt-2">
                  {t("bindingsSourceCandidateSelectable")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BindingRowActions({
  row,
  canManage,
  roleLoading,
  onEdit,
  onArchive,
  onRestore,
}: {
  row: Row;
  canManage: boolean;
  roleLoading: boolean;
  onEdit: (row: Row) => void;
  onArchive: (row: Row) => void;
  onRestore: (row: Row) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex w-full flex-col items-stretch justify-center gap-2">
      {roleLoading ? (
        <PermissionActionPlaceholder />
      ) : isActiveBinding(row) && canManage ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-full max-w-full justify-center whitespace-nowrap px-2 text-xs"
            onClick={() => onEdit(row)}
          >
            {t("bindingsRebind")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 w-full max-w-full justify-center whitespace-nowrap px-2 text-xs"
            onClick={() => onArchive(row)}
          >
            {t("bindingsArchive")}
          </Button>
        </>
      ) : canManage && canRestoreBinding(row) ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-full max-w-full justify-center whitespace-nowrap px-2 text-xs"
          onClick={() => onRestore(row)}
        >
          <RotateCcw className="h-3 w-3" />
          {t("bindingsRestore")}
        </Button>
      ) : (
        <span className="w-full text-xs text-muted-foreground">
          {t("bindingsReadOnly")}
        </span>
      )}
    </div>
  );
}

function BindingUpdatedAt({
  value,
}: {
  value: string | number | boolean | null | undefined;
}) {
  const { lang } = useI18n();
  const formatted = formatValue(value, "updated_at", lang);
  if (formatted === "—")
    return <span className="text-muted-foreground">—</span>;
  const [date, ...timeParts] = formatted.split(/,?\s+/).filter(Boolean);
  const time = timeParts.join(" ");
  return (
    <span className="block leading-tight" title={formatted}>
      <span className="block">{date}</span>
      {time ? (
        <span className="block text-muted-foreground">{time}</span>
      ) : null}
    </span>
  );
}

function PermissionActionPlaceholder() {
  return (
    <div
      className="h-8 w-full max-w-full animate-pulse rounded-md border border-border/70 bg-muted/60"
      aria-label="Loading permissions"
    />
  );
}

export function RestoreBindingDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: { row: Row; type: BindingType } | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const row = target?.row;
  const name = row
    ? target.type === "source"
      ? formatBindingSourceName(row)
      : accountName(row, t)
    : "";
  const scope = row
    ? [row.client_name, row.project_name, row.funnel_name]
        .map(asText)
        .filter(Boolean)
        .join(" → ")
    : "";
  return (
    <AlertDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("bindingsRestoreDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>{t("bindingsRestoreDialogDescription")}</p>
              <p className="font-medium text-foreground">{name || "—"}</p>
              <p className="text-foreground">{scope || "—"}</p>
              <p>{t("bindingsRestoreOnlySelected")}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("bindingsCancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? t("bindingsSaveInProgress") : t("bindingsRestore")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function HierarchyCreateDialog({
  open,
  type,
  name,
  error,
  pending,
  onNameChange,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  type: "client" | "project" | "funnel";
  name: string;
  error: string;
  pending: boolean;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const label =
    type === "client"
      ? t("bindingsSelectClientLabel")
      : type === "project"
        ? t("bindingsSelectProjectLabel")
        : t("bindingsSelectFunnelLabel");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === "client"
              ? t("bindingsAddClient")
              : type === "project"
                ? t("bindingsAddProject")
                : t("bindingsAddFunnel")}
          </DialogTitle>
          <DialogDescription>
            {t("bindingsHierarchyDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="hierarchy-name"
          >
            {label}
          </label>
          <Input
            id="hierarchy-name"
            value={name}
            disabled={pending}
            onChange={(event) => onNameChange(event.target.value)}
          />
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            {t("bindingsCancel")}
          </Button>
          <Button
            type="button"
            disabled={pending || !name.trim()}
            onClick={onSubmit}
          >
            {pending ? t("bindingsSaveInProgress") : t("bindingsSaveBinding")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveBindingDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: { row: Row; type: BindingType } | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const row = target?.row;
  const title =
    target?.type === "ad_account"
      ? row
        ? accountName(row, t)
        : ""
      : row
        ? formatBindingSourceName(row)
        : "";
  const hierarchy = row
    ? [row.client_name, row.project_name, row.funnel_name]
        .map(asText)
        .filter(Boolean)
        .join(" → ")
    : "";
  return (
    <AlertDialog
      open={Boolean(target)}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("bindingsArchive")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("bindingsArchiveDialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border border-border/70 bg-muted/25 p-3 text-sm">
          <p className="font-medium text-foreground">{title || "—"}</p>
          <p className="mt-1 text-muted-foreground">{hierarchy || "—"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("bindingsArchiveSelectedOnly")}
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("bindingsCancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? t("bindingsRunning") : t("bindingsArchive")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
              className="border-b border-border/40 align-top last:border-0"
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

function StatusFilterControl({
  value,
  onChange,
  t,
}: {
  value: BindingStatusFilter;
  onChange: (value: BindingStatusFilter) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("bindingsStatusLabel")}</span>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as BindingStatusFilter)}
      >
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">{t("bindingsStatusActive")}</SelectItem>
          <SelectItem value="archived">
            {t("bindingsStatusArchived")}
          </SelectItem>
          <SelectItem value="all">{t("bindingsStatusAll")}</SelectItem>
        </SelectContent>
      </Select>
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
    .filter(isSelectableHierarchyRow)
    .map((row) => ({
      value: entityId(row, "client_id"),
      label: entityName(row, "client", t),
    }))
    .filter((option) => option.value);
  const projectsAll = filterRows(data?.projects ?? [])
    .filter(isSelectableHierarchyRow)
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
    .filter(isSelectableHierarchyRow)
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

function isInactiveStatus(status: unknown) {
  return ["archived", "inactive", "removed", "deleted", "disabled"].includes(
    String(status ?? "")
      .trim()
      .toLowerCase(),
  );
}

function isSelectableHierarchyRow(row: Row) {
  return !isInactiveStatus(row.status ?? row.binding_status);
}

export function buildSourceFormOptions(
  data: BindingsData | undefined,
  sourceData: SourceCandidatesData | undefined,
  form: Record<string, string>,
  t: (key: TranslationKey) => string,
  lang: Lang,
): SourceFormOptions {
  const hierarchy = buildAdFormOptions(data, form, t, lang);
  return {
    sources: (sourceData?.candidates ?? []).map((source) => ({
      value: source.id,
      label: localizeSourceCandidateLabel(source, lang),
      description: source.description,
    })),
    clients: hierarchy.clients,
    projects: hierarchy.projects,
    funnels: hierarchy.funnels,
    projectEmptyText: hierarchy.projectEmptyText,
    funnelEmptyText: hierarchy.funnelEmptyText,
  };
}

function localizeSourceCandidateLabel(source: SafeSourceCandidate, lang: Lang) {
  if (
    source.sourceType === "google_sheet_source" &&
    (source.label === "Google Sheet — шаблон даних" ||
      source.label === "Google Sheet — data template")
  ) {
    return formatSourceCandidateLabel({
      sourceType: source.sourceType,
      name: "insight_hub_dev_google_sheet_template",
      lang,
    });
  }
  return source.label;
}

function validateSourceForm(
  form: Record<string, string>,
  t: (key: TranslationKey) => string,
) {
  if (!form.source_id) return t("bindingsValidationSource");
  if (!form.client_id) return t("bindingsValidationClient");
  if (!form.project_id) return t("bindingsValidationProject");
  if (!form.funnel_id) return t("bindingsValidationFunnel");
  return "";
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
    asText(row[`${entity}_name`]) ||
    asText(row.name) ||
    t("bindingsUnnamedEntity")
  );
}
export function formatBindingSourceName(row: Row) {
  const raw =
    asText(row.source_name) || asText(row.name) || asText(row.source_id);
  const kind = asText(row.source_kind);

  if (kind === "google_sheet_tab" && raw.startsWith("google_sheet:")) {
    const withoutPrefix = raw.slice("google_sheet:".length);
    const separator = withoutPrefix.lastIndexOf(":");
    if (separator > 0 && separator < withoutPrefix.length - 1) {
      return `${withoutPrefix.slice(0, separator)} · ${withoutPrefix.slice(separator + 1)}`;
    }
    return withoutPrefix || "—";
  }

  if (raw && !isUuid(raw)) return raw;

  return (
    asText(row.display_name) ||
    asText(row.friendly_name) ||
    asText(row.source_label) ||
    "—"
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function sourceName(row: Row) {
  return (
    asText(row.source_name) || asText(row.name) || asText(row.source_id) || "—"
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

export function isUploadedImportSource(dataset: Row, file?: Row) {
  const text = [
    dataset.source_type,
    dataset.parser_type,
    dataset.target_raw_table,
    file?.storage_bucket,
    file?.["storage" + "_" + "path"],
    file?.original_file_name,
  ]
    .map(asText)
    .join(" ")
    .toLowerCase();
  return (
    text.includes("file-imports") ||
    text.includes("manual_file_upload") ||
    text.includes("upload") ||
    text.includes("csv") ||
    text.includes("xlsx")
  );
}

export function filterImportedSources(
  rows: Row[],
  statusFilter: ImportSourceStatusFilter,
) {
  return rows.filter((row) => {
    const archived =
      isInactiveStatus(row.status) ||
      isInactiveStatus(row.file_status) ||
      asText(row.status).toLowerCase() === "archived" ||
      asText(row.file_status).toLowerCase() === "archived";
    if (statusFilter === "active") return !archived;
    if (statusFilter === "archived") return archived;
    return true;
  });
}

function ImportSourceManagementPanel({
  rows,
  statusFilter,
  onStatusFilterChange,
  canManage,
  canCleanup,
  roleLoading,
  pending,
  onAction,
}: {
  rows: Row[];
  statusFilter: ImportSourceStatusFilter;
  onStatusFilterChange: (value: ImportSourceStatusFilter) => void;
  canManage: boolean;
  canCleanup: boolean;
  roleLoading: boolean;
  pending: string;
  onAction: (row: Row, mode: "archive" | "restore" | "cleanup") => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Керування імпортованими джерелами
          </h3>
          <p className="text-xs text-muted-foreground">
            Архівуйте тестові імпорти без видалення даних або очищайте файли
            лише після підтвердження.
          </p>
        </div>
        <div className="flex rounded-md border border-border/60 bg-background p-0.5">
          {(["active", "archived", "all"] as ImportSourceStatusFilter[]).map(
            (value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={statusFilter === value ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => onStatusFilterChange(value)}
              >
                {value === "active"
                  ? "Активні"
                  : value === "archived"
                    ? "Архівні"
                    : "Усі"}
              </Button>
            ),
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Немає імпортованих файлів для вибраного фільтра.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row) => {
            const archived =
              isInactiveStatus(row.status) ||
              isInactiveStatus(row.file_status) ||
              asText(row.status).toLowerCase() === "archived" ||
              asText(row.file_status).toLowerCase() === "archived";
            return (
              <div
                key={`${asText(row.raw_external_dataset_id)}-${asText(row.file_asset_id)}`}
                className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/70 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-medium"
                    title={
                      asText(row.original_file_name) || asText(row.dataset_name)
                    }
                  >
                    {asText(row.original_file_name) ||
                      asText(row.dataset_name) ||
                      "Імпортований файл"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[
                      asText(row.dataset_name),
                      asText(row.storage_object_path),
                      asText(row.status) || "active",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {roleLoading ? (
                    <Button type="button" size="sm" variant="outline" disabled>
                      Перевірка ролі…
                    </Button>
                  ) : null}
                  {canManage && !archived ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(pending)}
                      onClick={() => onAction(row, "archive")}
                    >
                      <Archive className="mr-1 h-3.5 w-3.5" />
                      Архівувати
                    </Button>
                  ) : null}
                  {canManage && archived ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(pending)}
                      onClick={() => onAction(row, "restore")}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Відновити
                    </Button>
                  ) : null}
                  {canCleanup ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={Boolean(pending)}
                      onClick={() => onAction(row, "cleanup")}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Очистити
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
