# Required Backlog — Import Cleanup

## 2026-07-15 — Production cleanup for test/failed file imports

This item is required and must not be lost.

Add a production-safe admin cleanup action for file imports that can clean both database records and Supabase Storage files.

Scope:

- Add an admin-only cleanup/archive action for test, failed, or accidental file imports.
- The cleanup must remove or archive all related DB records, including:
  - `file_assets`
  - `raw_external_datasets`
  - `raw_external_rows`
  - `import_staging_rows`
  - `import_rejected_rows`
  - `mapping_review_queue`
  - related `source_entity_bindings` when applicable
  - related audit/operational logs only when explicitly marked as test cleanup and safe to remove
- The cleanup must also remove the physical files from Supabase Storage bucket `file-imports` using the Storage API.
- Do not rely on direct SQL deletion from `storage.objects`; Supabase Storage objects must be removed through Storage API / service-role Edge Function.
- The action must be protected by production role checks. Normal admins may clean operational failed/test imports only if explicitly allowed; destructive full cleanup should require superadmin or equivalent high-risk permission.
- The action must be auditable: log who initiated cleanup, which import/file IDs were affected, and whether DB cleanup and Storage cleanup both succeeded.
- Prefer archive/disable semantics where appropriate, but for explicitly confirmed test imports, full cleanup of DB + Storage is allowed.

Reason:

During `/imports` QA, test uploads of `analytics_hub_test_leads_upload.csv` were removed from public DB tables, but the physical CSV files remained in Supabase Storage because direct SQL deletion from Storage tables is not allowed. A proper production cleanup function is needed so future test/failed imports can be cleaned completely and safely.

Do not mark the file import cleanup layer complete until DB cleanup and Storage cleanup are both covered.
