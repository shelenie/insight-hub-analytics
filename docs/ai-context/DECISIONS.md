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
