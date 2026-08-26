# Runbook — Migration to production

Production migrations are **human-controlled** (ENGINEERING-WORKFLOW §7, D-27). Agents never run this.

## Preconditions
- [ ] Migration merged to `main`, applied to **staging** by CI, smoke test on staging passed.
- [ ] `/migration-review` verdict `SAFE` (or `NEEDS-HUMAN` with the required approval recorded in the PR).
- [ ] `/rls-review` verdict `PASS` if the migration touches policies/grants/functions.
- [ ] `supabase test db` green in CI; Supabase Advisors (security) clean on staging.
- [ ] Rollback section of the migration reviewed; data backup/PITR confirmed for non-trivial changes.
- [ ] App compatibility: current store build + pending OTA work with both old and new schema (expand/contract for destructive changes).

## Execution
1. Trigger the `supabase-deploy-prod` workflow (`workflow_dispatch`) — never `supabase db push` from a laptop.
2. Approve the `production` environment gate (required reviewer = CODEOWNER).
3. Watch the job: `db push` then `functions deploy` (if any).

## Post-checks (within 15 min)
- [ ] Health endpoints / critical RPCs respond.
- [ ] Error rate and DB CPU normal in Supabase dashboard.
- [ ] `audit_log` entry present if the migration was operational (seed/content).

## Rollback
- Prefer forward-fix migration. If reverting: apply the `-- ROLLBACK:` statements as a **new** migration through the same workflow. Restore from PITR only for data loss, with explicit human decision.

## Record
- PR link, workflow run URL, approver, timestamp → PR comment.
