# CHANGELOG.md

## Purpose

Meaningful changes for Internal Analytics Workspace.

---


## 2026-06-26

### Added

- Added Phase 1 Supabase migration `20260626_phase1_active_membership_access_hardening.sql` for active membership enforcement.
- Added `workspace_members.status` lifecycle values `active`, `inactive`, and `removed`, plus `updated_at` maintenance.
- Hardened central workspace role/access helpers and verified overloads to grant access only for active memberships while preserving `get_workspace_role(p_workspace_id uuid, p_user_id uuid DEFAULT auth.uid())` argument order.
- Hardened `workspace_members` RLS admin checks to depend on active membership through `get_current_user_workspace_role`.
- Made direct `workspace_members` membership management superadmin-only for authenticated users; admins cannot create, update, deactivate, reactivate, remove, or move ordinary or superadmin memberships through direct table access.
- Added trigger-based protection against demoting, deactivating, removing, moving, or deleting the last active `superadmin` membership in a workspace.
- Hardened known permission/member views: `v_current_user_permissions` is explicitly recreated with its previous permission logic, `wm.status = 'active'`, and `security_invoker=true`; `v_workspace_members_with_permissions` is made active-aware and direct `authenticated`/`anon` grants are revoked when the view exists.

### Deferred

- Workspace invitations table/RPCs are deferred to a later phase. Pending invitations still must not grant access.
- User-management action RPCs and user-management-specific audit events are deferred.
- Remote deployment verification remains required after migration application.

## 2026-06-25

### Confirmed

- Completed local repo-state inspection was recorded in project context.
- Confirmed required project context files are present and readable in the local repository.
- Confirmed `Add Project Context Files` is tracked as completed in `NEXT_ACTIONS.md`.


### User Management Verification

- Completed local user-management/access verification from repository files only.
- Confirmed Supabase Auth, `AuthProvider`, session-only `ProtectedRoute`, `useWorkspaceRole`, and `workspace-role-info` are the current local auth/access pieces.
- Confirmed locally visible workspace roles are `member`, `admin`, and `superadmin`.
- Confirmed no verified local invitation flow was found.
- Confirmed no verified inactive/removed member behavior was found in local access helpers/policies.
- Confirmed remote Supabase schema/RLS verification is still required for `profiles`, `workspace_members`, invitations, `audit_logs`, access RPCs/views, first superadmin setup, and deployed policy behavior.
- No application code, Supabase migrations, RLS policies, package files, workflows, or environment files were changed.

### Notes

- No application code, Supabase files, package files, workflows, or environment files were changed.
- Supabase security state, dashboard metrics, package manager choice, remote Supabase contracts, and remote user-management schema/RLS remain upcoming verification items.

## 2026-06-24

### Added

- Created initial project context file set.
- Added project-specific AGENTS guidance.
- Added CONTEXT_UPDATE_PROTOCOL.
- Added USER_MANAGEMENT guidance.
- Added GLOSSARY.
- Added NEXT_ACTIONS.

### Confirmed

- Current stack: Codex + Supabase + GitHub.
- GitHub is source of truth for code/repo context.
- Client approval is not final.
- User management must distinguish auth user from workspace access.

### Notes

- Current state must be verified against actual GitHub repo.
- Supabase schema and RLS need repo verification.
- Dashboard metrics still need definition/verification.
- User management model still needs verification.

### Remaining Risks

- context drift if files are not updated
- old chat memory may conflict with repo facts
- RLS/security could be weakened if changes are rushed
- users/access may be implemented incorrectly without USER_MANAGEMENT.md
