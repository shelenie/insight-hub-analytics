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
Last updated: 2026-06-24  
Confidence: medium; must be verified against current repo  

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
