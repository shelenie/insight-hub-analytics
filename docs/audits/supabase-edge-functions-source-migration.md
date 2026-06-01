# Supabase Edge Functions source migration tracker

Date: 2026-06-01

## Purpose

The deployed Supabase project contains 37 Edge Function folders under `supabase/functions`. This tracker was refreshed after the manual source migration that copied deployed function source into `supabase/functions/<function-name>/index.ts`.

GitHub is now the source of truth for Supabase Edge Function source. The Deploy Supabase Functions workflow is reported green, and CI / Publish site are reported green after excluding `supabase/functions` from frontend ESLint.

This audit update is documentation-only. It does not modify Edge Function logic, SQL/RLS, frontend UI, GitHub Actions, or `supabase/config.toml`.

## Project ref check

> **Warning:** `supabase/config.toml` currently has `project_id = "zbonqzvqxotuwmsorwsf"`. config.toml project_id should be verified against actual Supabase project ref `iaxqonjwgrqpgvbeydok`. This document records the mismatch only; it does not change Supabase settings.

## Current migration state

- Function folders inspected: 37
- Functions with real `index.ts`: 37
- Functions missing `index.ts`: 0
- `index.ts.todo` files remaining: 0
- `SOURCE_REQUIRED.md` files remaining: 0

## Cleanup status

No `index.ts.todo` files remain under `supabase/functions`.

All stale `SOURCE_REQUIRED.md` placeholders have been removed from function folders that already contain real `index.ts` source files.

## Function source status

| Function name | Local source status | Appears in `supabase/config.toml` | Notes |
| --- | --- | --- | --- |
| `ads-scheduled-sync-run` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `ai-helper-run` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `backup-export` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `binding-archive` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `binding-create-or-update` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `facebook-lead-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `facebook-lead-webhook` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `file-upload-parser` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `google-ads-oauth-callback` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `google-ads-oauth-start` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `google-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `google-oauth-callback` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `google-oauth-start` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `google-sheet-register` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `google-sheets-sync` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `health-check` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `mapping-review-approve` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `mapping-review-reject` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `mapping-review-send-telegram` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `meta-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `meta-oauth-callback` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `meta-oauth-start` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `onboarding-client-upsert` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `onboarding-funnel-upsert` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `onboarding-project-upsert` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `operational-alert-resolve` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `restore-backup` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `run-dev-action` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `telegram-dispatch` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `telegram-outbox-retry` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `telegram-set-webhook` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `telegram-webhook` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `tiktok-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `tiktok-oauth-callback` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `tiktok-oauth-start` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `whoami` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `workspace-role-info` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
