import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260704_make_ad_account_binding_idempotent.sql"),
  "utf8",
);

describe("ad account binding idempotency migration", () => {
  it("checks for duplicate active bindings before replacing the function", () => {
    const preflightStart = migration.indexOf("do $$");
    const dropStart = migration.indexOf("drop function if exists public.bind_ad_account_to_scope");
    const createStart = migration.indexOf("create function public.bind_ad_account_to_scope");

    expect(preflightStart).toBeGreaterThan(-1);
    expect(dropStart).toBeGreaterThan(preflightStart);
    expect(createStart).toBeGreaterThan(dropStart);
    expect(migration).toContain("Duplicate active ad_account_bindings exist");
    expect(migration).not.toContain("cascade");
    expect(migration).not.toContain("create or replace function public.bind_ad_account_to_scope");
  });

  it("updates and returns an existing active binding before inserting", () => {
    const updateStart = migration.indexOf("update public.ad_account_bindings");
    const insertStart = migration.indexOf("insert into public.ad_account_bindings");

    expect(updateStart).toBeGreaterThan(-1);
    expect(insertStart).toBeGreaterThan(updateStart);
    expect(migration).toContain("returning id into v_binding_id");
    expect(migration).toContain("if v_binding_id is not null then");
    expect(migration).toContain("return v_binding_id;");
  });

  it("uses the active natural key and preserves archived duplicates", () => {
    expect(migration).toContain("workspace_id = p_workspace_id");
    expect(migration).toContain("ad_account_id = p_ad_account_id");
    expect(migration).toContain("client_id is not distinct from p_client_id");
    expect(migration).toContain("project_id is not distinct from p_project_id");
    expect(migration).toContain("funnel_id is not distinct from p_funnel_id");
    expect(migration).toContain("binding_status = 'active'");
    expect(migration).not.toContain("'inactive'");
  });

  it("refreshes mutable fields without overwriting original creator columns", () => {
    const updateStatement = migration.slice(
      migration.indexOf("update public.ad_account_bindings"),
      migration.indexOf("if v_binding_id is not null then"),
    );

    expect(updateStatement).toContain("mapping_status = coalesce(p_mapping_status, mapping_status)");
    expect(updateStatement).toContain("binding_method = coalesce(p_binding_method, binding_method)");
    expect(updateStatement).toContain("confidence = coalesce(p_confidence, confidence)");
    expect(updateStatement).toContain("is_primary = coalesce(p_is_primary, is_primary)");
    expect(updateStatement).toContain("notes = coalesce(nullif(btrim(p_notes), ''), notes)");
    expect(updateStatement).toContain("when p_metadata is not null and p_metadata <> '{}'::jsonb then p_metadata");
    expect(updateStatement).toContain("else metadata");
    expect(updateStatement).toContain("updated_at = now()");
    expect(updateStatement).not.toContain("created_by =");
    expect(updateStatement).not.toContain("created_by_email =");
    expect(updateStatement).not.toContain("created_at =");
  });

  it("defaults optional update-only fields to null so repeated saves preserve existing values", () => {
    expect(migration).toContain("p_is_primary boolean default null");
    expect(migration).toContain("p_metadata jsonb default null");
    expect(migration).toContain("coalesce(p_is_primary, false)");
    expect(migration).toContain("coalesce(p_metadata, '{}'::jsonb)");
  });

  it("adds a partial unique guard for active rows only", () => {
    expect(migration).toContain("create unique index if not exists ad_account_bindings_one_active_per_scope_uidx");
    expect(migration).toContain("(workspace_id, ad_account_id, client_id, project_id, funnel_id) nulls not distinct");
    expect(migration).toContain("where binding_status = 'active'");
  });

  it("keeps function execution limited to the service role after replacement", () => {
    expect(migration).toContain("revoke execute on function public.bind_ad_account_to_scope");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.bind_ad_account_to_scope");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
