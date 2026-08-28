---
name: improve
description: Senior technical audit of work already done — hunts functional bugs, regressions, SPEC violations, authorization/RLS gaps, race conditions, idempotency and double-submit holes, impossible states, history corruption, client/server drift, missing mobile states (loading/empty/error/retry/reopen), dead code, overengineering and missing critical tests; classifies findings BLOCKER/IMPORTANT/OPTIONAL and fixes BLOCKER/IMPORTANT autonomously inside the approved SPEC scope. MANDATORY before any relevant implementation may be called DONE or auto-merged. Also supports FULL PROJECT AUDIT across SPECs and modules at checkpoints. Use after implementing a SPEC, touching the database, migrations, RLS, RPCs, Edge Functions, auth, concurrency or idempotency, on cross-module or structural changes, on relevant user-facing features, and before beta/release.
---

# /improve [SPEC-NNN | --full]

## Purpose

Green CI is not DONE. `pnpm verify` proves the code compiles, lints and passes the tests that were written — it cannot prove the work is correct, safe or complete. This skill is the audit that stands between "tests pass" and "ready to auto-merge".

You act as a **senior technical auditor reviewing work already done** — including your own. Assume it has a defect and go find it.

## Modes

| Mode | Invocation | Target |
| --- | --- | --- |
| **Implementation audit** (default) | `/improve` or `/improve SPEC-NNN` | the current branch's diff vs `main`, read in the context of its SPEC |
| **Full project audit** | `/improve --full` | the whole repository: integration between SPECs and modules |

## When it is MANDATORY

Any of these makes the audit non-optional before DONE / auto-merge:

- implementing a SPEC
- database change or migration
- RLS, policy, grant, or anything under `supabase/security/`
- RPC or Edge Function
- authentication
- concurrency, idempotency or retry behaviour
- cross-module change
- structural refactor
- relevant user-facing feature
- preparing for beta or release

**May be skipped or run light** (say which, and why, in the report): docs-only, typo, factual status update, trivial CI fix that changes no behaviour.

## Required inputs

- None. Derives its target from `git diff main...HEAD` and the SPEC referenced by the branch/commits.
- If no SPEC can be identified for a non-trivial code change → **stop and report**; auditing against an unknown contract is guessing.

## Steps

1. **Read the contract first.** `CLAUDE.md`, the SPEC (Business Rules, Acceptance Criteria, Edge Cases, Failure Modes, Non-Goals), the ADRs it references, `docs/architecture/DECISION-REGISTER.md`. You cannot judge an implementation without the requirement it answers.
2. **Read the actual diff**, not the summary of it: `git diff main...HEAD` plus every file it touches, whole. Trace the real end-to-end flow — screen → port → adapter → RPC/Edge → SQL → RLS — never one layer in isolation.
3. **Delegate what already has a skill** rather than re-deriving it. Run and cite:
   - `/pre-commit-review` — CLAUDE.md compliance, blast radius, boundaries, secrets, PII, removed tests, new dependencies
   - `/rls-review` — if the diff touches tables, policies, grants or `SECURITY DEFINER`
   - `/migration-review` — if the diff touches `supabase/migrations/`
   Do not repeat their checks here; audit what they do not cover.
4. **Run the audit dimensions** (§Audit dimensions) against the traced flow.
5. **Classify every finding** BLOCKER / IMPORTANT / OPTIONAL (§Severity). A finding with no concrete failure scenario is not a finding — drop it.
6. **Verify before fixing.** For each BLOCKER/IMPORTANT, state the inputs/state that produce the wrong outcome. If you cannot, it is a hypothesis: mark it and say so.
7. **Fix** per §Autonomous fix policy — smallest safe change, consistent with the current architecture.
8. **Re-run validation**: `pnpm verify` (and `supabase test db` if SQL changed, or state that CI is the authoritative gate when the local stack is unavailable). Report real output.
9. **Report** (§Expected output). One pass. Re-audit only under §Loop prevention.

## Audit dimensions

Trace the flow and ask, concretely:

**Correctness & contract**
- Does the behaviour match the SPEC's BRs and ACs — each one, by name?
- Regression: does an earlier SPEC's validated behaviour still hold?
- Did anything ship that the SPEC lists as a Non-Goal?

**Security & authorization**
- Authorization enforced server-side, not just in the UI (P10)?
- RLS/grants/`SECURITY DEFINER` correct — and does the client hold only the privileges the SPEC grants it?
- Trust boundaries: is any value the client controls trusted for a decision the server must own (user id, dates, ownership, entitlement)?
- What does a **modified client** achieve? Bypassed UI guard, forged parameter, replayed request, skipped step.

**Data integrity & concurrency**
- Invariants enforced by DB constraints, or only by application code that a second path can bypass?
- Race conditions: two devices, two taps, a retry crossing the original.
- Idempotency: is the key per-intent, reused on retry, and does a duplicate produce one fact instead of two?
- Double-submit and in-flight actions.
- Dangerous retries: can a retry corrupt or duplicate state?
- Impossible states: can the data reach a combination the domain forbids?
- History: is planned-vs-executed preserved, or does something overwrite the past?

**Client/server consistency**
- Do client-side types, column selects and mappings match what the server actually returns?
- Does the client's derived state agree with the server's rules, or can they disagree silently?
- Stale screen vs server refusal: does the UI reconcile, or argue?

