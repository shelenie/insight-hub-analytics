# Ads connectors production status

Date: 2026-06-01

## Purpose

This audit records the current production smoke-test status for ads, messaging, and AI helper connectors after the Supabase Edge Functions source migration. GitHub is now the source of truth for Supabase Edge Function source under `supabase/functions/<function-name>/index.ts`.

## Status summary

| Connector | Current status | Notes | Follow-up |
| --- | --- | --- | --- |
| Meta Ads | Previously passed | OAuth was connected previously, and sync previously worked. | Needs a post-migration smoke test after the function source migration. |
| Google Ads | Partially blocked | OAuth connected, but sync is blocked by Google Ads developer token access: `DEVELOPER_TOKEN_NOT_APPROVED`. | Basic Access request is pending/required before sync can be fully validated. |
| TikTok Ads | Latest test passed | OAuth connected; `access_token_only` mode works; scheduled 365-day sync works with 30-day chunks; `chunks_count = 13`; latest test completed successfully. | No data was inserted because the test advertiser account is empty. |
| Facebook Lead Ads | Foundation present | Sync/webhook foundation exists. | Needs a post-migration smoke test and real forms test. |
| Telegram | Previously passed | Real dispatch and HITL button tests passed previously. | Needs a post-migration smoke test after the function source migration. |
| AI helper | Previously passed | OpenAI helper worked previously. | Needs a post-migration smoke test after the function source migration. |

## Connector details

### Meta Ads

- OAuth connected previously.
- Sync previously worked.
- Status: needs post-migration smoke test after the Supabase Edge Functions source migration.

### Google Ads

- OAuth connected.
- Sync remains blocked by Google Ads developer token access.
- Blocking error: `DEVELOPER_TOKEN_NOT_APPROVED`.
- Status: Basic Access request is pending/required before production sync can be fully validated.

### TikTok Ads

- OAuth connected.
- `token_mode = access_token_only` works in production.
- Scheduled 365-day sync works with 30-day chunks.
- `chunks_count = 13`.
- `chunking_enabled = true`.
- `chunk_max_days = 30`.
- `rows_failed = 0`.
- `error_message = null`.
- Latest test result: success.
- Data result: `ad_raw_insights = 0` and `facts_ads_daily = 0` because the TikTok advertiser account used for testing is empty.

### Facebook Lead Ads

- Sync/webhook foundation exists.
- Status: needs post-migration smoke test and real forms test.

### Telegram

- Real dispatch tests passed previously.
- HITL button tests passed previously.
- Status: needs post-migration smoke test after the Supabase Edge Functions source migration.

### AI helper

- OpenAI helper worked previously.
- Status: needs post-migration smoke test after the Supabase Edge Functions source migration.
