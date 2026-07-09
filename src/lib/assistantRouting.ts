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
  { labelKey: "assistantContextAdsHealth", requestType: "ads_health_summary", contextScope: "ads_health" },
  { labelKey: "assistantContextAdsPerformance", requestType: "ads_performance_summary", contextScope: "ads_performance" },
  { labelKey: "assistantContextAdsAnomalies", requestType: "ads_anomaly_explanation", contextScope: "ads_anomalies" },
  { labelKey: "assistantContextFullOverview", requestType: "full_production_summary", contextScope: "full_production" },
  { labelKey: "assistantContextDataQuality", requestType: "data_quality_summary", contextScope: "data_quality" },
  { labelKey: "assistantContextImportStatus", requestType: "import_health_summary", contextScope: "import_health" },
  { labelKey: "assistantContextMappingReview", requestType: "mapping_review_summary", contextScope: "mapping_review" },
  { labelKey: "assistantContextAlerts", requestType: "operational_alerts_summary", contextScope: "operational_alerts" },
  { labelKey: "assistantContextClientsFunnels", requestType: "onboarding_summary", contextScope: "onboarding" },
  { labelKey: "assistantContextSystemReadiness", requestType: "production_readiness_summary", contextScope: "production_readiness" },
] as const satisfies readonly ContextOption[];

export function resolveAssistantContext(prompt: string, selectedOption: ContextOption, manualOverrideEnabled: boolean): ContextOption {
  if (manualOverrideEnabled) return selectedOption;
  const normalized = prompt.toLowerCase();
  const hasAny = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(normalized));
  const option = (labelKey: ContextOption["labelKey"]) => OPTIONS.find((item) => item.labelKey === labelKey) ?? selectedOption;

  const isAds = hasAny([/реклама|рекламн|кампан|акаунт|акаунти|meta|facebook|google ads|tiktok|cpl|spend|витрати|кліки|ліди|свіжих даних|синхронізація|ads|campaigns?|ad account|fresh data|sync/]);
  const isFreshness = hasAny([/свіж|синхрон|немає|відсутн|missing|fresh data|sync|live api|готов|прив[ʼ'’]?яз|binding|readiness|account|акаунт|акаунти/]);
  const isPerformance = hasAny([/performance|ефективн|cpl|spend|витрати|budget|бюджет|leads?|ліди|clicks?|кліки|campaigns?|кампан/]);
  const isAnomaly = hasAny([/що просіло|просіло|просіли|падіння|впало|зросло|різко виросло|аномалі[яї]|аномал|drop|dropped|spike|outlier|anomaly|last 7 days drop|останні 7 днів просіло|виріс|зрос|дивне/]);
  const isImportQuality = hasAny([/якість даних|якістю даних|проблеми з якістю даних|проблеми даних|які дані погані|брудні дані|data quality|quality issues|rejected rows|rejected|raw data|import quality|помилки імпорту|імпорти|імпорт|import|csv/]);
  const isMapping = hasAny([/mapping|мапінг|пол[ея]|fields?|зв[ʼ'’]?язк/]) && !isAds;

  if (isImportQuality) return option("assistantContextDataQuality");
  if (isAnomaly) return option("assistantContextAdsAnomalies");
  if (isAds && isFreshness) return option("assistantContextAdsHealth");
  if (isAds && isPerformance) return option("assistantContextAdsPerformance");
  if (isMapping) return option("assistantContextMappingReview");
  return selectedOption;
}
