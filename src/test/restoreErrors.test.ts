import { getFriendlyRestoreErrorMessage } from "@/lib/restoreErrors";
import type { TranslationKey } from "@/i18n/translations";

const t = (key: TranslationKey) => key;

describe("restore error message precedence", () => {
  it("maps permissions before generic fallback", () => {
    expect(getFriendlyRestoreErrorMessage("Insufficient privileges for require_source_manager", t)).toBe("bindingsRestorePermissionError");
  });

  it("maps active duplicate before source/ad-account words", () => {
    expect(getFriendlyRestoreErrorMessage("Cannot restore: an active duplicate ad account binding already exists", t)).toBe("bindingsRestoreDuplicateError");
    expect(getFriendlyRestoreErrorMessage("Cannot restore: an active duplicate source binding already exists", t)).toBe("bindingsRestoreDuplicateError");
  });

  it("maps not-archived before source/ad-account words", () => {
    expect(getFriendlyRestoreErrorMessage("Only archived ad account bindings can be restored", t)).toBe("bindingsRestoreNotArchivedError");
    expect(getFriendlyRestoreErrorMessage("Only archived source bindings can be restored", t)).toBe("bindingsRestoreNotArchivedError");
  });

  it("maps parent and source inactive messages to friendly keys", () => {
    expect(getFriendlyRestoreErrorMessage("Cannot restore: Client is archived or inactive", t)).toBe("bindingsRestoreInactiveClientError");
    expect(getFriendlyRestoreErrorMessage("Cannot restore: Project is archived or inactive", t)).toBe("bindingsRestoreInactiveProjectError");
    expect(getFriendlyRestoreErrorMessage("Cannot restore: Funnel is archived or inactive", t)).toBe("bindingsRestoreInactiveFunnelError");
    expect(getFriendlyRestoreErrorMessage("Cannot restore: ad account is archived or inactive", t)).toBe("bindingsRestoreInactiveAdAccountError");
    expect(getFriendlyRestoreErrorMessage("Cannot restore: sheet tab or parent sheet is archived or inactive", t)).toBe("bindingsRestoreInactiveSourceError");
  });
});
