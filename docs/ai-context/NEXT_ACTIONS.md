# NEXT_ACTIONS.md

## Purpose

Current next actions for Internal Analytics Workspace.

---

2026-07-07 update: AI Assistant empty-state refinement is complete. The page now feels closer to a ChatGPT/Claude-style start screen with a lighter centered canvas, compact floating composer that expands only for longer input, tighter suggested prompt chips, and first-screen spacing designed to fit a normal laptop viewport. Response history remains hidden from the primary UI. No backend/RPC/RLS/schema/route/permission/Edge Function contract changes were made. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.


## Current Priority



2026-07-06 update: AI Assistant main screen simplification is complete. The page now presents one clean chat surface with a centered welcome state, suggested marketing prompt cards, a bottom composer, compact analysis mode selector, and one muted safety note. Response history is hidden from the primary UI until a proper chat/session history UX is designed. No backend/RPC/RLS/schema/route/permission/Edge Function contract changes were made. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.

2026-07-06 update: Final AI Assistant layout polish is complete. Chat is the primary surface, History is secondary/collapsed by default with at most three latest items shown when opened, the safety note is lighter near the welcome/composer, and analysis modes are marketing-oriented. No backend/RPC/RLS/schema/route/permission/Edge Function contract changes were made. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.

Continue verification of user management, Supabase security, and dashboard metric definitions before feature expansion.

2026-07-06 sidebar structure update: Overview has been moved from Analytics into Workspace in the frontend sidebar. Admin remains collapsible and auto-opens for active Admin routes. This PR intentionally makes no backend, route, permission, RLS, Supabase schema/object, or new-page changes. Users & Access remains deferred as a security-sensitive feature, and role-aware sidebar filtering should wait for a safe role/capability sidebar contract if needed.

2026-07-05 update: Data Bindings manual/admin UX copy has been clarified and the visible page/ad-account workflow text has been routed through existing Ukrainian/English i18n before AI-assisted mapping/autobinding work. Final copy polish aligned Overview, project bindings, mapping status, and technical-mode labels without changing backend behavior; next mapping/autobinding work should still define backend/RLS/RPC contracts before implementation.


2026-07-06 update: AI Assistant frontend polish is complete. The page is now a chat-style prepared-data assistant with suggested prompts, compact context selection, secondary response history, and hidden technical details. The assistant is explicitly read/explain-only and does not directly modify data. No backend, RPC, RLS, schema, route, Edge Function contract, or permission behavior changed. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.

---

2026-07-06 update: Telegram / Alerts UI was clarified before AI-assisted mapping/autobinding work. Copy, i18n, empty states, technical-details placement, and safe UI action visibility were polished without backend, RPC, RLS, Edge Function contract, or schema changes. Telegram remains the HITL confirmation surface for future mapping review flows.

2026-07-06 update: The sidebar admin/control-center group was clarified from Operations to Admin and made collapsible using the existing sidebar/collapsible UI pattern, with active admin routes auto-opening the group. No backend, RLS, permission, route, or page changes were made.


2026-07-06 audit update: Remaining frontend admin/control-center pages were inspected before backend AI-assisted mapping work. Frontend-ready as-is: Admin sidebar structure, Telegram / Alerts, Data Bindings / Mapping, and Overview as a high-level operational entry point. Needs frontend polish before backend mapping work: Onboarding should get bilingual i18n and friendlier admin copy around hierarchy/health/editing states; AI Assistant should use existing i18n, clearer safe-disabled/no-access/loading states, and less prominent debug details; Imports / Data Health may need small copy/empty-state polish only after reviewing live data-health wording in UX. Ads Connectors is safe to keep and mostly polished, but should not add fake Google/TikTok actions beyond verified OAuth/sync contracts. Users & Access must remain deferred: local/verified backend foundations include active-aware membership status, role/capability helpers, and permission/member views, but direct member view grants are revoked and invitation/action RPC/audit/bootstrap contracts are still missing. Do not add a Users & Access page until safe read RPC/view access and write RPC/audit/RLS contracts are verified.


