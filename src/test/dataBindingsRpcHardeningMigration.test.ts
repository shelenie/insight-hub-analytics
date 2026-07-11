import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260711_harden_data_binding_mutation_rpcs.sql"),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").toLowerCase();

const sensitiveFunctions = [
  "archive_binding(uuid, text, uuid)",
  "update_binding_mapping_status(uuid, text, uuid, text, text)",
  "upsert_client(uuid, uuid, text, text, text, jsonb)",
  "upsert_project(uuid, uuid, uuid, text, text, text, jsonb)",
  "upsert_funnel(uuid, uuid, uuid, text, text, text, jsonb)",
  "bind_source_entity_to_scope(uuid, text, text, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb)",
  "manage_ad_account_binding(uuid, uuid, uuid, uuid, uuid, text, boolean, text, uuid, jsonb)",
];

describe("data binding RPC hardening migration", () => {
  it("does not include production data backfills, deletes, or destructive binding changes", () => {
    expect(normalized).toContain("does not backfill");
    expect(normalized).not.toContain("delete from public.ad_account_bindings");
    expect(normalized).not.toContain("delete from public.source_entity_bindings");
    expect(normalized).not.toContain("truncate table");
    expect(normalized).not.toContain("drop table");
  });

  it("revokes PUBLIC and anon execution from all sensitive mutation RPC signatures", () => {
    for (const signature of sensitiveFunctions) {
      expect(normalized).toContain(`revoke execute on function public.${signature} from public, anon`);
    }
    expect(normalized).toContain("revoke execute on function public.bind_ad_account_to_scope");
    expect(normalized).toContain("from public, anon, authenticated");
  });

  it("grants authenticated only to RPCs that enforce in-function source manager authorization", () => {
    expect(normalized).toContain("create or replace function public.require_source_manager");
    expect(normalized).toContain("auth.uid()");
    expect(normalized).toContain("public.can_manage_sources(p_workspace_id, v_actor_id)");

    for (const signature of sensitiveFunctions) {
      expect(normalized).toContain(`grant execute on function public.${signature} to authenticated, service_role`);
    }
  });

  it("preserves service role access while bypassing user-session-only checks for backend jobs", () => {
    expect(normalized).toContain("if v_role = 'service_role' then");
    expect(normalized).toContain("return null;");
    expect(normalized).toContain("to service_role");
  });

  it("adds an authenticated manage_ad_account_binding RPC that loads account identity from the database", () => {
    expect(normalized).toContain("create or replace function public.manage_ad_account_binding");
    expect(normalized).toContain("from public.ad_accounts");
    expect(normalized).toContain("where id = p_ad_account_id and workspace_id = p_workspace_id");
    expect(normalized).toContain("v_account.platform");
    expect(normalized).toContain("v_account.external_account_id");
    expect(normalized).toContain("v_account.external_account_name");
    const manageFunction = normalized.slice(
      normalized.indexOf("create or replace function public.manage_ad_account_binding"),
      normalized.indexOf("create or replace function public.archive_binding"),
    );
    expect(manageFunction).not.toContain("p_platform");
    expect(manageFunction).not.toContain("p_external_account_id");
    expect(manageFunction).not.toContain("p_created_by uuid");
  });

  it("validates active account and hierarchy ownership before binding", () => {
    expect(normalized).toContain("inactive ad account cannot be bound");
    expect(normalized).toContain("from public.clients c");
    expect(normalized).toContain("from public.projects p");
    expect(normalized).toContain("p.client_id = p_client_id");
    expect(normalized).toContain("from public.funnels f");
    expect(normalized).toContain("f.project_id = p_project_id");
  });

  it("implements idempotent exact-scope upsert and transactional selected-binding replacement", () => {
    expect(normalized).toContain("p_replace_binding_id");
    expect(normalized).toContain("for update");
    expect(normalized).toContain("replacement binding not found");
    expect(normalized).toContain("binding_status = 'archived'");
    expect(normalized).toContain("id = p_replace_binding_id");
    expect(normalized).toContain("client_id is not distinct from p_client_id");
    expect(normalized).toContain("project_id is not distinct from p_project_id");
    expect(normalized).toContain("funnel_id is not distinct from p_funnel_id");
  });

  it("keeps multiple active scopes possible but unsets prior primary for the same account", () => {
    expect(normalized).toContain("where workspace_id = p_workspace_id and ad_account_id = p_ad_account_id");
    expect(normalized).toContain("set is_primary = false");
    expect(normalized).not.toContain("archive unrelated active bindings");
  });

  it("hardens archive and mapping review without removing audit writes", () => {
    expect(normalized).toContain("create or replace function public.archive_binding");
    expect(normalized).toContain("set binding_status = 'archived'");
    expect(normalized).toContain("return false");
    expect(normalized).toContain("create or replace function public.update_binding_mapping_status");
    expect(normalized).toContain("insert into public.mapping_review_actions");
    expect(normalized).not.toContain("delete from public.mapping_review_actions");
  });

  it("derives actor identity from the authenticated session instead of trusting caller input", () => {
    expect(normalized).toContain("v_actor_id uuid := auth.uid()");
    expect(normalized).toContain("auth.jwt() ->> 'email'");
    expect(normalized).toContain("p_created_by uuid default auth.uid()");
    expect(normalized).toContain("created_by, created_by_email");
    expect(normalized).toContain("v_actor_id, v_actor_email");
  });
});
