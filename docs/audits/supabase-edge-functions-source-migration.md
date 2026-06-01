# Supabase Edge Functions source migration tracker

Date: 2026-06-01

## Purpose

The deployed Supabase project contains 37 Edge Function folders under `supabase/functions`. This tracker was refreshed after the manual source migration that copied deployed function source into `supabase/functions/<function-name>/index.ts`.

GitHub is now becoming the source of truth for Supabase Edge Function source. The Deploy Supabase Functions workflow is reported green, and CI / Publish site are reported green after excluding `supabase/functions` from frontend ESLint.

This audit update is documentation-only. It does not modify Edge Function logic, SQL/RLS, frontend UI, GitHub Actions, or `supabase/config.toml`.

## Project ref check

> **Warning:** `supabase/config.toml` currently has `project_id = "zbonqzvqxotuwmsorwsf"`. config.toml project_id should be verified against actual Supabase project ref `iaxqonjwgrqpgvbeydok`. This document records the mismatch only; it does not change Supabase settings.

## Current migration state

- Function folders inspected: 37
- Functions with real `index.ts`: 37
- Functions missing `index.ts`: 0
- `index.ts.todo` files remaining: 0
- `SOURCE_REQUIRED.md` files remaining: 24

## Cleanup required

No `index.ts.todo` files remain under `supabase/functions`.

The following `SOURCE_REQUIRED.md` placeholders still exist even though each corresponding function folder now has a real `index.ts`:

- `supabase/functions/ads-scheduled-sync-run/SOURCE_REQUIRED.md`
- `supabase/functions/ai-helper-run/SOURCE_REQUIRED.md`
- `supabase/functions/backup-export/SOURCE_REQUIRED.md`
- `supabase/functions/facebook-lead-ads-sync/SOURCE_REQUIRED.md`
- `supabase/functions/facebook-lead-webhook/SOURCE_REQUIRED.md`
- `supabase/functions/file-upload-parser/SOURCE_REQUIRED.md`
- `supabase/functions/google-ads-oauth-callback/SOURCE_REQUIRED.md`
- `supabase/functions/google-ads-oauth-start/SOURCE_REQUIRED.md`
- `supabase/functions/google-ads-sync/SOURCE_REQUIRED.md`
- `supabase/functions/google-oauth-callback/SOURCE_REQUIRED.md`
- `supabase/functions/google-oauth-start/SOURCE_REQUIRED.md`
- `supabase/functions/google-sheet-register/SOURCE_REQUIRED.md`
- `supabase/functions/google-sheets-sync/SOURCE_REQUIRED.md`
- `supabase/functions/health-check/SOURCE_REQUIRED.md`
- `supabase/functions/meta-ads-sync/SOURCE_REQUIRED.md`
- `supabase/functions/meta-oauth-callback/SOURCE_REQUIRED.md`
- `supabase/functions/meta-oauth-start/SOURCE_REQUIRED.md`
- `supabase/functions/restore-backup/SOURCE_REQUIRED.md`
- `supabase/functions/run-dev-action/SOURCE_REQUIRED.md`
- `supabase/functions/telegram-dispatch/SOURCE_REQUIRED.md`
- `supabase/functions/telegram-set-webhook/SOURCE_REQUIRED.md`
- `supabase/functions/telegram-webhook/SOURCE_REQUIRED.md`
- `supabase/functions/tiktok-oauth-start/SOURCE_REQUIRED.md`
- `supabase/functions/whoami/SOURCE_REQUIRED.md`

## Function source status

| Function name | Local source status | Appears in `supabase/config.toml` | Notes |
| --- | --- | --- | --- |
| `ads-scheduled-sync-run` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `ai-helper-run` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `backup-export` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `binding-archive` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `binding-create-or-update` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `facebook-lead-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `facebook-lead-webhook` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `file-upload-parser` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `google-ads-oauth-callback` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `google-ads-oauth-start` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `google-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `google-oauth-callback` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `google-oauth-start` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `google-sheet-register` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `google-sheets-sync` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `health-check` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `mapping-review-approve` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `mapping-review-reject` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `mapping-review-send-telegram` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `meta-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `meta-oauth-callback` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `meta-oauth-start` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `onboarding-client-upsert` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `onboarding-funnel-upsert` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `onboarding-project-upsert` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `operational-alert-resolve` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `restore-backup` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `run-dev-action` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `telegram-dispatch` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `telegram-outbox-retry` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
| `telegram-set-webhook` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `telegram-webhook` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `tiktok-ads-sync` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `tiktok-oauth-callback` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. No migration placeholder files remain in this function folder. |
| `tiktok-oauth-start` | present real index.ts | yes | Function-specific entry is present in `supabase/config.toml`; preserve configured Verify JWT setting. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `whoami` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. Cleanup required: `SOURCE_REQUIRED.md` remains even though real `index.ts` is present. |
| `workspace-role-info` | present real index.ts | no | No function-specific entry found in `supabase/config.toml`. No migration placeholder files remain in this function folder. |
