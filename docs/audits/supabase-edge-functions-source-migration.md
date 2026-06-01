# Supabase Edge Functions source migration tracker

Date: 2026-06-01

## Purpose

The deployed Supabase project contains 37 Edge Functions under project ref `iaxqonjwgrqpgvbeydok`. This tracker records which deployed functions already have local source and which require manual source migration from Supabase.

This PR intentionally creates only non-deployable manual migration files for functions missing `index.ts`:

- `SOURCE_REQUIRED.md`
- `index.ts.todo`

No empty `index.ts`, fake `index.ts`, executable stub, SQL/RLS change, frontend UI change, GitHub Actions workflow change, or Supabase config weakening is included.

## Project ref check

> **Warning:** `supabase/config.toml` currently has `project_id = "zbonqzvqxotuwmsorwsf"`. config.toml project_id should be verified against actual Supabase project ref iaxqonjwgrqpgvbeydok. This document records the mismatch only; it does not change Supabase settings.

## Deployment warning

This PR does **not** make GitHub a complete deploy source for every function yet. Do not deploy incomplete source. Any function with status `source required` must have the currently deployed Supabase source copied into `supabase/functions/<function-name>/index.ts` before that function is safely deployable from GitHub.

For functions referenced in `supabase/config.toml`, deploy safety still depends on adding the real deployed `index.ts` source while preserving the current Verify JWT setting.

## Function source status

| Function name | Supabase URL | Local source status | Appears in `supabase/config.toml` | Notes |
| --- | --- | --- | --- | --- |
| `ads-scheduled-sync-run` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/ads-scheduled-sync-run | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `ai-helper-run` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/ai-helper-run | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `backup-export` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/backup-export | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `binding-archive` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/binding-archive | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `binding-create-or-update` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/binding-create-or-update | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `facebook-lead-ads-sync` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/facebook-lead-ads-sync | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `facebook-lead-webhook` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/facebook-lead-webhook | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `file-upload-parser` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/file-upload-parser | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `google-ads-oauth-callback` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/google-ads-oauth-callback | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `google-ads-oauth-start` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/google-ads-oauth-start | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `google-ads-sync` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/google-ads-sync | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `google-oauth-callback` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/google-oauth-callback | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `google-oauth-start` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/google-oauth-start | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `google-sheet-register` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/google-sheet-register | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `google-sheets-sync` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/google-sheets-sync | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `health-check` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/health-check | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `mapping-review-approve` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/mapping-review-approve | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `mapping-review-reject` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/mapping-review-reject | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `mapping-review-send-telegram` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/mapping-review-send-telegram | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `meta-ads-sync` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/meta-ads-sync | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `meta-oauth-callback` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/meta-oauth-callback | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `meta-oauth-start` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/meta-oauth-start | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `onboarding-client-upsert` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/onboarding-client-upsert | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `onboarding-funnel-upsert` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/onboarding-funnel-upsert | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `onboarding-project-upsert` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/onboarding-project-upsert | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `operational-alert-resolve` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/operational-alert-resolve | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `restore-backup` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/restore-backup | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `run-dev-action` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/run-dev-action | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `telegram-dispatch` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/telegram-dispatch | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `telegram-outbox-retry` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/telegram-outbox-retry | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
| `telegram-set-webhook` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/telegram-set-webhook | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `telegram-webhook` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/telegram-webhook | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `tiktok-ads-sync` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/tiktok-ads-sync | present real index.ts | yes | Existing local `index.ts` was left unchanged. Preserve configured Verify JWT setting. |
| `tiktok-oauth-callback` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/tiktok-oauth-callback | present real index.ts | yes | Existing local `index.ts` was left unchanged. Preserve configured Verify JWT setting. |
| `tiktok-oauth-start` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/tiktok-oauth-start | source required | yes | Safe non-deployable migration files only; real deployed source must be pasted manually. Preserve configured Verify JWT setting. |
| `whoami` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/whoami | source required | no | Safe non-deployable migration files only; real deployed source must be pasted manually. No function-specific entry found in `supabase/config.toml`. |
| `workspace-role-info` | https://iaxqonjwgrqpgvbeydok.supabase.co/functions/v1/workspace-role-info | present real index.ts | no | Existing local `index.ts` was left unchanged. No function-specific entry found in `supabase/config.toml`. |
