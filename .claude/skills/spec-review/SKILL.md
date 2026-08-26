---
name: spec-review
description: Read-only review of a SPEC against the Definition of Ready, ADRs, data model, RLS strategy and analytics catalogue. Use before a SPEC is approved or before implementation starts.
---

# /spec-review SPEC-NNN

## Purpose
Verify that a SPEC is complete and consistent with the approved architecture before a human approves it (`docs/specs/README.md` → Definition of Ready).

## When to use
- A SPEC is `Draft`/`In Review` and someone wants to move it to `Approved`.
- Before starting implementation of an `Approved` SPEC that has not been reviewed in this session.

## Required inputs
- SPEC id or path.

## Steps
1. Read the SPEC, `CLAUDE.md`, the ADRs it references (and `docs/adr/README.md` for any it should reference), `docs/architecture/DOMAIN-MAP.md`, `DATA-MODEL.md`, `docs/security/SUPABASE-RLS-STRATEGY.md`, `SECURITY-BASELINE.md` §13, ADR-010 (event catalogue), `docs/architecture/DECISION-REGISTER.md`.
2. Check every Definition of Ready item; list unmet ones.
3. Cross-check: business rules live in `packages/core` (not UI); every new table has ownership + RLS per verb + test; every `SECURITY DEFINER` is justified and allow-listed; inputs validated client+server; idempotency where writes can be retried; entitlements checked server-side; events are behavioural and PII-free; dates follow ADR-008; overdue handling follows D-28; hair-care rules carry `validation_status` (D-26).
4. Check the SPEC does not contradict an `Accepted` ADR or a `DECIDED` register entry.
5. Produce the report.

## Guardrails
- Read-only. Never edits the SPEC or any other file.
- Never changes SPEC status.
- Findings are ranked: BLOCKER (DoR unmet / contradicts ADR or decision / security gap), MAJOR, MINOR.

## Expected output
Table of DoR items (met/unmet), findings by severity with file/section references, explicit verdict: `READY FOR HUMAN APPROVAL` or `NOT READY`.

## Stop conditions
- SPEC file not found → stop.
- The SPEC requires a decision listed as HUMAN DECISION/OPEN in the Decision Register → report as BLOCKER, do not decide.
