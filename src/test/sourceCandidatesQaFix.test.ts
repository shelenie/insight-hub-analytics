import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bindings = readFileSync(resolve(process.cwd(), "src/pages/Bindings.tsx"), "utf8");
const onboarding = readFileSync(resolve(process.cwd(), "src/pages/Onboarding.tsx"), "utf8");
const toastStyles = readFileSync(resolve(process.cwd(), "src/lib/toastStyles.ts"), "utf8");
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260713_fix_source_candidate_table_privileges.sql"),
  "utf8",
);

describe("post-deployment QA source candidates and onboarding toasts", () => {
  it("uses green success styling for all Onboarding success toasts", () => {
    expect(toastStyles).toContain("SUCCESS_TOAST_CLASSNAME");
    expect(toastStyles).toContain("border-emerald-500/50 bg-emerald-50 text-emerald-950 shadow-xl dark:bg-emerald-950 dark:text-emerald-50");
    expect(toastStyles).toContain("ACTION_TOAST_DURATION_MS = 5000");
    expect(onboarding.match(/className: SUCCESS_TOAST_CLASSNAME/g)).toHaveLength(3);
    expect(onboarding.match(/duration: ACTION_TOAST_DURATION_MS/g)).toHaveLength(6);
    expect(onboarding).toContain('t("onboardingClientSavedTitle")');
    expect(onboarding).toContain('t("onboardingProjectSavedTitle")');
    expect(onboarding).toContain('t("onboardingFunnelSavedTitle")');
  });

  it("keeps Onboarding error toasts destructive with explicit red styling", () => {
    expect(toastStyles).toContain("ERROR_TOAST_CLASSNAME");
    expect(toastStyles).toContain("border-red-500/50 bg-red-50 text-red-950 shadow-xl dark:bg-red-950 dark:text-red-50");
    expect(onboarding.match(/variant: "destructive", className: ERROR_TOAST_CLASSNAME/g)).toHaveLength(3);
    expect(onboarding).toContain('t("onboardingClientSaveError")');
    expect(onboarding).toContain('t("onboardingProjectSaveError")');
    expect(onboarding).toContain('t("onboardingFunnelSaveError")');
  });

  it("does not show the genuine-empty source message when source candidate query failed", () => {
    expect(bindings).toContain("sourceCandidatesUnavailable={Boolean(sourceCandidatesQuery.error)}");
    expect(bindings).toContain('emptyText={sourceCandidatesUnavailable ? t("bindingsSourceCandidatesUnavailable") : t("bindingsSelectSourceEmpty")}');
    expect(bindings).toContain("pending === \"create-source\" || sourceCandidatesUnavailable");
    expect(bindings).toContain("sourceCandidatesQuery.refetch()");
  });

  it("shows the genuine-empty source message only for a successful zero-result query", () => {
    expect(bindings).toContain('emptyText={sourceCandidatesUnavailable ? t("bindingsSourceCandidatesUnavailable") : t("bindingsSelectSourceEmpty")}');
    expect(bindings).toContain('t("bindingsSelectSourceEmpty")');
  });

  it("migration grants only SELECT to authenticated and revokes unnecessary privileges", () => {
    for (const table of ["google_sheet_sources", "google_sheet_tabs", "raw_external_datasets"]) {
      expect(migration).toContain(`REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.${table} FROM authenticated;`);
      expect(migration).toContain(`GRANT SELECT ON TABLE public.${table} TO authenticated;`);
      expect(migration).not.toContain(`GRANT INSERT ON TABLE public.${table}`);
      expect(migration).not.toContain(`GRANT UPDATE ON TABLE public.${table}`);
      expect(migration).not.toContain(`GRANT DELETE ON TABLE public.${table}`);
    }
    expect(migration).not.toMatch(/ TO anon\b/);
    expect(migration).not.toMatch(/disable row level security/i);
    expect(migration).not.toMatch(/drop policy|create policy|alter policy/i);
  });

  it("keeps existing source candidate inactive-parent filtering covered", () => {
    expect(bindings).toContain("const activeSheetIds = new Set");
    expect(bindings).toContain("row.is_active !== false && activeSheetIds.has(parentId)");
    expect(bindings).toContain("!isInactiveStatus(row.status)");
  });
});
