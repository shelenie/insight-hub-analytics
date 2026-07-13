import type { TranslationKey } from "@/i18n/translations";

export function getFriendlyRestoreErrorMessage(message: string | undefined, t: (key: TranslationKey) => string) {
  const normalized = String(message ?? "").toLowerCase();
  if (normalized.includes("permission") || normalized.includes("source_manager") || normalized.includes("insufficient")) return t("bindingsRestorePermissionError");
  if (normalized.includes("duplicate")) return t("bindingsRestoreDuplicateError");
  if (normalized.includes("only archived") || normalized.includes("not archived")) return t("bindingsRestoreNotArchivedError");
  if (normalized.includes("client")) return t("bindingsRestoreInactiveClientError");
  if (normalized.includes("project")) return t("bindingsRestoreInactiveProjectError");
  if (normalized.includes("funnel")) return t("bindingsRestoreInactiveFunnelError");
  if (normalized.includes("ad account")) return t("bindingsRestoreInactiveAdAccountError");
  if (normalized.includes("sheet tab") || normalized.includes("parent sheet") || normalized.includes("source") || normalized.includes("dataset")) return t("bindingsRestoreInactiveSourceError");
  return t("bindingsRestoreFalseError");
}
