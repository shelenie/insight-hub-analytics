# CHANGELOG.md

## Purpose

Meaningful changes for Internal Analytics Workspace.

---

## 2026-07-05

### Changed

- Clarified the Data Bindings manual/admin UX before AI-assisted mapping/autobinding: polished overview/source/project/mapping-review/health tab titles, descriptions, and empty states without backend, RPC, or RLS changes.
- Polished the Data Bindings “Рекламні акаунти” section header by merging the title, description, status filter, and primary action into one compact admin header with a fixed-width status select.
- Finished separating Data Bindings ad-account drawer and technical UUID feedback: normal drawer errors now stay inside the drawer and successful normal saves use toast only, while technical UUID success/error feedback stays inside the collapsed advanced block.
- Polished the Data Bindings “Рекламні акаунти” drawer UX: separated normal drawer state from the advanced UUID form state, added create-vs-update success toast copy, made success toasts more visually distinct, switched the drawer title between create/edit modes, and shortened the table helper text.
- Moved the normal Data Bindings ad-account binding form from inline page expansion into a right-side Sheet drawer so opening “+ Привʼязати рекламний акаунт” or “Перепривʼязати” no longer pushes the table down; kept the technical UUID mode collapsed below the table as a smaller advanced workflow.
- Replaced the normal Data Bindings ad-account success block with the existing app toast notification after successful save, while preserving form close/clear and table refresh behavior.
- Improved the Data Bindings “Рекламні акаунти” tab into a production-oriented admin workflow with a compact status dropdown, business-focused table, primary “+ Привʼязати рекламний акаунт” action, and searchable name-based comboboxes for ad account/client/project/funnel selection, plus short normal-flow success feedback that closes and clears the form after save.
- Kept the manual UUID-based ad account binding setup available as a collapsed secondary “Технічне налаштування через ID” block.

### Notes

- Backend behavior remains delegated to the existing `binding-create-or-update` Edge Function; no RLS, RPC signature, or destructive data behavior was changed.

## 2026-07-04

### Changed

- Improved manual Data Bindings save feedback so source and ad account technical setup forms show visible success/error status near the form after Edge Function actions complete; feedback persists with submitted form values until the next save, refresh, tab change, or form edit.
- Added compact collapsed technical details for binding save responses, including RPC/result identifiers when returned.
- Hardened the ad account idempotency migration for future environments by replacing `CREATE OR REPLACE FUNCTION` with duplicate preflight, `DROP FUNCTION` without `CASCADE`, `CREATE FUNCTION`, explicit execute grants, and PostgREST schema reload notification.

### Fixed

- Added Supabase migration `20260704_make_ad_account_binding_idempotent.sql` to make `public.bind_ad_account_to_scope` idempotent for repeated manual submissions of the same active ad account binding target.
- Added a non-destructive preflight duplicate check and partial unique index guard for active `ad_account_bindings` on `workspace_id`, `ad_account_id`, `client_id`, `project_id`, and `funnel_id` with `binding_status = 'active'`.
- Added regression tests covering the migration contract: update-before-insert behavior, active natural key matching, archived-row preservation, creator preservation, and active-only unique guard.
- Updated both the Data Bindings Ad Accounts tab and Ads connectors ad account UI so default lists show only active bindings, with explicit Active / Archived-paused / All filters for historical rows.
- Added Ads connectors cache invalidation after binding actions so manual save/archive/update flows refresh the connected ad accounts list.
- Hardened the ad account idempotent update path to preserve existing `notes`, `metadata`, and `is_primary` when repeated manual saves do not explicitly provide replacement values.

### Notes

- The migration does not delete or archive production data; it fails with an explicit error if duplicate active ad account bindings still exist before the unique index is created.
- Local repository inspection found the Edge Function caller and tests, but local migrations do not contain the existing `public.bind_source_entity_to_scope` definition; source binding duplicate risk remains a remote-contract verification follow-up.


## 2026-06-26

### Added

- Added Phase 1 Supabase migration `20260626_phase1_active_membership_access_hardening.sql` for active membership enforcement.
- Added `workspace_members.status` lifecycle values `active`, `inactive`, and `removed`, plus `updated_at` maintenance.
- Hardened central workspace role/access helpers and verified overloads to grant access only for active memberships while preserving `get_workspace_role(p_workspace_id uuid, p_user_id uuid DEFAULT auth.uid())` argument order.
- Hardened `workspace_members` RLS admin checks to depend on active membership through `get_current_user_workspace_role`.
- Made direct `workspace_members` membership management superadmin-only for authenticated users; admins cannot create, update, deactivate, reactivate, remove, or move ordinary or superadmin memberships through direct table access.
- Added trigger-based protection against demoting, deactivating, removing, moving, or deleting the last active `superadmin` membership in a workspace.
- Hardened known permission/member views: `v_current_user_permissions` is explicitly recreated with its previous permission logic, `wm.status = 'active'`, and `security_invoker=true`; `v_workspace_members_with_permissions` is made active-aware and direct `authenticated`/`anon` grants are revoked when the view exists.

### Confirmed

- PR #183 was merged into `main`.
- Remote Supabase Phase 1 user-access hardening was manually applied and verified on 2026-06-26.
- Verified `workspace_members.status` exists and all existing workspace memberships are `active`.
- Verified active-only role/access helpers through `get_current_user_workspace_role` and `get_workspace_role`.
- Verified `workspace_members` direct INSERT/UPDATE/DELETE policies are superadmin-only for authenticated users.
- Verified triggers exist for `updated_at`, workspace member management enforcement, and last active `superadmin` protection.
- Verified `v_current_user_permissions` and `v_workspace_members_with_permissions` are active-aware and use `security_invoker=true`.
- Verified `v_workspace_members_with_permissions` has no direct `SELECT` grant for `anon` or `authenticated`.

### Deferred

- Workspace invitations table/RPCs are deferred to a later phase. Pending invitations still must not grant access.
- User-management action RPCs and user-management-specific audit events are deferred.

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
