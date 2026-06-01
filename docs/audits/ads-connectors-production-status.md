# Ads connectors production status

Date: 2026-06-01

## Purpose

This audit records the current production smoke-test status for ads, messaging, and AI helper connectors after the Supabase Edge Functions source migration. GitHub is now the source of truth for Supabase Edge Function source under `supabase/functions/<function-name>/index.ts`.

## Status summary

| Connector | Current status | Notes | Follow-up |
| --- | --- | --- | --- |
| Meta Ads | Post-migration smoke test passed | `ads-scheduled-sync-run` invoked `meta-ads-sync` in `user_jwt` mode; status was `success`; `rows_failed = 0`; `error_message = null`. | No data was inserted because the account has no data for the tested period. |
| Google Ads | Blocked | OAuth is connected, but sync remains blocked by Google Ads developer token access / Basic Access approval: `DEVELOPER_TOKEN_NOT_APPROVED`. | Basic Access approval is required before production sync can be fully validated. |
| TikTok Ads | Post-migration smoke test passed | Real OAuth connection works; `access_token_only` mode works; scheduled 365-day sync works with 30-day chunking; `chunks_count = 13`; `rows_failed = 0`. | No data was inserted because the test advertiser account is empty. |
| Facebook Lead Ads sync | Post-migration smoke test passed | `facebook-lead-ads-sync` ran with `user_jwt`; `real_meta_api_called = true`; status was `success`; `forms_seen = 0`; `leads_received = 0`; `leads_failed = 0`; `error_message = null`. | Real lead ingestion still needs a real form/test lead event later. |
| Facebook Lead webhook endpoint/security | Post-migration smoke test passed | GET verification endpoint is alive; wrong verify token is rejected; audit action `facebook_lead_webhook_verify_failed` was written; `verify_token_configured = true`; `webhook_events` remained `0`. | Real webhook ingestion should be validated later with a real form/test lead event. |
| Telegram dispatch | Post-migration smoke test passed | Queued message became sent; `telegram_message_id = 9`; `error_message = null`; real Telegram group delivery worked. | None for smoke-test status. |
| AI helper | Post-migration smoke test passed | `ai-helper-run` started and succeeded with provider `openai`, model `gpt-5.5`, request type `production_readiness_summary`, and context scope `production_readiness`. | None for smoke-test status. |

## Connector details

### Meta Ads

- `ads-scheduled-sync-run` invoked `meta-ads-sync` after the Supabase Edge Functions source migration.
- `mode = user_jwt`.
- `status = success`.
- `rows_failed = 0`.
- `error_message = null`.
- Latest post-migration smoke test result: passed.
- Data result: no data was inserted because the account has no data for the tested period.

### Google Ads

- OAuth connected.
- Sync remains blocked by Google Ads developer token access / Basic Access approval.
- Blocking error: `DEVELOPER_TOKEN_NOT_APPROVED`.
- Status: Basic Access approval is required before production sync can be fully validated.

### TikTok Ads

- Real OAuth connection works.
- `access_token_only` mode works in production.
- Scheduled 365-day sync works with 30-day chunking.
- `chunks_count = 13`.
- `chunking_enabled = true`.
- `chunk_max_days = 30`.
- `rows_failed = 0`.
- `error_message = null`.
- Latest post-migration smoke test result: passed.
- Data result: no data was inserted because the test advertiser account is empty.

### Facebook Lead Ads

- `facebook-lead-ads-sync` ran with `user_jwt` after the Supabase Edge Functions source migration.
- `real_meta_api_called = true`.
- `status = success`.
- `forms_seen = 0`.
- `leads_received = 0`.
- `leads_failed = 0`.
- `error_message = null`.
- Latest post-migration sync smoke test result: passed.
- GET webhook verification endpoint is alive.
- Wrong verify token is rejected.
- Audit action `facebook_lead_webhook_verify_failed` was written.
- `verify_token_configured = true`.
- `webhook_events` remained `0` during the endpoint/security smoke test.
- Latest webhook endpoint/security smoke test result: passed.
- Follow-up: real lead ingestion still needs a real form/test lead event later.

### Telegram dispatch

- Queued message became sent.
- `telegram_message_id = 9`.
- `error_message = null`.
- Real Telegram group delivery worked.
- Latest post-migration smoke test result: passed.

### AI helper

- `ai-helper-run` started and succeeded.
- `provider = openai`.
- `model = gpt-5.5`.
- `request_type = production_readiness_summary`.
- `context_scope = production_readiness`.
- Latest post-migration smoke test result: passed.