2026-07-06 update: Onboarding frontend polish was completed before backend AI-assisted mapping work. Visible page copy now uses Ukrainian/English i18n, explains the client → project → funnel analytics hierarchy in admin-facing language, improves empty/loading/error/no-access states, and keeps technical IDs/details collapsed. Follow-up cleanup localized unexpected backend response fallback errors for onboarding saves. No backend, RPC, RLS, schema, route, Edge Function contract, or permission changes were made.

Recommended remaining PR order before backend AI-assisted mapping work:

1. AI Assistant frontend polish only: route visible copy through UK/EN i18n, clarify that it uses prepared/verified data, improve no-access/loading/error states, and keep existing `ai-helper-run` contract unchanged.
2. Imports / Data Health micro-polish if needed: refine labels/empty states for rejected rows, mapping review, alerts, and safe links to Data Bindings / Telegram / Ads Connectors without changing queries or actions.
3. Users & Access backend-contract PR: verify/create safe read model, invitations, member lifecycle action RPCs, audit events, first-superadmin/bootstrap rules, and deployed RLS before any management UI.
4. Users & Access frontend PR only after step 3: read-only member list first, then invite/deactivate/role-change UI only through verified backend contracts.

Future admin page: Users & Access / Користувачі й доступи. Purpose: invite users by email, assign workspace roles, deactivate access, and audit changes. Treat this as a separate security-sensitive admin feature that requires backend/RLS/RPC/audit contract verification before UI implementation.

## Task: Add Project Context Files

Priority: high
Status: completed from local repo inspection on 2026-06-25

2026-06-25 update: required context files are present and readable in the local repository.

Add:

```text
AGENTS.md
docs/ai-context/PROJECT_STATE.md
docs/ai-context/DECISIONS.md
docs/ai-context/NEXT_ACTIONS.md
docs/ai-context/CHANGELOG.md
docs/ai-context/CONTEXT_UPDATE_PROTOCOL.md
docs/ai-context/USER_MANAGEMENT.md
docs/ai-context/GLOSSARY.md
```

Acceptance criteria:

- files exist
- no secrets
- project stack is Codex + Supabase + GitHub
- client approval marked not final
- USER_MANAGEMENT included in routing

---

## Task: Inspect Current Repo State

Priority: high
Status: completed from local repo inspection on 2026-06-25

Codex should inspect:

- repo structure
- package manager
- frontend framework
- Supabase structure
- migrations
- RLS policies
- Edge Functions
- env examples
- dashboard pages
- auth/user logic
- build/test scripts

Then update `PROJECT_STATE.md`.

2026-06-25 update: local repo structure, frontend stack, Supabase folders, auth files, dashboard/import files, and package scripts were inspected and recorded in `PROJECT_STATE.md`. Remote Supabase production state and package-manager choice still need verification.

---

## Task: Verify Package Manager

Priority: medium
Status: upcoming

The repository contains both `package-lock.json` and `bun.lockb`.

Verify which package manager is canonical before changing dependencies or documenting install commands.

---

## Task: Verify Remote Supabase Contracts

Priority: high
Status: partially completed for Phase 1 user-access hardening on 2026-06-26; broader remote contract verification still upcoming

Compare local migrations/types with remote Supabase objects used by the frontend, especially views and RPCs referenced by dashboard/import pages.

Do not assume remote objects exist only because frontend code references them.


---

## Task: Verify and Define User Management Model

Priority: high
Status: Phase 1 backend/RLS hardening applied and verified on 2026-06-26

2026-06-26 update: Phase 1 active-membership backend/RLS hardening was merged, manually applied to remote Supabase, and verified.

Still needs definition/implementation in later phases:

- invitation model and flow
- `profiles` lifecycle details beyond the base model
- `audit_logs` schema and user-management audit coverage
- first superadmin setup/bootstrap contract
- user-management RPCs for invite, accept, revoke, deactivate, reactivate, remove, and role change

