# CHANGELOG.md

## Purpose

Meaningful changes for Internal Analytics Workspace.

---

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
