# seed/

Local-only SQL applied on `supabase db reset`. Never pushed to remote environments.

- `00_test_helpers.sql` — `tests.*` security-check and impersonation helpers (used by `tests/security`).
- Product catalog seeds (`care_types`, content) arrive with their SPECs and must be idempotent.
