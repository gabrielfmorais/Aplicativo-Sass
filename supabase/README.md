# supabase/

Schema-as-code for the Supabase backend (ADR-004). **No product tables exist yet** (SPEC-000).

| Path | Purpose |
|---|---|
| `config.toml` | Local stack configuration (`supabase start`). Storage and Realtime disabled (not used in the MVP). Auth settings are configured under SPEC-001. |
| `migrations/` | Versioned SQL, one small additive migration per change, with a `-- ROLLBACK:` note. `20260826000000_foundation.sql` contains technical helpers only. |
| `seed/` | **Local-only** SQL applied on `supabase db reset` (never pushed). `00_test_helpers.sql` defines the `tests.*` security-check functions. Loaded **after** `security/allowlists.sql` (explicit order in `config.toml`). |
| `security/allowlists.sql` | Allowlists for `SECURITY DEFINER` functions and anon/authenticated grants (loaded as a local seed). Adding an entry requires a SPEC reference and human review. |
| `tests/security/` | pgTAP guardrails: RLS on+forced for every public table, DEFINER allowlist, grants allowlist, plus a **negative fixture** proving the checks fire. |
| `functions/` | Edge Functions (Deno). `deno.json` maps `@app/core` to the workspace sources (see `docs/architecture/CORE-RUNTIME-SPIKE.md`). `health` is a foundation-only function. |
| `ops/` | Read-only operational queries referenced by runbooks. |

## Commands (require Docker Desktop)

```
npx supabase start          # local stack
npx supabase db reset       # apply migrations + seeds
npx supabase test db        # run pgTAP tests in supabase/tests
npx supabase functions serve health --no-verify-jwt
npx supabase stop
```

Remote projects: **never** from a developer machine under SPEC-000. Staging/production pushes happen only via the CI workflows described in `docs/architecture/ENGINEERING-WORKFLOW.md` with human approval.