**Mobile UX (functional, not visual)**
- Happy path actually completable
- Loading, empty, error + retry — present, or honestly N/A with the reason
- Reopen / refresh keeps correct state
- Actions in flight: guarded, not double-firable, not blocking reads
- Navigation reaches and returns from every new surface
- Accessibility basics: role, label, hit target
- Is the flow genuinely usable, end to end, by a real user?

**Quality**
- Dead code, unreachable paths, orphaned exports
- Problematic duplication — the same rule expressed in two places that can drift
- Unnecessary abstraction, overengineering, speculative flexibility
- Obviously problematic performance (N+1, unbounded scans/lists, work in a render path)
- Missing critical tests: the test that would fail if this logic broke
- Insufficient error handling — swallowed errors, an error path that lies about what happened

## Severity

| Level | Definition |
| --- | --- |
| **BLOCKER** | Security · authorization · integrity · data loss or corruption · functional bug · serious race · SPEC violation · behaviour incompatible with an approved requirement |
| **IMPORTANT** | Real fragility · important edge case · missing critical test · dangerous maintenance trap · inadequate error/retry behaviour · concrete technical risk |
| **OPTIONAL** | Aesthetic preference · cosmetic naming · refactor with no concrete benefit · abstraction for a future need · improvement not required by the current scope |

## Autonomous fix policy

Inside an already-approved SPEC:

- **BLOCKER → fix autonomously.** Always.
- **IMPORTANT → fix autonomously** when the fix stays inside the approved scope. If it does not, report it and say what it would take.
- **OPTIONAL → do NOT change.** Record it, move on.

OPTIONAL findings never delay a merge and never expand scope. Do not ask about routine technical fixes — choose the simplest, safest solution coherent with the current architecture and apply it.

## Human gates (unchanged)

This skill grants **no** new authority. Stop and report `HUMAN GATE` if a finding requires:

- new product behaviour
- a new domain/hair-care rule (D-26)
- a significant architectural change
- a relevant security trade-off
- a destructive or production operation
- real cost, or an external secret/provider
- genuine scope expansion

Report it as **Requested / Risk / Recommended / Trade-off** and wait. Never resolve a `HUMAN DECISION` item in the Decision Register.

## Anti-overengineering guard

**A finding is not an obligation to change anything.** Necessity/YAGNI (D-47/D-48, Ponytail) still governs every fix.

This audit may never be the justification for:

- a new framework
- a new dependency for convenience
- a broad refactor
- a preventive table, column, RPC, trigger or Edge Function
- an abstraction "for the future"
- a design pattern with no consumer
- more sophisticated architecture out of preference

The fix for a real defect is the smallest change that removes it. If the audit's own output would add more complexity than the defect costs, the finding is OPTIONAL.

## Loop prevention

One pass → real fixes → validation → final confirmation.

A **second full pass is required only** when the fixes were materially broad or touched security/integrity. Otherwise confirm the specific fixes and stop. OPTIONAL findings never justify another cycle. Never re-open a finding already recorded as accepted.

## Full project audit (`--full`)

Same dimensions, repository-wide, plus:

- inconsistencies between older and newer modules
- earlier decisions made obsolete by later SPECs
- cross-context security (a guarantee one context assumes and another does not provide)
- dead paths and orphaned code left by folded/superseded SPECs
- broken integrations between modules
- documentation that contradicts the implementation (`CLAUDE.md`, DATA-MODEL, DOMAIN-MAP, SPEC evidence sections)

Run at checkpoints: before beta, before release, after a large roadmap block, or on explicit request. Findings that cross SPEC boundaries are reported, not silently fixed — an out-of-scope fix is scope expansion.

## Guardrails

- **This skill edits files** — and only these: the files already in the current branch's diff, plus tests covering the fixes, plus the SPEC's evidence section. Anything outside the approved SPEC scope is reported, never edited.
- Never weakens a test, an assertion, a constraint, a policy or a check to make something pass. If a guardrail fails, the code is wrong until proven otherwise.
- Never deletes or skips a test.
- Never runs a migration, a deploy, a dependency install, or a merge.
- Never pushes to `main`, force-pushes, or enables anything the human gates cover.
- Reports real command output. If a check could not be run locally, says so and names CI as the authoritative gate.

## Expected output

```
# IMPROVE AUDIT — <SPEC-NNN | FULL PROJECT>

## Scope audited          files, flows traced, skills delegated to
## BLOCKER                finding · failure scenario · fix applied
## IMPORTANT              finding · failure scenario · fix applied / reported
## OPTIONAL               finding · why not changed
## HUMAN GATE             Requested / Risk / Recommended / Trade-off
## Validation             real output of pnpm verify (+ pgTAP or why not)
## Verdict                READY FOR AUTO-MERGE | FIX FIRST | NEEDS HUMAN DECISION
```

`READY FOR AUTO-MERGE` requires: zero open BLOCKER, zero open in-scope IMPORTANT, validation green, no human gate pending.

## Stop conditions

- Non-trivial code change with no identifiable SPEC → stop, report.
- A finding needs a human gate → stop that finding, report, continue the rest of the audit.
- A fix would require touching files outside the approved SPEC scope → report, do not edit.
- The branch diff is empty → nothing to audit; say so.
