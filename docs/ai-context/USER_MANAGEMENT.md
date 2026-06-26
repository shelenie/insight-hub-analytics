# USER_MANAGEMENT.md

## Purpose

Guidance for users, auth, profiles, workspace membership, roles, permissions, invitations, deactivation, removal, RLS, and audit logs.

Actual table names and implementation must be verified in the repository.

---

## Core Principle

Do not confuse authentication with access.

```text
auth user ≠ workspace access
```

A person may exist in Supabase Auth but should not access workspace data unless they have active workspace membership and valid permissions.

---

## Access Model

Safe access flow:

```text
auth identity
→ app profile
→ workspace membership
→ role
→ permissions
→ RLS/backend checks
→ frontend visibility
```

Frontend visibility is not enough.

Backend and RLS must enforce critical access.

---

## Main Objects

Possible objects:

- auth user
- app profile
- workspace member
- invitation
- role
- permission
- audit log

Possible table names:

- profiles
- workspace_members
- workspace_invitations
- roles
- permissions
- audit_logs

Do not invent table names. Verify repo first.

---


## Verified Local State — 2026-06-25

Local repository inspection only. Remote Supabase production/deployment state still needs verification. No application code, Supabase migrations, or RLS policies were changed during this verification.

### Verified Facts

- Supabase Auth is the current local frontend auth provider.
- `src/auth/AuthProvider.tsx` manages session state, redirect session exchange, sign-out, and magic-link sign-in.
- Magic-link sign-in sets `shouldCreateUser: false`, which prevents email magic-link Auth-user creation from the local frontend flow.
- `src/pages/Login.tsx` supports Google OAuth sign-in; Google OAuth Auth-user creation behavior depends on remote Supabase Auth configuration and still needs verification.
- `src/auth/ProtectedRoute.tsx` is currently session-only: it checks for an authenticated Supabase session before rendering protected routes.
- `src/hooks/useWorkspaceRole.ts` resolves workspace role/capabilities through the `workspace-role-info` Edge Function.
- `supabase/functions/workspace-role-info/index.ts` validates the bearer token, resolves the authenticated user, uses server-side service role access to call backend access RPC logic, and returns role/capabilities.
- The verified local role values are `member`, `admin`, and `superadmin`.
- Local role capability mapping grants broader management capabilities to `admin`/`superadmin`, and reserves backup/restore and dev-action capabilities for `superadmin`.
- `supabase/migrations/20260520_task19_fix_workspace_members_rls_recursion.sql` references `workspace_members`, ranks `member`/`admin`/`superadmin`, and defines RLS policies for select/insert/update/delete on `workspace_members`.
- Several Edge Functions perform backend role checks through access RPCs before privileged actions.
- `audit_logs` is referenced by operational Edge Functions, but user-management-specific audit coverage is not verified.

### Needs Verification

- `profiles` base table/model, columns, lifecycle, and RLS.
- `workspace_members` base DDL, full columns, constraints, indexes, and remote RLS policies.
- Whether `workspace_members` has a status field and whether helpers/policies enforce only active memberships.
- Invitation table/model and invitation acceptance/revocation flow.
- `audit_logs` base schema, RLS, and coverage for user-management actions such as invite, accept, role change, deactivate, remove, and reactivate.
- First superadmin setup/bootstrap process.
- Remote definitions and deployed behavior for access RPCs/views such as current-user permissions and Edge Function access checks.
- Whether Google OAuth self-signup can create Auth users in the remote Supabase project.
- Full remote Supabase RLS/backend enforcement state.

### Current Access Risk

`ProtectedRoute` currently proves only that a user has an authenticated session. It does not prove workspace access. Until a stronger app-level access contract is defined, workspace access must be enforced by backend/RLS/views/RPC/Edge Functions. Do not grant or assume workspace access from Supabase Auth alone.

---

## Phase 1 Backend/RLS Contract — 2026-06-26

Implemented locally as a Supabase migration; remote application still requires deployment/verification.

- `workspace_members.status` supports `active`, `inactive`, and `removed`.
- Existing memberships are backfilled to `active` by the migration.
- Central role/access helpers and verified overloads only return/grant roles for active memberships, preserving `get_workspace_role(p_workspace_id uuid, p_user_id uuid DEFAULT auth.uid())` argument order.
- Direct `workspace_members` RLS admin checks depend on active membership through `get_current_user_workspace_role`.
- The last active `superadmin` membership in a workspace cannot be demoted, deactivated, marked removed, moved to another workspace, or deleted.
- `v_current_user_permissions` is explicitly recreated with `wm.status = 'active'` and hardened with `security_invoker=true`.
- `v_workspace_members_with_permissions` is hardened with `security_invoker=true` and direct `anon`/`authenticated` grants are revoked when present.

