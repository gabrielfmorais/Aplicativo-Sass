---
name: spec-create
description: Create a new SPEC-NNN draft from the official template for a bounded context, with related ADRs pre-filled and open questions classified. Use when a feature/idea needs a SPEC before any implementation.
---

# /spec-create <bounded-context> <title>

## Purpose
Turn an informal idea into a `Draft` SPEC that follows `docs/specs/SPEC-TEMPLATE.md`, so nothing significant is implemented from a chat message (Spec-Driven Development, `docs/specs/README.md`).

## When to use
- A new capability, behaviour change or schema change is requested and no SPEC covers it.
- NOT for trivial fixes with no behaviour/data/auth impact.

## Required inputs
- Bounded context (must exist in `docs/architecture/DOMAIN-MAP.md`).
- Title and 2–5 sentences describing the need.
- Optional: hypothesis (H1–H5) from `docs/product/PRODUCT-BRIEF.md`.

## Steps
1. Read `CLAUDE.md`, `docs/specs/README.md`, `docs/architecture/DOMAIN-MAP.md`, `docs/adr/README.md`, `docs/architecture/DECISION-REGISTER.md`.
2. Determine the next free ID from the index in `docs/specs/README.md` (reserved IDs keep their number).
3. Copy `docs/specs/SPEC-TEMPLATE.md` to `docs/specs/SPEC-NNN-<slug>.md`; fill: ID, Status `Draft`, Owner (human), Bounded Context, Related ADRs (from the context's row in DOMAIN-MAP), roadmap phase.
4. Fill Context/Problem/Goals/Non-Goals from the input. Every section you cannot answer gets `TODO` — never invent business rules, hair-care rules (D-26) or data.
5. Pre-fill `Security Considerations` with the checklist from `docs/security/SECURITY-BASELINE.md` §13 and `Data Model Impact` with a pointer to `docs/architecture/DATA-MODEL.md`.
6. List Open Questions classified BLOCKING / IMPORTANT / CAN DEFER with the assumption adopted meanwhile.
7. Add the SPEC to the index table in `docs/specs/README.md`.
8. Report the created path and the list of TODOs.

## Guardrails
- Status is always `Draft`; only a human moves it to `Approved`.
- Writes ONLY the new SPEC file and the index row. No code, no migrations, no ADR edits.
- Never resolves items marked HUMAN DECISION in the Decision Register.
- Hair-care rules are described as `draft` hypotheses requiring domain review, never as facts.

## Expected output
Path of the new SPEC, count of TODO sections, open questions grouped by class.

## Stop conditions
- Bounded context not found in DOMAIN-MAP → stop and ask (may require ADR-006 revision).
- The request implies an architectural change → stop and recommend an ADR first.
- The request touches auth, RLS, billing or admin → flag `security` label requirement in the report.
