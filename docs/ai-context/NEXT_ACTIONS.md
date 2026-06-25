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
Status: upcoming

Compare local migrations/types with remote Supabase objects used by the frontend, especially views and RPCs referenced by dashboard/import pages.

Do not assume remote objects exist only because frontend code references them.


---

## Task: Verify and Define User Management Model

Priority: high
Status: locally inspected / partially complete on 2026-06-25

2026-06-25 local verification completed from repository files only. Verified local evidence confirms Supabase Auth, `AuthProvider`, session-only `ProtectedRoute`, `useWorkspaceRole`, `workspace-role-info`, and role values `member`, `admin`, and `superadmin`.

Still needs verification before implementation:

- remote Supabase schema and RLS for user-management tables/views/RPCs
- `profiles` base model and RLS
- `workspace_members` base DDL and full contract
- invitation model and flow
- `audit_logs` schema and user-management audit coverage
- inactive/removed member behavior
- first superadmin setup

Do not implement user UI before access model is clear.

---


## Task: Verify Remote Supabase Schema and RLS for User Management

Priority: high
Status: blocking / upcoming

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
