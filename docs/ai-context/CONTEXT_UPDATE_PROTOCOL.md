# CONTEXT_UPDATE_PROTOCOL.md

## Purpose

Rules for keeping Internal Analytics Workspace context updated.

---

## Core Rule

Do not rely on chat memory as main project memory.

Use repo files.

After meaningful work, update the relevant context files or provide a GitHub patch.

---

## Required Files

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

## When To Update

Update after:

- code change
- Supabase change
- RLS/security change
- dashboard metric change
- user management change
- blocker found/resolved
- client approval status change
- important decision
- repo verification
- new next action
- new repeated term

---

## Which File To Update

### PROJECT_STATE.md

Update when current state changes.

### DECISIONS.md

Update when decision is made.

### NEXT_ACTIONS.md

Update when task priority/status changes.

### CHANGELOG.md

Update for meaningful changes.

### USER_MANAGEMENT.md

Update when users/auth/roles/invitations/access/RLS/audit behavior changes.

### GLOSSARY.md

Update when important repeated terms appear.

---

## End-of-Session Prompt

```text
Онови context files для Internal Analytics Workspace:
PROJECT_STATE, DECISIONS, CHANGELOG, NEXT_ACTIONS.
Якщо змінились users/roles/access — онови USER_MANAGEMENT.
Якщо зʼявились нові терміни — онови GLOSSARY.
Дай patch для GitHub.
```

---

## What Not To Store

Do not store:

- secrets
- API keys
- tokens
- private credentials
- huge raw payloads
- temporary logs
- unrelated client tasks
- old noise
- unsupported assumptions

---

## If Context Is Missing

Do not guess.

Say what is missing, inspect repo files, and propose creating/updating context.
