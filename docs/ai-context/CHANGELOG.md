# CHANGELOG.md

## Purpose

Meaningful changes for Internal Analytics Workspace.

---

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
