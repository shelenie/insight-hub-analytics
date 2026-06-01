# Missing Supabase Edge Function source report

Date: 2026-06-01

## Scope

This report compares the Edge Functions listed in `supabase/config.toml` with the
local `supabase/functions/<function-name>/index.ts` entrypoints required by
`supabase functions deploy --project-ref "$SUPABASE_PROJECT_ID"`.

The production requirement for this task is to copy the currently deployed Edge
Function source into GitHub. This repository snapshot does not include Supabase
CLI authentication, a Supabase access token, or any other direct access path to
retrieve deployed Edge Function source from project `zbonqzvqxotuwmsorwsf`.
Because deployed source is not directly accessible here, no placeholder Edge
Functions were created.

## Configured functions with local entrypoint status

| Function | `verify_jwt` | Local `index.ts` status |
| --- | --- | --- |
| `meta-oauth-callback` | `false` | Missing |
| `google-ads-oauth-callback` | `false` | Missing |
| `tiktok-oauth-callback` | `false` | Present |
| `facebook-lead-webhook` | `false` | Missing |
| `meta-ads-sync` | `false` | Missing |
| `google-ads-sync` | `false` | Missing |
| `tiktok-ads-sync` | `false` | Present |
| `facebook-lead-ads-sync` | `false` | Missing |
| `telegram-webhook` | `false` | Missing |
| `telegram-dispatch` | `false` | Missing |
| `meta-oauth-start` | `true` | Missing |
| `google-ads-oauth-start` | `true` | Missing |
| `tiktok-oauth-start` | `true` | Missing |
| `ads-scheduled-sync-run` | `true` | Missing |
| `ai-helper-run` | `true` | Missing |

## Missing source that must be retrieved from Supabase

The following deployed Edge Function source files are required before the repo can
become the source of truth and before the full Supabase deploy can pass without
missing entrypoint errors:

- `supabase/functions/meta-oauth-callback/index.ts`
- `supabase/functions/google-ads-oauth-callback/index.ts`
- `supabase/functions/facebook-lead-webhook/index.ts`
- `supabase/functions/meta-ads-sync/index.ts`
- `supabase/functions/google-ads-sync/index.ts`
- `supabase/functions/facebook-lead-ads-sync/index.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-dispatch/index.ts`
- `supabase/functions/meta-oauth-start/index.ts`
- `supabase/functions/google-ads-oauth-start/index.ts`
- `supabase/functions/tiktok-oauth-start/index.ts`
- `supabase/functions/ads-scheduled-sync-run/index.ts`
- `supabase/functions/ai-helper-run/index.ts`

## Retrieval requirement

A maintainer with Supabase project access should export or otherwise provide the
currently deployed source for each missing function above. After that source is
available, commit it verbatim or with only necessary repository-path adjustments,
while preserving the existing `verify_jwt` settings in `supabase/config.toml` and
without logging raw OAuth access or refresh tokens.
