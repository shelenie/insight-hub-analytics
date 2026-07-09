export type AssistantContextLabelKey =
  | "assistantContextFullOverview"
  | "assistantContextAdsPerformance"
  | "assistantContextAdsAnomalies"
  | "assistantContextDataQuality"
  | "assistantContextImportStatus"
  | "assistantContextMappingReview"
  | "assistantContextAlerts"
  | "assistantContextClientsFunnels"
  | "assistantContextAdsHealth"
  | "assistantContextSystemReadiness";

export type ContextOption = {
  labelKey: AssistantContextLabelKey;
  requestType: string;
  contextScope: string;
};

export const OPTIONS = [
  {
    labelKey: "assistantContextAdsHealth",
    requestType: "ads_health_summary",
    contextScope: "ads_health",
  },
  {
    labelKey: "assistantContextAdsPerformance",
    requestType: "ads_performance_summary",
    contextScope: "ads_performance",
  },
  {
    labelKey: "assistantContextAdsAnomalies",
    requestType: "ads_anomaly_explanation",
    contextScope: "ads_anomalies",
  },
  {
    labelKey: "assistantContextFullOverview",
    requestType: "full_production_summary",
    contextScope: "full_production",
  },
  {
    labelKey: "assistantContextDataQuality",
    requestType: "data_quality_summary",
    contextScope: "data_quality",
  },
  {
    labelKey: "assistantContextImportStatus",
    requestType: "import_health_summary",
    contextScope: "import_health",
  },
  {
    labelKey: "assistantContextMappingReview",
    requestType: "mapping_review_summary",
    contextScope: "mapping_review",
  },
  {
    labelKey: "assistantContextAlerts",
    requestType: "operational_alerts_summary",
    contextScope: "operational_alerts",
  },
  {
    labelKey: "assistantContextClientsFunnels",
    requestType: "onboarding_summary",
    contextScope: "onboarding",
  },
  {
    labelKey: "assistantContextSystemReadiness",
    requestType: "production_readiness_summary",
    contextScope: "production_readiness",
  },
] as const satisfies readonly ContextOption[];

type SignalName =
  | "dataQualitySignal"
  | "importSignal"
  | "adsSignal"
  | "adsHealthSignal"
  | "performanceSignal"
  | "anomalySignal"
  | "metricSignal"
  | "timeWindowSignal"
  | "clientCommunicationSignal"
  | "mappingSignal"
  | "systemReadinessSignal";

type SignalMap = Record<SignalName, boolean>;

