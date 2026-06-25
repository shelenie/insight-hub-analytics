# AGENTS.md

## Purpose

Project-specific instructions for Codex working in the Internal Analytics Workspace repository.

Current stack:

- Codex
- Supabase
- GitHub

GitHub is source of truth for code and repository context.

Supabase is the backend/data layer.

---

## Critical Context Rule

Do not rely on chat memory alone.

Before working, read these files if they exist:

1. `docs/ai-context/PROJECT_STATE.md`
2. `docs/ai-context/DECISIONS.md`
3. `docs/ai-context/NEXT_ACTIONS.md`
4. `docs/ai-context/CHANGELOG.md`
5. `docs/ai-context/CONTEXT_UPDATE_PROTOCOL.md`
6. `docs/ai-context/USER_MANAGEMENT.md`
7. `docs/ai-context/GLOSSARY.md`

If the task involves users, auth, profiles, workspace members, roles, permissions, invitations, RLS access, deactivation/removal, or audit logs, `USER_MANAGEMENT.md` must be read before implementation.

If files are missing, say so and suggest creating them.

Do not invent missing project state.

---

## Project Status

Internal Analytics Workspace is active / in progress.

Client approval is not final unless project context files say otherwise.

Keep changes reversible and reviewable.

---

## Source of Truth Order

1. Current repo files.
2. `docs/ai-context/PROJECT_STATE.md`
3. `docs/ai-context/DECISIONS.md`
4. `docs/ai-context/NEXT_ACTIONS.md`
5. Current user instruction.
6. Old chat memory only if explicitly provided.

If sources conflict, stop and explain the conflict.

---

## Supabase Rules

Be careful with:

- RLS policies
- auth
- roles
- Edge Functions
- migrations
- storage policies
- SQL functions
- views
- service role usage
- anon key usage
- production data

Do not weaken RLS.

Do not expose service role keys.

Do not put secrets in frontend.

Do not drop tables, columns, policies, functions, or views without explicit approval and rollback notes.

Prefer additive/reversible changes.

---

## User Management Rules

Do not confuse authentication with workspace access.

```text
auth identity
→ app profile
→ workspace membership
→ role
→ permissions
→ RLS/backend checks
→ frontend visibility
```

Frontend checks are not enough.

Before implementation, verify:

- auth provider
- profile table
- workspace membership table
- roles
- permissions
- invitation model
- audit log model
- first superadmin setup
- existing RLS policies
- existing Edge Functions
- frontend user management UI

Do not create duplicate users by email.

Do not allow self-signup to grant workspace access automatically unless explicitly approved.

Do not allow pending invitations to access workspace data.

Do not allow inactive/removed users to access workspace data.

Do not delete users by default.

Prefer deactivation/removal status and preserve audit history.

---

## Dashboard Rules

Before UI work, define:

- dashboard goal
- metric definitions
- source fields
- formulas
- date logic
- filters
- grouping
- known limitations

Do not invent metrics.

Do not hide data quality issues.

---

## Data Rules

Protect:

- raw data
- IDs
- timestamps
- source records
- imports
- rejected rows
- audit trails

Do not silently discard records.

Define source of truth before merging or overwriting.

---

## Context Update Requirement

After meaningful work, update or propose patches for:

- `PROJECT_STATE.md`
- `DECISIONS.md`
- `NEXT_ACTIONS.md`
- `CHANGELOG.md`
- `USER_MANAGEMENT.md` if access/users changed
- `GLOSSARY.md` if terms changed

---

## Testing

Use repo-defined commands only.

Find commands from:

- README
- package scripts
- CI config
- docs

If checks cannot be run, say why and give manual checks.

---

## First Action in a New Session

1. Read `AGENTS.md`.
2. Read `docs/ai-context/PROJECT_STATE.md`.
3. Read `docs/ai-context/NEXT_ACTIONS.md`.
4. Read `docs/ai-context/DECISIONS.md` if task touches prior decisions.
5. Read `docs/ai-context/USER_MANAGEMENT.md` if task touches users/access.
6. Inspect relevant repo files.
7. Then start work.

---

## Final Response Format

```text
Changed:
- ...

Checked:
- ...

Could not verify:
- ...

Context updates:
- ...

Risks / notes:
- ...
```
