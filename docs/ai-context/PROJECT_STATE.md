# PROJECT_STATE.md

## Purpose

Current state of Internal Analytics Workspace.

New ChatGPT/Codex/Claude/Cursor sessions should read this file first.

---

## Project

Name: Internal Analytics Workspace
Status: active / in progress
Approval: awaiting client approval
Current stack: Codex + Supabase + GitHub
Source of truth for code: GitHub
Backend/data layer: Supabase
Last updated: 2026-06-26
Confidence: medium-high for inspected repo facts; remote Supabase/production state still needs verification

---

## Goal

Build an internal analytics workspace for a performance/marketing agency.

The workspace should help organize and analyze:

- clients
- projects
- funnels
- traffic sources
- ad accounts
- imports
- mappings
- leads
- sales
- campaigns
- data quality
- dashboards
- AI-assisted analytics

The goal is not just visual dashboards.

The goal is structured, reliable analytics from messy business data.

---

## Known Context

Agency context may include:

- many client projects
- multiple funnels per project
- multiple traffic sources
- many Google Sheets / exports / imports
- ad data
- lead data
- sales data
- inconsistent naming
- messy source files

Do not assume data is clean.

---

## Current Stack

- GitHub = source of truth for code/repo docs
- Supabase = backend/data layer
- Codex = implementation assistant

Do not add unrelated tools unless Olena explicitly confirms them.

---

## Approval State

Client approval is not final.

Rules:

- do not treat all plans as approved
- keep changes reversible
- mark assumptions
- avoid irreversible production decisions
- update context when approval changes

---

## Known Rules

- GitHub is source of truth.
- Do not rely on old chat memory.
- Do not weaken RLS.
- Do not expose secrets.
- Do not delete valuable assets by default.
- Preserve raw data where practical.
- Dashboard metrics must be defined before UI polish.
- Data quality issues should be visible.
- User management must distinguish auth user from workspace access.

---

## Areas To Verify In Repo

- frontend framework
- package manager
- Supabase folder structure
- migrations
- RLS policies
- Edge Functions
- auth/roles
- user/profile/workspace membership tables
- dashboard pages
- import/data pipeline
- AI helper layer
- current env examples
- tests/build scripts

---

## Current Next Safe Action

1. Add/verify repo context files under `docs/ai-context/`.
2. Add/verify root `AGENTS.md`.
3. Ask Codex to inspect repo state.
4. Update this file with verified facts.
5. Then continue implementation.

---

## Verified Repo Facts — 2026-06-25

Inspection only. No application code was changed.

### Repository Structure

Verified top-level repo areas include:

- `src/` frontend application code
- `supabase/` Supabase config, migrations, and Edge Functions
- `docs/` project docs and audits
- `docs/ai-context/` durable AI context files
- `.github/workflows/` GitHub Actions workflows
- `public/` static assets

Verified root config/files include:

