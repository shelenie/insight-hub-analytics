## Decision: Semantic visual states live in shared UI/design-system layer

Status: active
Date: 2026-07-13
Scope: Shared UI / design system

Decision:

Reusable visual states and component variants must be defined in the shared UI/design-system layer. Pages must not independently define success, error, warning, info, active, or destructive color schemes for reusable components such as toasts, status surfaces, and badges. Application code should use semantic variants such as `success`, `error`, `warning`, and `info` rather than page-local Tailwind color strings.

Reason:

Centralized semantic variants keep light/dark-mode appearance consistent across the application, prevent local page drift, and make future visual QA fixes reversible and reviewable without touching unrelated page logic.

## Decision: Data Binding frontend mutations use authenticated RPC helpers

Status: active
Date: 2026-07-12
Scope: Data Bindings Step 3

Decision:

Operational Data Binding frontend actions should call hardened authenticated RPCs through a narrow frontend mutation module instead of embedding large inline payloads in `Bindings.tsx`. Ad-account mutations use `manage_ad_account_binding`, selected archival uses `archive_binding`, and hierarchy creation uses `upsert_client`, `upsert_project`, and `upsert_funnel` with actor fields omitted/null so the backend derives the authenticated actor. Source identity remains server-resolved in `binding-create-or-update`, and source mutations must use the authenticated user client; service role may be used only for narrow verified lookups when needed. Source rebind remains a non-atomic two-phase frontend/backend workflow unless a dedicated transactional source replacement RPC is approved later.

Reason:

This keeps production binding actions aligned with hardened RPC authorization, prevents browsers from supplying account/source identity or actor identity, and keeps selected replacement/archive behavior reviewable without adding DDL or weakening RLS.

## 2026-07-11 — Data Bindings mutation RPC authorization model

Decision: operational source and binding mutations are admin/superadmin-only through `can_manage_sources`; members remain read-only/proposal-only until a separate proposal workflow is explicitly designed. Binding replacement must be archive-first, soft-only, and transactional: when an operator supplies a replacement binding id, only that selected active binding is archived and the new exact-scope binding is created/upserted in the same transaction. Multiple active ad-account bindings may exist when scopes differ; setting a binding primary unsets other active primary bindings for the same ad account in the same transaction, but no new global one-binding-per-account constraint is added. Frontend callers must not supply platform/external account identifiers or actor identity for the new ad-account binding contract; those values are derived from database rows and the authenticated session.

## Decision: auto_routed Means Routing Source

Status: active
Date: 2026-07-11
Scope: AI Assistant routing metadata

Decision:

`auto_routed` means whether AI routing selected the assistant mode automatically (`true`) or whether an explicit manual override selected the mode (`false`). It must not be derived from whether the resolved mode differs from the default mode; automatic General routing is still `auto_routed = true`. User and assistant messages for the same request should carry the same routing-source metadata.

Reason:

This matches product/debug semantics and lets admin QA distinguish AI-selected routing from manual override behavior without mislabeling automatic General prompts as manual.

## Decision: Routing Metadata Hidden by Default, Admin Debug Only

Status: active
Date: 2026-07-11
Scope: AI Assistant routing QA

Decision:

AI Assistant request/context routing metadata remains hidden from normal user bubbles and history cards. Admin and superadmin users may see a collapsed, muted Technical details control under assistant answer actions for QA, limited to safe routing fields already present on the chat message: request_type, context_scope, auto_routed, and user-facing mode label. Raw backend payloads, prompts, system prompts, JSON context, and secrets must not be rendered.

Reason:

This preserves low-noise normal UX while giving operators a reversible way to verify deterministic routing during testing.

## Decision: Permanent AI Chat Delete Only From Archive

Status: active
Date: 2026-07-11
Scope: AI Assistant chat history

Decision:

AI Assistant chat sessions remain archived before deletion by default. Permanent deletion is allowed only for archived chat sessions, only after explicit user confirmation in the Archive view, and only when RLS confirms the row belongs to the authenticated user with active workspace access. Recent/non-archived sessions must not expose a permanent delete action.

Reason:

This preserves the project-wide archive-before-delete principle for normal history management while giving users a deliberate cleanup path for archived AI chat storage.

