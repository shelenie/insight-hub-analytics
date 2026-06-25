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
Status: upcoming

Read:

- `USER_MANAGEMENT.md`
- Supabase migrations/policies/functions
- auth/profile/user-related files
- admin/settings/user pages

Verify:

- auth provider
- profile table
- workspace membership table
- roles
- permissions
- invitations
- audit logs
- first superadmin setup
- RLS access rules
- deactivation/removal behavior

Do not implement user UI before access model is clear.

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
