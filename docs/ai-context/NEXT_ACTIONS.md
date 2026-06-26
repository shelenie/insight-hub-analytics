# NEXT_ACTIONS.md

## Purpose

Current next actions for Internal Analytics Workspace.

---

## Current Priority

Continue verification of user management, Supabase security, and dashboard metric definitions before feature expansion.

---

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