## 2026-07-11 — AI Assistant General Mode and Context Scope Semantics

Decision: General mode is the default AI Assistant context (`general_assistant` / `general`). `context_scope` is treated as an internal routing/source hint and persisted debug/routing metadata, not as a visible normal-UI label and not as a hard answer prison for general, conversational, product, process, or test-like prompts. Scoped analytics playbooks remain governing lenses only when the resolved request type/scope actually matches the user intent; General mode receives Safety/Evidence plus General Assistant guidance and must not invent workspace metrics, statuses, operational actions, or client/campaign facts.

Rationale: The prior Ads Health default caused weak/no-signal prompts such as chat-history tests to be sent as `ads_health_summary` / `ads_health`, which made the backend build ads context and force ads-health reporting language. The new default preserves safety and evidence requirements for workspace claims while allowing non-analytics questions to be answered directly.

# DECISIONS.md

## Purpose

Project decisions for Internal Analytics Workspace.

---

## Decision: AI Assistant System Troubleshooting Reuses Production Readiness

Status: active
Date: 2026-07-12
Scope: AI Assistant routing and Edge Function playbooks

Decision:

Application/system/deploy/auth/API/runtime troubleshooting in the AI Assistant uses the existing backend contract:

```text
request_type = production_readiness_summary
context_scope = production_readiness
```

The user-facing label is “Системна діагностика” / “System diagnostics”. Answers must be evidence-first, must not claim outages or exact causes without evidence, and must recommend safe non-destructive checks before configuration or data changes. Ads, Data Quality/Imports, Mapping, and General routing remain separate and should win when the prompt clearly belongs to those domains.

Reason:

These request/context values already exist in the frontend, Edge Function defaults, and `ai_helper_requests` CHECK constraints, avoiding another schema migration while preserving admin Technical details for QA.

---

## Decision: Current Working Stack

Status: active
Date: 2026-06-24
Scope: project-wide

Decision:

Current stack is:

- Codex
- Supabase
- GitHub

Revisit when Olena explicitly changes the stack.

---

## Decision: GitHub Is Source of Truth

Status: active
Date: 2026-06-24
Scope: code and repo docs

Decision:

GitHub is source of truth for code-related work and project context files.

Reason:

New chats may lose memory. Repo files provide durable context.

---

## Decision: Maintain Project Context In Repo

Status: active
Date: 2026-06-24
Scope: project memory

Decision:

Maintain:

```text
docs/ai-context/
  PROJECT_STATE.md
  DECISIONS.md
  NEXT_ACTIONS.md
  CHANGELOG.md
  CONTEXT_UPDATE_PROTOCOL.md
  USER_MANAGEMENT.md
  GLOSSARY.md
```

---

## Decision: Client Approval Is Not Final

Status: active
Date: 2026-06-24
Scope: project planning

Decision:

Treat the project as active but not finally approved by client.

Keep changes reversible and reviewable.

---

## Decision: Do Not Weaken Supabase Security

Status: active
Date: 2026-06-24
Scope: Supabase/security

Decision:

Do not weaken RLS, policies, role checks, or service role protections for quick fixes.

---

## Decision: Archive Before Delete

Status: active
Date: 2026-06-24
Scope: project-wide

Decision:

Do not delete valuable assets by default.

Prefer archive, disable, deprecate, backup, rollback copy.

---

## Decision: Metrics Before Dashboard UI

Status: active
Date: 2026-06-24
Scope: dashboard/reporting

Decision:

Define dashboard metric logic before UI polish or expansion.

---

## Decision: Data Quality Must Be Visible

Status: active
Date: 2026-06-24
Scope: imports/data/dashboard

Decision:

Do not hide data quality problems.

Rejected rows, missing values, duplicates, and mapping issues should be visible where practical.

---

## Decision: Auth User Is Not Workspace Access

Status: active
Date: 2026-06-24
Scope: user management/security

Decision:

A Supabase/auth user does not automatically have workspace access.

Access should require active workspace membership and valid role/permissions enforced by RLS/backend.

---

## Decision: Do Not Delete Users By Default

Status: active
Date: 2026-06-24
Scope: user management/audit

Decision:

Prefer deactivation/removal status over deleting users.

Preserve audit history and historical references.
