import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260711_harden_data_binding_mutation_rpcs.sql"),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").toLowerCase();

const liveSignatures = [
  "archive_binding(uuid, text, uuid, jsonb)",
  "update_binding_mapping_status(uuid, text, uuid, text, text, uuid, text, text, jsonb)",
  "upsert_client(uuid, text, text, text, text, text, text, text, text, text, uuid, text, jsonb)",
  "upsert_project(uuid, uuid, text, text, text, text, text, text, text, text, text, text, uuid, text, jsonb)",
  "upsert_funnel(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, uuid, text, jsonb)",
  "bind_source_entity_to_scope(uuid, text, text, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb)",
];

describe("data binding RPC hardening migration", () => {
  it("does not include production data backfills, binding deletes, or destructive table changes", () => {
    expect(normalized).toContain("does not backfill");
    expect(normalized).not.toContain("delete from public.ad_account_bindings");
    expect(normalized).not.toContain("delete from public.source_entity_bindings");
    expect(normalized).not.toContain("truncate table");
    expect(normalized).not.toContain("drop table");
  });

  it("does not reference the non-existent workspaces.status column", () => {
    const guard = normalized.slice(
      normalized.indexOf("create or replace function public.require_source_manager"),
      normalized.indexOf("create or replace function public.manage_ad_account_binding"),
    );
    expect(guard).toContain("from public.workspaces w where w.id = p_workspace_id");
    expect(guard).not.toContain("status");
    expect(guard).toContain("public.can_manage_sources(p_workspace_id, v_actor_id)");
    expect(guard).toContain("auth.uid()");
    expect(guard).toContain("if v_role = 'service_role' then");
  });

  it("replaces and grants the exact verified live sensitive RPC signatures", () => {
    for (const signature of liveSignatures) {
      const functionName = signature.slice(0, signature.indexOf("("));
      expect(normalized).toContain(`create or replace function public.${functionName}(`);
      expect(normalized).toContain(`grant execute on function public.${signature} to authenticated, service_role`);
    }

    expect(normalized).not.toContain("grant execute on function public.archive_binding(uuid, text, uuid) to authenticated");
    expect(normalized).not.toContain("grant execute on function public.update_binding_mapping_status(uuid, text, uuid, text, text) to authenticated");
    expect(normalized).not.toContain("grant execute on function public.upsert_client(uuid, uuid, text, text, text, jsonb) to authenticated");
    expect(normalized).not.toContain("grant execute on function public.upsert_project(uuid, uuid, uuid, text, text, text, jsonb) to authenticated");
    expect(normalized).not.toContain("grant execute on function public.upsert_funnel(uuid, uuid, uuid, text, text, text, jsonb) to authenticated");
  });

  it("revokes PUBLIC/anon from every sensitive overload and fails if any remains exposed", () => {
    expect(normalized).toContain("p.proname in ('archive_binding', 'bind_source_entity_to_scope', 'update_binding_mapping_status', 'upsert_client', 'upsert_project', 'upsert_funnel', 'manage_ad_account_binding', 'bind_ad_account_to_scope')");
    expect(normalized).toContain("revoke execute on function %s from public, anon");
    expect(normalized).toContain("has_function_privilege('public', p.oid, 'execute')");
    expect(normalized).toContain("has_function_privilege('anon', p.oid, 'execute')");
    expect(normalized).toContain("sensitive mutation rpc overload remains executable by public or anon");
  });

  it("keeps legacy bind_ad_account_to_scope service-role only", () => {
    expect(normalized).toContain("revoke execute on function public.bind_ad_account_to_scope");
    expect(normalized).toContain("from public, anon, authenticated");
    expect(normalized).toContain("grant execute on function public.bind_ad_account_to_scope");
    expect(normalized).toContain("to service_role");
  });

  it("uses the actual mapping_review_actions schema and preserves audit details", () => {
    expect(normalized).toContain("insert into public.mapping_review_actions");
    expect(normalized).toContain("action_type");
    expect(normalized).toContain("previous_mapping_status");
    expect(normalized).toContain("new_mapping_status");
    expect(normalized).toContain("actor_user_id");
    expect(normalized).toContain("actor_email");
    expect(normalized).toContain("actor_role");
    expect(normalized).toContain("when 'confirmed' then 'approved'");
    expect(normalized).toContain("when 'pending_review' then 'marked_pending_review'");
    expect(normalized).not.toContain("action_note");
    const auditInsert = normalized.slice(
      normalized.indexOf("insert into public.mapping_review_actions"),
      normalized.indexOf("return true;", normalized.indexOf("insert into public.mapping_review_actions")),
    );
    expect(auditInsert).not.toContain(" action,");
    expect(auditInsert).not.toContain(" actor_id,");
  });


  it("matches verified live defaults for bind_source_entity_to_scope", () => {
    const bindFunction = normalized.slice(
      normalized.indexOf("create or replace function public.bind_source_entity_to_scope"),
      normalized.indexOf("language plpgsql", normalized.indexOf("create or replace function public.bind_source_entity_to_scope")),
    );

    expect(bindFunction).toContain("p_source_table text default null");
    expect(bindFunction).toContain("p_source_id uuid default null");
    expect(bindFunction).toContain("p_created_by uuid default null");
    expect(bindFunction).not.toContain("p_created_by uuid default auth.uid()");
    expect(bindFunction).toContain("returns uuid");
  });

  it("preserves exact live UUID return types for onboarding upsert RPCs", () => {
    const functionBlock = (name: string) => normalized.slice(
      normalized.indexOf(`create or replace function public.${name}(`),
      normalized.indexOf("language plpgsql", normalized.indexOf(`create or replace function public.${name}(`)),
    );

    for (const name of ["upsert_client", "upsert_project", "upsert_funnel"]) {
      const block = functionBlock(name);
      expect(block).toContain("returns uuid");
      expect(block).not.toContain("returns jsonb");
    }

    expect(normalized).toContain("return v_client.id");
    expect(normalized).toContain("return v_project.id");
    expect(normalized).toContain("return v_funnel.id");
    expect(normalized).not.toContain("return to_jsonb(v_client)");
    expect(normalized).not.toContain("return to_jsonb(v_project)");
    expect(normalized).not.toContain("return to_jsonb(v_funnel)");
  });

  it("preserves onboarding canonical fields and avoids incomplete funnel rows", () => {
    expect(normalized).toContain("name, client_name, client_code");
    expect(normalized).toContain("name = excluded.name");
    expect(normalized).toContain("client_name = excluded.client_name");
    expect(normalized).toContain("name, project_name, project_code");
    expect(normalized).toContain("project_name = excluded.project_name");
    expect(normalized).toContain("insert into public.funnels (workspace_id, client_id, project_id, funnel_name, name");
    expect(normalized).toContain("v_project.client_id");
    expect(normalized).toContain("funnel_name = excluded.funnel_name");
  });

  it("adds manage_ad_account_binding with safe DB-loaded account identity and validation", () => {
    const manageFunction = normalized.slice(
      normalized.indexOf("create or replace function public.manage_ad_account_binding"),
      normalized.indexOf("create or replace function public.archive_binding"),
    );
    expect(manageFunction).toContain("p_is_primary boolean default null");
    expect(manageFunction).toContain("from public.ad_accounts");
    expect(manageFunction).toContain("v_account.platform");
    expect(manageFunction).toContain("v_account.external_account_id");
    expect(manageFunction).toContain("v_mapping_status not in ('confirmed', 'pending_review', 'rejected')");
    expect(manageFunction).toContain("f.client_id = p_client_id");
    expect(manageFunction).not.toContain("p_platform");
    expect(manageFunction).not.toContain("p_external_account_id");
    expect(manageFunction).not.toContain("p_created_by uuid");
  });

  it("does not demote an existing primary binding on exact duplicate default calls", () => {
    const manageFunction = normalized.slice(
      normalized.indexOf("create or replace function public.manage_ad_account_binding"),
      normalized.indexOf("create or replace function public.archive_binding"),
    );
    expect(manageFunction).toContain("is_primary = case when p_is_primary is null then is_primary else p_is_primary end");
    expect(manageFunction).toContain("coalesce(p_is_primary, false)");
    expect(manageFunction).toContain("set is_primary = false");
  });

  it("archives only a selected active replacement binding transactionally and leaves unrelated scopes alone", () => {
    const manageFunction = normalized.slice(
      normalized.indexOf("create or replace function public.manage_ad_account_binding"),
      normalized.indexOf("create or replace function public.archive_binding"),
    );
    expect(manageFunction).toContain("p_replace_binding_id");
    expect(manageFunction).toContain("for update");
    expect(manageFunction).toContain("replacement binding must be active");
    expect(manageFunction).toContain("id = p_replace_binding_id");
    expect(manageFunction).toContain("and ad_account_id = p_ad_account_id");
    expect(manageFunction).toContain("binding_status = 'archived'");
    expect(manageFunction).toContain("client_id is not distinct from p_client_id");
    expect(manageFunction).toContain("project_id is not distinct from p_project_id");
    expect(manageFunction).toContain("funnel_id is not distinct from p_funnel_id");
  });

  it("derives actor identity from auth for authenticated calls while preserving service-role inputs", () => {
    expect(normalized).toContain("v_actor_id uuid := auth.uid()");
    expect(normalized).toContain("auth.jwt() ->> 'email'");
    expect(normalized).toContain("case when v_actor_id is null then p_created_by_email else");
    expect(normalized).toContain("coalesce(v_actor_id, p_created_by)");
    expect(normalized).toContain("case when v_actor_id is null then coalesce(p_actor_role, 'service_role') else public.get_workspace_role");
  });

  it("keeps member denied and admin/superadmin authorization delegated to can_manage_sources", () => {
    expect(normalized).toContain("public.can_manage_sources(p_workspace_id, v_actor_id)");
    expect(normalized).toContain("admin or superadmin role is required");
    expect(normalized).toContain("authentication required");
  });
});
