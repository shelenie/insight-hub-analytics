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
