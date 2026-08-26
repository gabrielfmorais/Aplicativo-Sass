---
name: pre-commit-review
description: Read-only review of the current git diff against CLAUDE.md before committing — scope vs SPEC, layer boundaries, forbidden imports, ambient clock, PII in logs/events, secrets, removed tests, new dependencies, silent architecture changes. Use before every commit or PR.
---

# /pre-commit-review

## Purpose
Catch violations of `CLAUDE.md` and the architecture before they reach a commit (blast radius, boundaries, security, secrets).

## When to use
- Before `git commit` / opening a PR, and at the end of every agent task.

## Required inputs
- None (uses `git status`, `git diff`, `git diff --cached`). Optional: SPEC id to check scope against.

## Steps
1. Run `git status --short`, `git diff --stat`, `git diff` (and `--cached`). Read `CLAUDE.md`.
2. Scope: list files outside the SPEC's declared impact (`packages/core/src/<ctx>`, `apps/mobile/src/features/<ctx>`, `supabase/**` as declared). Flag unrelated refactors.
3. Boundaries: `packages/core` importing react/expo/@supabase/node built-ins; `features`/`app` importing `@supabase/*` or `@app/core/*/domain|application`; `infrastructure` importing `features`. Run `pnpm lint`, `pnpm dep-cruise`, `pnpm check:boundaries` and quote results.
4. Time: `new Date()` / `Date.now()` outside clock adapters (ADR-008).
5. Rules: business rules (`if plan === 'premium'`, care-cycle logic) inside UI; hair-care rules without `DomainRule` metadata / `validation_status` (D-26); overdue auto-rescheduling (D-28).
6. Data/PII: logs, analytics props or error messages containing email, names, free-text notes, tokens; new events outside the catalogue in `packages/core/src/shared/analytics/events.ts`.
7. Secrets: `.env*` staged; strings resembling JWTs/keys; `EXPO_PUBLIC_` used for a secret; service role anywhere under `apps/`.
8. Tests: tests deleted/skipped (`.skip`, `xit`, `--passWithNoTests`), coverage thresholds lowered, `check:boundaries` fixtures removed.
9. Dependencies: `package.json` changes → each new dependency has a justification (SPEC §Dependencies, supply-chain checklist), no `onlyBuiltDependencies` additions without justification, `.node-version`/Expo SDK unchanged (D-43/D-44).
10. Governance files: changes to `CLAUDE.md`, `.github/**`, `CODEOWNERS`, `docs/adr/**`, `docs/security/**`, `supabase/security/**` → require explicit human authorisation (CLAUDE.md §4).
11. `supabase/functions/deno.json` import map still mirrors `packages/core/package.json` dependencies.
12. Report.

## Guardrails
- Read-only: never stages, commits, reverts or edits files.
- Never suggests weakening a rule to make the diff pass.

## Expected output
Checklist with PASS/FAIL per item, list of offending files/lines, files out of scope, and verdict `OK TO COMMIT / FIX FIRST / NEEDS HUMAN AUTHORISATION`.

## Stop conditions
- Any secret-looking string in the diff → verdict `FIX FIRST`, and recommend `docs/runbooks/secret-rotation.md` if it may be real.
