import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bindings = readFileSync(resolve(process.cwd(), "src/pages/Bindings.tsx"), "utf8");
const onboarding = readFileSync(resolve(process.cwd(), "src/pages/Onboarding.tsx"), "utf8");
const toastComponent = readFileSync(resolve(process.cwd(), "src/components/ui/toast.tsx"), "utf8");
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260713_fix_source_candidate_table_privileges.sql"),
  "utf8",
);

describe("post-deployment QA source candidates and onboarding toasts", () => {
  it("exposes semantic toast variants in the shared toast component", () => {
    for (const variant of ["default", "success", "error", "warning", "info", "destructive"]) {
      expect(toastComponent).toContain(`${variant}:`);
    }
    expect(toastComponent).toContain("border-emerald-500/50 bg-emerald-50");
    expect(toastComponent).toContain("dark:bg-emerald-950 dark:text-emerald-50");
    expect(toastComponent).toContain("border-red-500/50 bg-red-50");
    expect(toastComponent).toContain("dark:bg-red-950 dark:text-red-50");
    expect(toastComponent).toContain("border-amber-500/50 bg-amber-50");
    expect(toastComponent).toContain("dark:bg-amber-950 dark:text-amber-50");
    expect(toastComponent).toContain("border-sky-500/50 bg-sky-50");
    expect(toastComponent).toContain("dark:bg-sky-950 dark:text-sky-50");
  });

  it("uses success variants for all Onboarding success toasts", () => {
    expect(onboarding.match(/variant: "success"/g)).toHaveLength(3);
    expect(onboarding.match(/duration: 5000/g)).toHaveLength(6);
    expect(onboarding).toContain('t("onboardingClientSavedTitle")');
    expect(onboarding).toContain('t("onboardingProjectSavedTitle")');
    expect(onboarding).toContain('t("onboardingFunnelSavedTitle")');
    expect(onboarding).not.toContain("border-emerald-500/50 bg-emerald-50");
  });

  it("uses semantic error variants for Onboarding error toasts", () => {
    expect(onboarding.match(/variant: "error"/g)).toHaveLength(3);
    expect(onboarding).toContain('t("onboardingClientSaveError")');
    expect(onboarding).toContain('t("onboardingProjectSaveError")');
    expect(onboarding).toContain('t("onboardingFunnelSaveError")');
    expect(onboarding).not.toContain("border-red-500/50 bg-red-50");
    expect(onboarding).not.toContain('variant: "destructive"');
  });

  it("does not show the genuine-empty source message when source candidate query failed", () => {
    expect(bindings).toContain("sourceCandidatesUnavailable={Boolean(sourceCandidatesQuery.error)}");
    expect(bindings).toContain('emptyText={sourceCandidatesUnavailable ? t("bindingsSourceCandidatesUnavailable") : t("bindingsSelectSourceEmpty")}');
    expect(bindings).toContain("pending === \"create-source\" || sourceCandidatesUnavailable");
    expect(bindings).toContain("sourceCandidatesQuery.refetch()");
  });

  it("uses the shared warning semantic component for the source-candidate error panel", () => {
    const panelStart = bindings.indexOf("sourceCandidatesQuery.error && canManage");
    const panelEnd = bindings.indexOf("<SourceBindingsBusinessTable", panelStart);
    const panelSource = bindings.slice(panelStart, panelEnd);

    expect(panelSource).toContain('<OperationalStatusSurface tone="warning" withTextTone className="mb-3 flex flex-wrap items-center gap-2 p-3 text-xs">');
    expect(panelSource).toContain('t("bindingsSourceCandidatesUnavailable")');
    expect(panelSource).toContain("sourceCandidatesQuery.refetch()");
    expect(panelSource).not.toContain("border-amber-500/30");
    expect(panelSource).not.toContain("bg-amber-50/70");
    expect(panelSource).not.toContain("text-amber-950");
    expect(panelSource).not.toContain("dark:bg-amber-950/30");
    expect(panelSource).not.toContain("dark:text-amber-100");
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

  it("uses semantic toast and warning states in Bindings without local emerald toast classes", () => {
    expect(bindings).toContain('variant: "success"');
    expect(bindings).toContain('variant: "warning"');
    expect(bindings).toContain("source_rebind_partial");
    expect(bindings).not.toContain("SUCCESS_TOAST_CLASSNAME");
    expect(bindings).not.toContain("border-emerald-500/50 bg-emerald-50");
  });

  it("keeps existing source candidate inactive-parent filtering covered", () => {
    expect(bindings).toContain("const activeSheetIds = new Set");
    expect(bindings).toContain("row.is_active !== false && activeSheetIds.has(parentId)");
    expect(bindings).toContain("!isInactiveStatus(row.status)");
  });
});