---


## Task: Verify Remote Supabase Schema and RLS for User Management

Priority: high
Status: partially completed for Phase 1 user-access hardening on 2026-06-26; broader remote contract verification still upcoming

Compare local repository expectations with remote Supabase objects for:

- `profiles`
- `workspace_members`
- any invitation table/model if present
- `audit_logs`
- access helper functions and RPCs
- permission views such as current-user permissions if present
- RLS policies affecting user access and workspace data
- deployed Edge Function configuration for user/workspace access

Acceptance criteria:

- actual table names, columns, constraints, and indexes are documented
- RLS policies are inventoried without weakening them
- inactive/removed/pending access behavior is confirmed or marked missing
- first superadmin setup is confirmed or marked missing
- no secrets are read or exposed

---

## Task: Deploy and Verify Phase 1 User Access Hardening

Priority: high
Status: completed on 2026-06-26

`supabase/migrations/20260626_phase1_active_membership_access_hardening.sql` was merged, manually applied to remote Supabase, and verified.

Verified:

- existing `workspace_members` rows are `active`
- central role/access helpers are active-only through `workspace_members.status = 'active'`
- direct `workspace_members` INSERT/UPDATE/DELETE policies are superadmin-only
- `enforce_workspace_member_management_rules` trigger exists for INSERT/UPDATE
- `prevent_last_active_superadmin_change` trigger exists for UPDATE/DELETE
- `set_workspace_members_updated_at` trigger exists for UPDATE
- `v_current_user_permissions` is active-aware and `security_invoker=true`
- `v_workspace_members_with_permissions` is active-aware and `security_invoker=true`
- `v_workspace_members_with_permissions` has no direct `SELECT` grant for `anon` or `authenticated`

Remaining follow-up:

- verify Edge Function access behavior for inactive/removed memberships when test users/fixtures are available
- define invitation/user-management RPC contract before UI work

---

## Task: Define Target Invitation / Status / User-Management Contract

Priority: high
Status: later / blocked by remote schema and RLS verification

Before any user-management UI implementation, define the approved target contract for:

- profile lifecycle
- workspace membership lifecycle
- invitation creation/acceptance/revocation
- allowed member statuses
- role assignment and role-change rules
- inactive/removed access denial
- first superadmin setup
- user-management audit events
- backend/RLS enforcement points

Do not add frontend user-management screens until backend/RLS access behavior is explicit and reviewable.

---

## Task: Verify Source Binding Idempotency

Priority: medium
Status: upcoming

Manual ad account binding idempotency is addressed locally by migration `20260704_make_ad_account_binding_idempotent.sql`. Local repository inspection did not find the existing `public.bind_source_entity_to_scope` SQL definition, so verify the deployed remote source-binding function and any source binding table constraints/indexes for the same duplicate-active-row risk.

Acceptance criteria:

- confirm the remote `public.bind_source_entity_to_scope` implementation
- confirm source binding natural key and active/archived status values
- add idempotent update-before-insert behavior and an active-only DB guard if the deployed source binding path has the same duplicate risk
- do not weaken RLS or delete production data


## Task: Define Dashboard Metrics

Priority: high
Status: upcoming

For each metric define:

- name
- business meaning
- source table/view/file
- source fields
- formula
- date logic
- filters
- exclusions
- limitations

Do not build UI before metric logic is clear.

---

## Task: Review Supabase Security State

Priority: high
Status: upcoming

Review:

- RLS
- anon/service role usage
- Edge Function auth
- storage policies
- role checks
- frontend env exposure

Do not weaken security.

---

## Ongoing Rule: Update Context After Meaningful Work

After meaningful work, update:

- PROJECT_STATE.md
- DECISIONS.md
- NEXT_ACTIONS.md
- CHANGELOG.md
- USER_MANAGEMENT.md if users/access changed
- GLOSSARY.md if terms changed