Deferred to later phases:

- `workspace_invitations` table and invitation RPCs.
- User-management action RPCs for invite, accept, revoke, deactivate, reactivate, remove, and role change.
- User-management-specific audit events.
- First-superadmin bootstrap contract.
- Remote Supabase verification after deployment.

## Auth User

Identity-level account, possibly in `auth.users`.

Auth user proves identity but not workspace access.

---

## App Profile

Application-level profile.

May include:

- user ID
- display name
- email
- avatar
- preferences
- status

---

## Workspace Member

Connects user to workspace.

Should include:

- workspace ID
- user ID
- role
- status
- invited by
- created date
- updated date

Possible statuses:

- pending
- active
- inactive
- removed

Only active members should access workspace data.

---

## Invitation Flow

Recommended flow:

```text
admin/superadmin enters email
→ create invitation with workspace_id + role + pending status
→ user signs up/logs in
→ auth user created/found
→ profile created/found
→ workspace membership created/activated
→ invitation accepted
→ audit log recorded
```

Pending invitation must not grant data access.

---

## Add Existing User Flow

```text
find existing user by email/profile
→ check existing workspace membership
→ create membership if none
→ reactivate only if allowed
→ assign role
→ audit log action
```

Do not duplicate users by email.

---

## Self-Signup

Self-signup must not automatically grant workspace access.

Safe states:

- no_workspace
- pending_approval
- pending_invite

---

## First Superadmin

Initial superadmin setup is special.

Possible safe methods:

- manual DB setup
- seed script
- protected admin function
- one-time bootstrap disabled after setup

Do not expose public superadmin creation.

---

## Roles

Verified current local roles:

- superadmin
- admin
- member

Possible guidance-only roles not verified in the current local implementation:

- viewer
- client

Remote roles and constraints still need verification before implementation.

### Superadmin

Highest-risk admin. Limited trusted users only.

### Admin

Operational admin. May manage sources, imports, projects, users if allowed.

### Member

Internal team user with limited operational access.

### Viewer

Read-only or mostly read-only.

### Client

External client access, limited to allowed client/project data.

---

## Role Change Rules

Role changes are high-risk.

Check:

- who can change roles
- can admin assign superadmin
- can user change own role
- can last superadmin be demoted
- audit old/new role
- RLS reflects change

---

## Deactivation / Removal

Prefer deactivation/removal over deletion.

Inactive/removed users should not access workspace data.

Preserve historical references:

- created_by
- updated_by
- invited_by
- assigned_to
- approved_by

---

## Deletion

User deletion is destructive.

Avoid deleting:

- auth users
- profiles
- memberships
- invitations
- audit logs

unless Olena explicitly asks and risk is clear.

---

## RLS Requirements

RLS should check:

- authenticated user ID
- active workspace membership
- workspace ID
- role/permission
- access scope

Do not allow users to query data from other workspaces.

Do not allow inactive/removed users to access data.

---

## Audit Logs

Audit user-management actions:

- invite sent
- invite accepted
- invite revoked
- role changed
- user deactivated
- user reactivated
- user removed
- superadmin created
- permission changed

Preserve audit logs.

---

## Frontend UI

User management UI may include:

- user list
- role
- status
- invite form
- change role
- deactivate/remove
- resend invite
- audit/history

Dangerous actions require confirmation.

Frontend must mirror backend permissions, not replace them.

---

## Testing

Test:

1. invite new email
2. duplicate invite
3. existing user joins workspace
4. pending invite accepted
5. expired invite rejected
6. role change
7. admin tries to assign superadmin
8. inactive user access blocked
9. removed user access blocked
10. another workspace user access blocked
11. viewer cannot edit
12. member cannot manage users
13. audit log created

---

## Questions To Verify

Before implementation, verify:

- auth provider
- profile table
- workspace_members table
- roles model
- permissions model
- invitation table
- audit logs
- first superadmin setup
- multi-workspace behavior
- existing RLS policies
- existing Edge Functions
- frontend user management UI

---

## Archive Before Delete

Do not delete user-related records by default.

Prefer:

- deactivate
- mark removed
- revoke invite
- expire invite
- preserve audit trail
