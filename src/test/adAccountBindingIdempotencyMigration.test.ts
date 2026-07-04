import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260704_make_ad_account_binding_idempotent.sql"),
  "utf8",
);

describe("ad account binding idempotency migration", () => {
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
    expect(updateStatement).toContain("updated_at = now()");
    expect(updateStatement).not.toContain("created_by =");
    expect(updateStatement).not.toContain("created_by_email =");
    expect(updateStatement).not.toContain("created_at =");
  });

  it("adds a partial unique guard for active rows only", () => {
    expect(migration).toContain("create unique index if not exists ad_account_bindings_one_active_per_scope_uidx");
    expect(migration).toContain("(workspace_id, ad_account_id, client_id, project_id, funnel_id) nulls not distinct");
    expect(migration).toContain("where binding_status = 'active'");
  });
});