const matches = (text: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(text));
const normalizePrompt = (prompt: string) =>
  prompt.toLowerCase().replace(/[’']/g, "ʼ").trim();

export function isContinuationPrompt(prompt: string) {
  return matches(normalizePrompt(prompt), [
    /(^|\b)продовжи(\b|\s)/,
    /продовжи попередн(ю|ю свою)? відповідь/,
    /продовжи відповідь/,
    /(^|\b)continue(\b|\s|$)/,
    /continue previous/,
  ]);
}

export function resolveAssistantContextWithHistory(
  prompt: string,
  selectedOption: ContextOption,
  manualOverrideEnabled: boolean,
  previousAssistantOption?: ContextOption | null,
): ContextOption {
  if (!manualOverrideEnabled && isContinuationPrompt(prompt) && previousAssistantOption) {
    return previousAssistantOption;
  }
  return resolveAssistantContext(prompt, selectedOption, manualOverrideEnabled);
}

export function detectAssistantRoutingSignals(prompt: string): SignalMap {
  const text = normalizePrompt(prompt);

  const dataQualitySignal = matches(text, [
    /якіст(ь|ю) даних/,
    /проблем[аи]? (з )?якіст(ю|і) даних/,
    /проблем[аи]? даних/,
    /брудн[іи] дані/,
    /rejected rows?/,
    /\brejected\b/,
    /raw data/,
    /staging/,
    /processed data/,
    /data quality/,
    /quality issues?/,
    /import quality/,
  ]);

  const importSignal = matches(text, [
    /помил(к|ок|ки) імпорт/,
    /імпорт/,
    /import(s|ed|ing)?\b/,
    /csv\b/,
  ]);

  const adsSignal = matches(text, [
    /реклам/,
    /\bads?\b/,
    /кампан(і|іє|ій|ії|i|y|ies|s)/,
    /campaign(s)?\b/,
    /ad account(s)?\b/,
    /акаунт(и|ів|ам|ах)?/,
    /google ads|meta ads|facebook ads|tiktok ads/,
  ]);

  const adsHealthSignal = matches(text, [
    /свіж[іи]? рекламн[іи]? дан[іих]/,
    /немає даних по реклам/,
    /не синхронізуються рекламн[іи]? дан[іих]/,
    /рекламн[іи]? підключенн/,
    /рекламн[іи]? акаунт/,
    /акаунт(и)? треба привʼязати/,
    /привʼязк[аи] акаунт/,
    /google ads не дає дан[іих]/,
    /прав[ао] доступу/,
    /відмов[аі] в доступі/,
    /live api/,
    /sync|синхрон/,
    /access|permission/,
    /binding(s)?\b|привʼяз/,
    /readiness|source readiness|готовн/,
  ]);

  const performanceSignal = matches(text, [
    /потребують уваги/,
    /висок(ий|им|ого) cpl/,
    /поган(ий|ого) cpl/,
    /найкращ(ий|ого) cpl/,
    /зливаються витрати/,
    /найбільш[іиь]+ витрати/,
    /проаналізуй кампан/,
    /кампан(ії|ii|i).*(ефективн|уваг|cpl|витрат)/,
    /performance|ефективн/,
    /budget|бюджет/,
  ]);

  const anomalySignal = matches(text, [
    /просіл(о|и|а)/,
    /впал(о|и|а)|падінн/,
    /зросл[аои]?|виріс|виросл[аои]?/,
    /різко/,
    /аномал(і|i|y)/,
    /дивн(е|а|ий|о)/,
    /drop(ped)?\b|spike\b|outlier/,
  ]);

  const metricSignal = matches(text, [
    /\bcpl\b|cac|ltv|roas/,
    /витрат|лід(и|ів|ам)?|leads?|spend|clicks?|клік/,
    /конверс|conversion|ctr|cpc|cpm/,
  ]);

  const timeWindowSignal = matches(text, [
    /останні?\s+\d+\s+дн/,
    /за останн(і|ій) (тиждень|місяць|\d+ дн)/,
    /last\s+\d+\s+days?/,
    /last week|this week|weekly|тиждень/,
    /сьогодні|вчора|поточн/,
  ]);

  const clientCommunicationSignal = matches(text, [
    /що сказати клієнту/,
    /поясни клієнту/,
    /client update|client-ready/,
    /send to client|message to client/,
    /для клієнта/,
    /як сформулювати/,
  ]);
  const mappingSignal = matches(text, [
    /mapping|мапінг|пол(я|е)|fields?/,
    /звʼязк[иів]/,
  ]);
  const systemReadinessSignal = matches(text, [
    /system readiness|production readiness|готовність системи|операційн[аої] готовн/,
  ]);

  return {
    dataQualitySignal,
    importSignal,
    adsSignal,
    adsHealthSignal,
    performanceSignal,
    anomalySignal,
    metricSignal,
    timeWindowSignal,
    clientCommunicationSignal,
    mappingSignal,
    systemReadinessSignal,
  };
}

export function resolveAssistantContext(
  prompt: string,
  selectedOption: ContextOption,
  manualOverrideEnabled: boolean,
): ContextOption {
  if (manualOverrideEnabled) return selectedOption;
  const signals = detectAssistantRoutingSignals(prompt);
  const option = (labelKey: ContextOption["labelKey"]) =>
    OPTIONS.find((item) => item.labelKey === labelKey) ?? selectedOption;
  const knownAssistantPromptSignal =
    signals.performanceSignal || signals.clientCommunicationSignal;

  if (signals.dataQualitySignal || signals.importSignal)
    return option("assistantContextDataQuality");
  if (signals.adsHealthSignal) return option("assistantContextAdsHealth");
  if (
    signals.anomalySignal &&
    (signals.adsSignal ||
      signals.metricSignal ||
      signals.timeWindowSignal ||
      knownAssistantPromptSignal)
  ) {
    return option("assistantContextAdsAnomalies");
  }
  if (
    (signals.adsSignal &&
      (signals.performanceSignal || signals.metricSignal)) ||
    (signals.performanceSignal && signals.metricSignal)
  ) {
    return option("assistantContextAdsPerformance");
  }
  if (signals.mappingSignal) return option("assistantContextMappingReview");
  if (signals.systemReadinessSignal)
    return option("assistantContextSystemReadiness");
  return selectedOption;
}