- `package.json`
- `package-lock.json`
- `bun.lockb`
- `vite.config.ts`
- `vitest.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `eslint.config.js`
- `.env.example`

Package manager is needs verification because both `package-lock.json` and `bun.lockb` exist.

### Frontend

Verified frontend stack from repo files:

- Vite
- React
- TypeScript
- React Router
- TanStack Query
- Tailwind CSS / shadcn-style component structure
- Supabase JS client
- Vitest

Main app routing is in `src/App.tsx`.

Verified protected page routes include:

- `/` Overview
- `/conversions`
- `/campaigns`
- `/sales`
- `/imports`
- `/assistant`
- `/onboarding`
- `/bindings`
- `/alerts`
- `/ads-connectors`

### Supabase

Verified Supabase repo structure:

- `supabase/config.toml`
- `supabase/migrations/`
- `supabase/functions/`

Verified local migrations include workspace membership RLS repair, unified reporting views, placement performance, import health summary RPC, campaign diagnostics RPC, disconnect ad platform connection RPC, timezone preferences, TikTok OAuth/token changes, onboarding hierarchy fix, and binding Edge Function registration.

Verified Edge Function source folders include:

- ads scheduled sync
- AI helper
- backup export / restore backup
- binding create/update/archive
- Facebook lead ads sync and webhook
- file upload parser
- Google OAuth / Ads OAuth / Sheets sync flows
- health check
- mapping review actions
- Meta OAuth / ads sync
- onboarding client/project/funnel upserts
- operational alert resolve
- Telegram dispatch/outbox/webhook helpers
- TikTok OAuth / ads sync
- `whoami`
- `workspace-role-info`

Remote Supabase deployment state is needs verification.

### Auth and User Access

Verified frontend auth/access files include:

- `src/auth/AuthProvider.tsx`
- `src/auth/ProtectedRoute.tsx`
- `src/hooks/useWorkspaceRole.ts`
- `src/integrations/supabase/client.ts`

Verified current behavior from repo files:

- Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Auth provider handles Supabase sessions and magic-link sign-in.
- Magic-link sign-in sets `shouldCreateUser: false`.
- `ProtectedRoute` checks for an authenticated session before rendering protected routes.
- Workspace role/capability lookup is handled separately through `workspace-role-info`.
- Locally visible role union is `member | admin | superadmin`.

Needs verification:

- profile table
- complete workspace membership table contract
- invitations model
- audit-log coverage
- first superadmin setup
- inactive/removed member behavior
- complete permissions model
- full RLS behavior in remote Supabase


### Verified User Management / Access — 2026-06-25

Inspection only. No application code, Supabase migrations, RLS policies, package files, or workflows were changed.

Verified local evidence confirms:

- Supabase Auth is the current auth provider used by the frontend.
- `src/auth/AuthProvider.tsx` manages Supabase session state, redirect session exchange, sign-out, and magic-link sign-in.
- Magic-link sign-in is configured with `shouldCreateUser: false`, so local frontend email-link flow is invite-only at the Auth-user creation level.
- `src/pages/Login.tsx` also supports Google OAuth sign-in; whether Google OAuth can create new Auth users still needs remote Supabase Auth configuration verification.
- `src/auth/ProtectedRoute.tsx` currently checks only for an authenticated Supabase session before rendering protected routes.
- `src/hooks/useWorkspaceRole.ts` calls the `workspace-role-info` Edge Function to resolve workspace role/capabilities separately from route authentication.
- The local verified role values are `member`, `admin`, and `superadmin`.
- `supabase/functions/workspace-role-info/index.ts` validates a bearer token, resolves the authenticated user, calls backend access RPC logic with service role server-side, and maps roles to capabilities.
- `supabase/migrations/20260520_task19_fix_workspace_members_rls_recursion.sql` defines local role ranking for `member`, `admin`, and `superadmin`, plus RLS policies for `workspace_members`.

Needs verification before user-management implementation:

- `profiles` base table/model, columns, lifecycle, and RLS.
- `workspace_members` base DDL, full column contract, constraints, indexes, and remote policies.
- Invitation model and invitation flow.
- `audit_logs` base schema, RLS, and user-management audit coverage.
- Inactive/removed member behavior and whether access helpers filter only active memberships.
- First superadmin setup/bootstrap process.
- Complete permissions/capabilities contract, including remote definitions for access RPCs/views.
- Remote Supabase schema, deployed Edge Functions, and actual RLS/backend enforcement state.

Risk to preserve in future work:

- `ProtectedRoute` is currently session-only. Until a stronger app-level access contract is defined, workspace access enforcement must rely on backend/RLS/views/RPC/Edge Functions. Do not treat an Auth session as workspace access.

### Dashboard, Imports, and Data

Verified app pages include Overview, Conversions, Campaigns, Sales, Imports, Assistant, Onboarding, Bindings, Alerts, Ads Connectors, Login, and Not Found.

Verified data/dashboard-related files include:

- `src/pages/Overview.tsx`
- `src/pages/Conversions.tsx`
- `src/pages/Campaigns.tsx`
- `src/pages/Sales.tsx`
- `src/pages/Imports.tsx`
- `src/pages/Assistant.tsx`
- `src/pages/Bindings.tsx`
- `src/pages/Alerts.tsx`
- `src/pages/AdsConnectors.tsx`
- `src/data/mock.ts`
- `src/filters/DateContext.tsx`
- `src/preferences/PreferencesProvider.tsx`
- `src/preferences/SavedViewsProvider.tsx`

Existing audits include:

- `docs/overview-audit.md`
- `docs/imports-data-health-audit.md`
- `docs/audits/ads-connectors-audit.md`
- `docs/audits/ads-connectors-production-status.md`
- `docs/audits/missing-supabase-functions-source-report.md`
- `docs/audits/supabase-edge-functions-source-migration.md`

Dashboard metric definitions still need verification before dashboard expansion or UI polish.

### Repo-defined Commands

Verified package scripts:

- `npm run dev` / package-manager equivalent: `vite`
- `npm run build`: `vite build`
- `npm run build:dev`: `vite build --mode development`
- `npm run lint`: `eslint .`
- `npm run preview`: `vite preview`
- `npm run test`: `vitest run`
- `npm run test:watch`: `vitest`
- `npm run typecheck`: `tsc --noEmit`

Use repo-defined scripts for checks. Package manager choice remains needs verification.

---

## Blockers / Unknowns

- client approval not final
- current repo state needs verification
- current Supabase schema needs verification
- current dashboard metrics need definition/verification
- user management model needs verification

---

## Startup Instruction

At the start of a new session:

1. Read this file.
2. Read `DECISIONS.md`.
3. Read `NEXT_ACTIONS.md`.
4. Read `CHANGELOG.md`.
5. Read `USER_MANAGEMENT.md` if access/users are involved.
6. Inspect repo files.
7. Mark unknowns as `needs verification`.

## User Management Phase 1 Patch — 2026-06-26

A local Supabase migration was added for the first safe backend/RLS patch. It adds active/inactive/removed membership lifecycle status, backfills existing memberships as active, hardens role/access helper functions to require active membership, updates direct `workspace_members` RLS policies to use the hardened helper, hardens known permission/member views when present, and adds trigger protection for the last active `superadmin`.

Deferred items remain: invitations, user-management RPCs, first-superadmin bootstrap, user-management audit events, and remote deployment verification.
