import { readFileSync } from "node:fs";

const bindings = readFileSync("src/pages/Bindings.tsx", "utf8");
const mutations = readFileSync("src/lib/dataBindingsMutations.ts", "utf8");
const sheet = readFileSync("src/components/ui/sheet.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260713_reactivate_binding_rpc.sql", "utf8");

describe("Data Bindings production UX fix", () => {
  it("uses a three-region binding drawer with footer outside the scrollable body", () => {
    expect(bindings).toContain("function BindingDrawerLayout");
    expect(bindings).toContain("function BindingDrawerBody");
    expect(bindings).toContain("function BindingDrawerFooter");
    expect(bindings).toContain('className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"');
    expect(bindings).toContain('className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"');
    expect(bindings).toContain('className="shrink-0 border-t border-border/70 bg-background px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4"');
    expect(bindings.indexOf("<BindingDrawerBody>")).toBeLessThan(bindings.indexOf("<BindingDrawerFooter"));
  });

  it("removes footer overlay positioning and the drawer body padding workaround", () => {
    const footer = bindings.slice(bindings.indexOf("function BindingDrawerFooter"), bindings.indexOf("function SourceBindingCard"));
    expect(footer).not.toContain("sticky");
    expect(footer).not.toContain("fixed");
    expect(footer).not.toContain("absolute");
    expect(footer).not.toContain("bottom-0");
    expect(bindings).not.toContain("pb-28");
  });

  it("keeps pending save state until refreshBindings finishes and closes drawer afterwards", () => {
    const save = bindings.slice(bindings.indexOf("const saveSourceBinding"), bindings.indexOf("const handleArchiveSelected"));
    expect(save).toContain("try {");
    expect(save).toContain("} finally {");
    expect(save.indexOf("await refreshBindings();")).toBeLessThan(save.indexOf("setSourceFormOpen(false)"));
    expect(save.indexOf("await refreshBindings();")).toBeLessThan(save.lastIndexOf("toast({"));
    expect(save.indexOf("setPending(\"\");")).toBeGreaterThan(save.indexOf("await refreshBindings();"));
    const action = bindings.slice(bindings.indexOf("const runAction"), bindings.indexOf("const refreshBindings"));
    expect(action.indexOf("await refreshBindings();")).toBeLessThan(action.indexOf("setPending(\"\")"));
  });

  it("uses create/update success copy correctly", () => {
    expect(bindings).toContain('title: isCreate ? t("bindingsToastCreatedTitle") : t("bindingsToastUpdatedTitle")');
    expect(bindings).toContain('t("bindingsToastCreatedTitle")');
    expect(bindings).toContain('t("bindingsToastUpdatedTitle")');
  });

  it("prevents accidental close and disables the X while saving", () => {
    expect(bindings).toContain('onEscapeKeyDown={(event) => { if (closeDisabled) event.preventDefault(); }}');
    expect(bindings).toContain('onInteractOutside={(event) => { if (closeDisabled) event.preventDefault(); }}');
    expect(sheet).toContain("closeDisabled?: boolean");
    expect(sheet).toContain("<SheetPrimitive.Close disabled={closeDisabled}");
  });

  it("uses desktop table-fixed layouts with safe wrapping for long source and account names", () => {
    expect(bindings).toContain("xl:overflow-x-visible");
    expect(bindings).toContain("table-fixed");
    expect(bindings).toContain("[overflow-wrap:anywhere] break-words font-medium");
    expect(bindings).toContain("title={sourceName(row)}");
    expect(bindings).toContain("title={accountName(row, t)}");
  });

  it("makes archive location and empty active archive CTA obvious", () => {
    expect(bindings).toContain('setSourceStatusFilter("archived")');
    expect(bindings).toContain('setAdAccountStatusFilter("archived")');
    expect(bindings).toContain('t("bindingsArchiveMovedDescription")');
    expect(bindings).toContain('t("bindingsViewArchived")');
    expect(bindings).toContain('t("bindingsStatusArchived")');
  });

  it("shows real restore actions for archived source and ad account rows", () => {
    expect(bindings).toContain("<RestoreBindingDialog");
    expect(bindings.match(/t\("bindingsRestore"\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(mutations).toContain("export async function reactivateBinding");
    expect(mutations).toContain('const rpc = "reactivate_binding"');
  });

  it("reactivate_binding restores existing rows and hardens grants/security", () => {
    expect(migration).toContain("create or replace function public.reactivate_binding");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("public.require_source_manager(p_workspace_id)");
    expect(migration).toContain("p_binding_type not in ('source', 'ad_account')");
    expect(migration).toContain("coalesce(v_source.binding_status::text, 'active') <> 'archived'");
    expect(migration).toContain("coalesce(v_ad.binding_status::text, 'active') <> 'archived'");
    expect(migration).toContain("Cannot restore: Client is archived or inactive");
    expect(migration).toContain("Cannot restore: Project is archived, inactive, or no longer belongs to Client");
    expect(migration).toContain("Cannot restore: Funnel is archived, inactive, or no longer belongs to Project/Client");
    expect(migration).toContain("Cannot restore: ad account is archived or inactive");
    expect(migration).toContain("google_sheet_source");
    expect(migration).toContain("google_sheet_tab");
    expect(migration).toContain("file_dataset");
    expect(migration).toContain("Cannot restore: an active duplicate binding already exists");
    expect(migration).toContain("reactivated_from_archive");
    expect(migration).toContain("revoke all on function public.reactivate_binding(uuid, text, uuid, jsonb) from public");
    expect(migration).toContain("revoke all on function public.reactivate_binding(uuid, text, uuid, jsonb) from anon");
    expect(migration).toContain("grant execute on function public.reactivate_binding(uuid, text, uuid, jsonb) to authenticated, service_role");
    expect(migration.toLowerCase()).not.toContain("delete from");
  });
});
